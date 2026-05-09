import { beforeEach, describe, expect, test, vi } from "vitest";

import { createClient } from "@supabase/supabase-js";
import {
  createSavedPositionLot,
  deleteSavedPositionLot,
  loadPortfolioRiskData,
  updateSavedPosition,
  updateSavedPositionLot,
} from "@/lib/portfolio-risk-repository";

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  },
  isSupabaseConfigured: true,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const profileRow = {
  id: "profile-1",
  user_id: "user-1",
  account_name: "Test CFD account",
  broker_name: "Broker",
  account_currency: "EUR",
  balance: 2000,
  added_funds_simulation: 0,
  stop_out_level_percent: 20,
  margin_call_level_percent: 50,
  normal_fixed_leverage: 20,
  temporary_fixed_leverage: 5,
  fx_rate_instrument_to_account: 0.85,
  created_at: "2026-05-08T00:00:00.000Z",
  updated_at: "2026-05-08T00:00:00.000Z",
};

function encodeFallbackLots(lots: unknown[]) {
  return `<!-- portfolio-risk-lots:${encodeURIComponent(
    JSON.stringify({ version: 1, lots }),
  )} -->`;
}

function createPositionRow(notes: string | null = null) {
  return {
    id: "position-1",
    user_id: "user-1",
    account_risk_profile_id: "profile-1",
    symbol: "SOFI",
    asset_name: null,
    direction: "buy",
    entry_price: 16.3,
    current_price: null,
    quantity: 6,
    instrument_currency: "USD",
    normal_fixed_leverage: null,
    temporary_fixed_leverage: null,
    notes,
    created_at: "2026-05-08T00:00:00.000Z",
    updated_at: "2026-05-08T00:00:00.000Z",
  };
}

type MockState = {
  positionRows: ReturnType<typeof createPositionRow>[];
  lotsTableMissing: boolean;
  lotRows: Array<{
    id: string;
    user_id: string;
    saved_position_id: string;
    entry_price: number;
    quantity: number;
    planned_exit_price: number | null;
    shares_to_sell: number | null;
    notes: string | null;
    display_order: number;
    created_at: string;
    updated_at: string;
  }>;
};

function createPortfolioRiskClientMock(state: MockState) {
  const missingLotsError = {
    code: "PGRST205",
    message: "Could not find the table 'public.saved_position_lots' in the schema cache",
  };

  function makeQuery(table: string) {
    let operation: "select" | "insert" | "update" | "delete" = "select";
    let ordered = false;
    let insertPayload: Record<string, unknown> | null = null;
    let updatePayload: Record<string, unknown> | null = null;

    const execute = async () => {
      if (table === "account_risk_profiles") {
        return { data: profileRow, error: null };
      }

      if (table === "saved_positions") {
        if (operation === "update" && updatePayload) {
          state.positionRows = state.positionRows.map((row) =>
            row.id === "position-1" ? { ...row, ...updatePayload } : row,
          );
        }

        return {
          data: operation === "select" && ordered ? state.positionRows : state.positionRows[0],
          error: null,
        };
      }

      if (table === "saved_position_lots") {
        if (state.lotsTableMissing) {
          return { data: null, error: missingLotsError };
        }

        if (operation === "insert" && insertPayload) {
          const row = {
            id: `lot-${state.lotRows.length + 1}`,
            user_id: insertPayload.user_id as string,
            saved_position_id: insertPayload.saved_position_id as string,
            entry_price: insertPayload.entry_price as number,
            quantity: insertPayload.quantity as number,
            planned_exit_price: (insertPayload.planned_exit_price as number | null) ?? null,
            shares_to_sell: (insertPayload.shares_to_sell as number | null) ?? null,
            notes: (insertPayload.notes as string | null) ?? null,
            display_order: (insertPayload.display_order as number | null) ?? 0,
            created_at: "2026-05-08T00:00:00.000Z",
            updated_at: "2026-05-08T00:00:00.000Z",
          };
          state.lotRows = [...state.lotRows, row];

          return { data: row, error: null };
        }

        return { data: state.lotRows, error: null };
      }

      throw new Error(`Unexpected table ${table}`);
    };

    const query = {
      delete: vi.fn(() => {
        operation = "delete";
        return query;
      }),
      eq: vi.fn(() => query),
      in: vi.fn(() => query),
      insert: vi.fn((payload: Record<string, unknown>) => {
        operation = "insert";
        insertPayload = payload;
        return query;
      }),
      limit: vi.fn(() => query),
      maybeSingle: vi.fn(async () => execute()),
      order: vi.fn(() => {
        ordered = true;
        return query;
      }),
      select: vi.fn(() => {
        return query;
      }),
      single: vi.fn(async () => execute()),
      then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
        execute().then(resolve, reject),
      update: vi.fn((payload: Record<string, unknown>) => {
        operation = "update";
        updatePayload = payload;
        return query;
      }),
    };

    return query;
  }

  return {
    from: vi.fn((table: string) => makeQuery(table)),
  };
}

describe("portfolio risk repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("loads fallback lots from saved position notes when the lots table is missing", async () => {
    const state: MockState = {
      lotsTableMissing: true,
      lotRows: [],
      positionRows: [
        createPositionRow(
          `User visible note\n${encodeFallbackLots([
            {
              id: "note-lot:existing",
              entryPrice: 15.7,
              quantity: 2,
              plannedExitPrice: 45,
              sharesToSell: null,
              notes: "fallback lot",
            },
          ])}`,
        ),
      ],
    };
    vi.mocked(createClient).mockReturnValue(createPortfolioRiskClientMock(state) as never);

    const data = await loadPortfolioRiskData("user-1");

    expect(data.databaseReady).toBe(true);
    expect(data.message).toBeUndefined();
    expect(data.positions[0].notes).toBe("User visible note");
    expect(data.positions[0].lots).toEqual([
      expect.objectContaining({
        id: "note-lot:base:position-1",
        entryPrice: 16.3,
        quantity: 6,
        notes: "Начална позиция",
      }),
      expect.objectContaining({
        id: "note-lot:existing",
        entryPrice: 15.7,
        quantity: 2,
        plannedExitPrice: 45,
        notes: "fallback lot",
      }),
    ]);
  });

  test("creates, updates and deletes fallback lots in saved position notes", async () => {
    const state: MockState = {
      lotsTableMissing: true,
      lotRows: [],
      positionRows: [createPositionRow("Human note")],
    };
    vi.mocked(createClient).mockReturnValue(createPortfolioRiskClientMock(state) as never);

    const created = await createSavedPositionLot("user-1", "position-1", {
      entryPrice: 15.7,
      quantity: 2,
      plannedExitPrice: 45,
      sharesToSell: null,
      notes: "first lot",
      displayOrder: 0,
    });

    expect(created.id).toMatch(/^note-lot:/);
    expect(state.positionRows[0].notes).toContain("Human note");
    expect(state.positionRows[0].notes).toContain("portfolio-risk-lots");

    let data = await loadPortfolioRiskData("user-1");
    expect(data.positions[0].lots).toHaveLength(2);
    expect(data.positions[0].lots?.[0]).toMatchObject({
      id: "note-lot:base:position-1",
      entryPrice: 16.3,
      quantity: 6,
      notes: "Начална позиция",
    });
    expect(data.positions[0].lots?.[1]).toMatchObject({
      entryPrice: 15.7,
      quantity: 2,
      plannedExitPrice: 45,
    });

    await updateSavedPositionLot("user-1", "position-1", {
      id: created.id,
      entryPrice: 15.7,
      quantity: 2,
      plannedExitPrice: 50,
      sharesToSell: 1,
      notes: "updated lot",
      displayOrder: 0,
    });

    data = await loadPortfolioRiskData("user-1");
    expect(data.positions[0].lots?.[1]).toMatchObject({
      plannedExitPrice: 50,
      sharesToSell: 1,
      notes: "updated lot",
    });

    await deleteSavedPositionLot("user-1", "position-1", created.id);

    data = await loadPortfolioRiskData("user-1");
    expect(data.positions[0].lots).toEqual([
      expect.objectContaining({
        id: "note-lot:base:position-1",
        entryPrice: 16.3,
        quantity: 6,
      }),
    ]);
    expect(data.positions[0].notes).toBe("Human note");
  });

  test("seeds the base position before the first saved lot when the lots table exists", async () => {
    const state: MockState = {
      lotsTableMissing: false,
      lotRows: [],
      positionRows: [createPositionRow("Human note")],
    };
    vi.mocked(createClient).mockReturnValue(createPortfolioRiskClientMock(state) as never);

    const created = await createSavedPositionLot("user-1", "position-1", {
      entryPrice: 15.7,
      quantity: 2,
      plannedExitPrice: 45,
      sharesToSell: null,
      notes: "second lot",
      displayOrder: 0,
    });

    expect(created.id).toBe("lot-2");
    expect(state.lotRows).toHaveLength(2);
    expect(state.lotRows[0]).toMatchObject({
      entry_price: 16.3,
      quantity: 6,
      notes: "Начална позиция",
      display_order: 0,
    });
    expect(state.lotRows[1]).toMatchObject({
      entry_price: 15.7,
      quantity: 2,
      planned_exit_price: 45,
      notes: "second lot",
      display_order: 1,
    });

    const data = await loadPortfolioRiskData("user-1");

    expect(data.positions[0].lots).toHaveLength(2);
    expect(data.positions[0].lots?.[0]).toMatchObject({
      entryPrice: 16.3,
      quantity: 6,
      notes: "Начална позиция",
    });
    expect(data.positions[0].lots?.[1]).toMatchObject({
      entryPrice: 15.7,
      quantity: 2,
      plannedExitPrice: 45,
    });
  });

  test("preserves fallback lots when the main position notes are edited", async () => {
    const state: MockState = {
      lotsTableMissing: true,
      lotRows: [],
      positionRows: [
        createPositionRow(
          `Old note\n${encodeFallbackLots([
            {
              id: "note-lot:existing",
              entryPrice: 15.7,
              quantity: 2,
              plannedExitPrice: 45,
            },
          ])}`,
        ),
      ],
    };
    vi.mocked(createClient).mockReturnValue(createPortfolioRiskClientMock(state) as never);

    await updateSavedPosition("user-1", "profile-1", {
      id: "position-1",
      symbol: "SOFI",
      assetName: null,
      direction: "buy",
      entryPrice: 16.3,
      currentPrice: null,
      quantity: 6,
      instrumentCurrency: "USD",
      normalFixedLeverage: null,
      temporaryFixedLeverage: null,
      notes: "New note",
    });

    const data = await loadPortfolioRiskData("user-1");

    expect(data.positions[0].notes).toBe("New note");
    expect(data.positions[0].lots?.[1]).toMatchObject({
      id: "note-lot:existing",
      entryPrice: 15.7,
      quantity: 2,
    });
  });
});
