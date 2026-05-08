import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCurrentSession } from "@/lib/auth";
import {
  createSavedPosition,
  loadPortfolioRiskData,
  saveAccountRiskProfile,
  updateSavedPosition,
} from "@/lib/portfolio-risk-repository";
import { PATCH } from "@/app/api/portfolio-risk/route";

vi.mock("@/lib/auth", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/portfolio-risk-repository", () => ({
  createSavedPosition: vi.fn(),
  deleteSavedPosition: vi.fn(),
  loadPortfolioRiskData: vi.fn(),
  saveAccountRiskProfile: vi.fn(),
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
});
