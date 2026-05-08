import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCurrentSession } from "@/lib/auth";
import {
  createSavedPositionLot,
  createSavedPosition,
  deleteSavedPositionLot,
  loadPortfolioRiskData,
  saveAccountRiskProfile,
  updateSavedPositionLot,
  updateSavedPosition,
} from "@/lib/portfolio-risk-repository";
import { DELETE, GET, PATCH, POST } from "@/app/api/portfolio-risk/route";

vi.mock("@/lib/auth", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/portfolio-risk-repository", () => ({
  createSavedPositionLot: vi.fn(),
  createSavedPosition: vi.fn(),
  deleteSavedPositionLot: vi.fn(),
  deleteSavedPosition: vi.fn(),
  loadPortfolioRiskData: vi.fn(),
  saveAccountRiskProfile: vi.fn(),
  updateSavedPositionLot: vi.fn(),
  updateSavedPosition: vi.fn(),
}));

describe("portfolio risk route validation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentSession).mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      email: "test@example.com",
      mode: "supabase",
    });
  });

  test("PATCH rejects invalid position input before touching Supabase", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/portfolio-risk", {
        body: JSON.stringify({
          position: {
            id: "position-1",
            symbol: "   ",
            direction: "buy",
            entryPrice: 0,
            currentPrice: -1,
            quantity: Number.NaN,
            instrumentCurrency: "USD",
          },
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
    );
    const body = (await response.json()) as { ok: boolean; message: string };

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.message).toContain("Попълни символ");
    expect(body.message).toContain("Цената на вход");
    expect(body.message).toContain("Текущата цена");
    expect(body.message).toContain("Броят акции");
    expect(saveAccountRiskProfile).not.toHaveBeenCalled();
    expect(updateSavedPosition).not.toHaveBeenCalled();
    expect(createSavedPosition).not.toHaveBeenCalled();
    expect(loadPortfolioRiskData).not.toHaveBeenCalled();
  });

  test("POST create-lot rejects invalid lot input before touching Supabase", async () => {
    const response = await POST(
      new Request("http://localhost/api/portfolio-risk", {
        body: JSON.stringify({
          action: "create-lot",
          lot: {
            savedPositionId: "position-1",
            entryPrice: 16,
            quantity: 2,
            plannedExitPrice: -1,
            sharesToSell: 3,
          },
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
    const body = (await response.json()) as { ok: boolean; message: string };

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.message).toContain("Планираната цена");
    expect(body.message).toContain("не може да са повече");
    expect(createSavedPositionLot).not.toHaveBeenCalled();
    expect(loadPortfolioRiskData).not.toHaveBeenCalled();
  });

  test("GET returns saved positions with a lots migration warning", async () => {
    vi.mocked(loadPortfolioRiskData).mockResolvedValue({
      databaseReady: false,
      message: "Лотовете още не са активирани в Supabase. Старите позиции се показват нормално.",
      profile: {
        id: "profile-1",
        accountName: "Test",
        brokerName: "Broker",
        accountCurrency: "EUR",
        balance: 2000,
        addedFundsSimulation: 0,
        stopOutLevelPercent: 20,
        marginCallLevelPercent: 50,
        normalFixedLeverage: 20,
        temporaryFixedLeverage: 5,
        fxRateInstrumentToAccount: 0.85,
      },
      positions: [
        {
          id: "position-1",
          symbol: "SOFI",
          direction: "buy",
          entryPrice: 16.3,
          currentPrice: null,
          quantity: 6,
          instrumentCurrency: "USD",
          lots: [],
        },
      ],
    });

    const response = await GET();
    const body = (await response.json()) as {
      ok: boolean;
      databaseReady: boolean;
      message: string;
      positions: unknown[];
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.databaseReady).toBe(false);
    expect(body.message).toContain("Лотовете още не са активирани");
    expect(body.positions).toHaveLength(1);
  });

  test("lot action database errors render clean messages instead of object strings", async () => {
    vi.mocked(createSavedPositionLot).mockRejectedValue({
      code: "PGRST205",
      message: "Could not find the table 'public.saved_position_lots' in the schema cache",
      details: null,
      hint: null,
    });

    const response = await POST(
      new Request("http://localhost/api/portfolio-risk", {
        body: JSON.stringify({
          action: "create-lot",
          lot: {
            savedPositionId: "position-1",
            entryPrice: 16,
            quantity: 2,
          },
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
    const body = (await response.json()) as { ok: boolean; message: string };

    expect(response.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.message).not.toBe("[object Object]");
    expect(body.message).toContain("Supabase таблиците");
  });

  test("lot actions return refreshed portfolio data", async () => {
    vi.mocked(createSavedPositionLot).mockResolvedValue({
      id: "lot-1",
      savedPositionId: "position-1",
      entryPrice: 16,
      quantity: 2,
      plannedExitPrice: 20,
      sharesToSell: null,
    });
    vi.mocked(updateSavedPositionLot).mockResolvedValue({
      id: "lot-1",
      savedPositionId: "position-1",
      entryPrice: 16,
      quantity: 3,
      plannedExitPrice: 22,
      sharesToSell: 2,
    });
    vi.mocked(loadPortfolioRiskData).mockResolvedValue({
      profile: {
        id: "profile-1",
        accountName: "Test",
        brokerName: "Broker",
        accountCurrency: "EUR",
        balance: 2000,
        addedFundsSimulation: 0,
        stopOutLevelPercent: 20,
        marginCallLevelPercent: 50,
        normalFixedLeverage: 20,
        temporaryFixedLeverage: 5,
        fxRateInstrumentToAccount: 0.85,
      },
      positions: [],
    });

    const createResponse = await POST(
      new Request("http://localhost/api/portfolio-risk", {
        body: JSON.stringify({
          action: "create-lot",
          lot: {
            savedPositionId: "position-1",
            entryPrice: 16,
            quantity: 2,
            plannedExitPrice: 20,
          },
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
    const updateResponse = await PATCH(
      new Request("http://localhost/api/portfolio-risk", {
        body: JSON.stringify({
          action: "update-lot",
          lot: {
            id: "lot-1",
            savedPositionId: "position-1",
            entryPrice: 16,
            quantity: 3,
            plannedExitPrice: 22,
            sharesToSell: 2,
          },
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
    );
    const deleteResponse = await DELETE(
      new Request("http://localhost/api/portfolio-risk?action=delete-lot&positionId=position-1&lotId=lot-1", {
        method: "DELETE",
      }),
    );

    expect(createResponse.status).toBe(200);
    expect(updateResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(createSavedPositionLot).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "position-1",
      expect.objectContaining({ entryPrice: 16, quantity: 2 }),
    );
    expect(updateSavedPositionLot).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "position-1",
      expect.objectContaining({ id: "lot-1", sharesToSell: 2 }),
    );
    expect(deleteSavedPositionLot).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "position-1",
      "lot-1",
    );
  });
});
