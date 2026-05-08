import { beforeEach, describe, expect, test, vi } from "vitest";

import { createClient } from "@supabase/supabase-js";
import { loadPortfolioRiskData } from "@/lib/portfolio-risk-repository";

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

const positionRow = {
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
  notes: null,
  created_at: "2026-05-08T00:00:00.000Z",
  updated_at: "2026-05-08T00:00:00.000Z",
};

function createPortfolioRiskClientMock() {
  return {
    from: vi.fn((table: string) => {
      if (table === "account_risk_profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: profileRow, error: null }),
        };
      }

      if (table === "saved_positions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [positionRow], error: null }),
        };
      }

      if (table === "saved_position_lots") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi
            .fn()
            .mockReturnValueOnce({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: {
                  code: "PGRST205",
                  message:
                    "Could not find the table 'public.saved_position_lots' in the schema cache",
                },
              }),
            }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("portfolio risk repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("returns saved positions when the lots table has not been migrated yet", async () => {
    vi.mocked(createClient).mockReturnValue(createPortfolioRiskClientMock() as never);

    const data = await loadPortfolioRiskData("user-1");

    expect(data.databaseReady).toBe(false);
    expect(data.message).toContain("Лотовете още не са активирани");
    expect(data.positions).toHaveLength(1);
    expect(data.positions[0]).toMatchObject({
      id: "position-1",
      symbol: "SOFI",
      quantity: 6,
      lots: [],
    });
  });
});
