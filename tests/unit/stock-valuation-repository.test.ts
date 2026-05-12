import { beforeEach, describe, expect, test } from "vitest";

import {
  createMemoryStockValuationRepository,
  resetStockValuationMemoryStoreForTests,
} from "@/lib/stock-valuation-repository";
import { buildDefaultStockValuationInput } from "@/lib/stock-valuation";

describe("memory stock valuation repository", () => {
  beforeEach(() => {
    resetStockValuationMemoryStoreForTests();
  });

  test("creates, updates, lists, and deletes saved analyses per user", async () => {
    const repository = createMemoryStockValuationRepository();
    const payload = buildDefaultStockValuationInput({ ticker: "META", companyName: "Meta" });

    const created = await repository.createAnalysis("user-1", {
      ticker: "META",
      companyName: "Meta",
      title: "META base case",
      latestFairValue: 574.64,
      currentPrice: 609,
      payload,
    });

    await repository.createAnalysis("user-2", {
      ticker: "MSFT",
      companyName: "Microsoft",
      title: "MSFT",
      latestFairValue: 450,
      currentPrice: 430,
      payload: buildDefaultStockValuationInput({ ticker: "MSFT" }),
    });

    expect(await repository.listAnalyses("user-1")).toHaveLength(1);
    expect((await repository.listAnalyses("user-1"))[0].ticker).toBe("META");

    const updated = await repository.updateAnalysis("user-1", created.id, {
      title: "META upside case",
      latestFairValue: 620,
      payload: { ...payload, title: "ignored" },
    });

    expect(updated?.title).toBe("META upside case");
    expect(updated?.latestFairValue).toBe(620);
    expect(await repository.getAnalysis("user-2", created.id)).toBeNull();

    await repository.deleteAnalysis("user-1", created.id);

    expect(await repository.listAnalyses("user-1")).toEqual([]);
  });
});
