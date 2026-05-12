import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCurrentSession } from "@/lib/auth";
import { fetchValuationAutofill } from "@/lib/stock-valuation-autofill";
import { getStockValuationRepository } from "@/lib/stock-valuation-repository";
import { buildDefaultStockValuationInput } from "@/lib/stock-valuation";

vi.mock("@/lib/auth", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/stock-valuation-autofill", () => ({
  fetchValuationAutofill: vi.fn(),
}));

vi.mock("@/lib/stock-valuation-repository", () => ({
  getStockValuationRepository: vi.fn(),
}));

describe("valuation routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("autofill requires a browser session but allows demo calculations", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      email: "demo@goldintel.local",
      mode: "demo",
    });
    vi.mocked(fetchValuationAutofill).mockResolvedValue({
      ok: true,
      input: buildDefaultStockValuationInput({ ticker: "META", companyName: "Meta" }),
      fields: {},
      warnings: [],
    });
    const { GET } = await import("@/app/api/valuation/autofill/route");

    const response = await GET(new Request("http://localhost/api/valuation/autofill?ticker=meta"));
    const body = (await response.json()) as { ok: boolean; input: { ticker: string } };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.input.ticker).toBe("META");
    expect(fetchValuationAutofill).toHaveBeenCalledWith("meta");
  });

  test("saved analyses require a real user id", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      email: "demo@goldintel.local",
      mode: "demo",
    });
    const repository = { listAnalyses: vi.fn() };
    vi.mocked(getStockValuationRepository).mockReturnValue(repository as never);
    const { GET } = await import("@/app/api/valuation/saved/route");

    const response = await GET();

    expect(response.status).toBe(401);
    expect(repository.listAnalyses).not.toHaveBeenCalled();
  });

  test("creates saved analyses for authenticated users", async () => {
    const payload = buildDefaultStockValuationInput({ ticker: "META", companyName: "Meta" });
    vi.mocked(getCurrentSession).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      mode: "supabase",
    });
    const repository = {
      createAnalysis: vi.fn().mockResolvedValue({
        id: "analysis-1",
        userId: "user-1",
        ticker: "META",
        companyName: "Meta",
        title: "META base case",
        latestFairValue: 574.64,
        currentPrice: 609,
        payload,
        createdAt: "2026-05-12T07:00:00.000Z",
        updatedAt: "2026-05-12T07:00:00.000Z",
      }),
    };
    vi.mocked(getStockValuationRepository).mockReturnValue(repository as never);
    const { POST } = await import("@/app/api/valuation/saved/route");

    const response = await POST(
      new Request("http://localhost/api/valuation/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: "META",
          companyName: "Meta",
          title: "META base case",
          latestFairValue: 574.64,
          currentPrice: 609,
          payload,
        }),
      }),
    );
    const body = (await response.json()) as { ok: boolean; analysis: { id: string } };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.analysis.id).toBe("analysis-1");
    expect(repository.createAnalysis).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ ticker: "META", latestFairValue: 574.64 }),
    );
  });

  test("updates and deletes saved analyses by id", async () => {
    const payload = buildDefaultStockValuationInput({ ticker: "META" });
    vi.mocked(getCurrentSession).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      mode: "firebase",
    });
    const repository = {
      updateAnalysis: vi.fn().mockResolvedValue({
        id: "analysis-1",
        userId: "user-1",
        ticker: "META",
        companyName: "Meta",
        title: "Updated",
        latestFairValue: 600,
        currentPrice: 590,
        payload,
        createdAt: "2026-05-12T07:00:00.000Z",
        updatedAt: "2026-05-12T08:00:00.000Z",
      }),
      deleteAnalysis: vi.fn().mockResolvedValue(true),
    };
    vi.mocked(getStockValuationRepository).mockReturnValue(repository as never);
    const route = await import("@/app/api/valuation/saved/[id]/route");
    const context = { params: Promise.resolve({ id: "analysis-1" }) };

    const putResponse = await route.PUT(
      new Request("http://localhost/api/valuation/saved/analysis-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated", latestFairValue: 600, payload }),
      }),
      context,
    );
    const deleteResponse = await route.DELETE(
      new Request("http://localhost/api/valuation/saved/analysis-1", { method: "DELETE" }),
      context,
    );

    expect(putResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(repository.updateAnalysis).toHaveBeenCalledWith(
      "user-1",
      "analysis-1",
      expect.objectContaining({ title: "Updated" }),
    );
    expect(repository.deleteAnalysis).toHaveBeenCalledWith("user-1", "analysis-1");
  });
});
