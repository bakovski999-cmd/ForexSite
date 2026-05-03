import { describe, expect, test } from "vitest";

import {
  calculateAccumulatedPosition,
  calculateLeverageRisk,
  calculatePartialSales,
  parseLeverage,
} from "@/lib/risk-calculator";

describe("leverage risk calculator", () => {
  test("parses common leverage formats", () => {
    expect(parseLeverage("1:1000")).toBe(1000);
    expect(parseLeverage("1/500")).toBe(500);
    expect(parseLeverage("100")).toBe(100);
    expect(parseLeverage("1000:1")).toBe(1000);
    expect(parseLeverage("")).toBeNull();
    expect(parseLeverage("abc")).toBeNull();
  });

  test("calculates long liquidation price and expected profit", () => {
    const result = calculateLeverageRisk({
      side: "long",
      investedAmount: 1000,
      leverage: 100,
      entryPrice: 50,
      shares: 100,
      exitPrice: 60,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.notional).toBe(5000);
    expect(result.requiredMargin).toBe(50);
    expect(result.liquidationPrice).toBe(40);
    expect(result.expectedProfit).toBe(1000);
    expect(result.positionAllowed).toBe(true);
  });

  test("calculates short liquidation price and expected profit", () => {
    const result = calculateLeverageRisk({
      side: "short",
      investedAmount: 1000,
      leverage: 100,
      entryPrice: 50,
      shares: 100,
      exitPrice: 40,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.requiredMargin).toBe(50);
    expect(result.liquidationPrice).toBe(60);
    expect(result.expectedProfit).toBe(1000);
    expect(result.positionAllowed).toBe(true);
  });

  test("detects when the selected volume needs more margin than invested", () => {
    const result = calculateLeverageRisk({
      side: "long",
      investedAmount: 100,
      leverage: 10,
      entryPrice: 50,
      shares: 100,
      exitPrice: 55,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.requiredMargin).toBe(500);
    expect(result.maxNotional).toBe(1000);
    expect(result.positionAllowed).toBe(false);
  });

  test("returns validation errors for invalid inputs", () => {
    const result = calculateLeverageRisk({
      side: "long",
      investedAmount: 0,
      leverage: Number.NaN,
      entryPrice: -10,
      shares: 0,
      exitPrice: -1,
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.errors.investedAmount).toBeDefined();
    expect(result.errors.leverage).toBeDefined();
    expect(result.errors.entryPrice).toBeDefined();
    expect(result.errors.shares).toBeDefined();
    expect(result.errors.exitPrice).toBeDefined();
  });

  test("calculates partial sale profit by leg and total", () => {
    const result = calculatePartialSales({
      lots: [
        { entryPrice: 16.43, ownedShares: 7, sharesToSell: 7, exitPrice: 30 },
        { entryPrice: 18, ownedShares: 7, sharesToSell: 3, exitPrice: 60 },
        { entryPrice: 23, ownedShares: 5, sharesToSell: 4, exitPrice: 50 },
      ],
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.saleResults[0].profit).toBeCloseTo(94.99);
    expect(result.saleResults[1].profit).toBe(126);
    expect(result.saleResults[2].profit).toBe(108);
    expect(result.totalOwnedShares).toBe(19);
    expect(result.soldShares).toBe(14);
    expect(result.remainingShares).toBe(5);
    expect(result.totalProfit).toBeCloseTo(328.99);
  });

  test("partial sales reject selling more shares than owned in one lot", () => {
    const result = calculatePartialSales({
      lots: [{ entryPrice: 15, ownedShares: 7, sharesToSell: 8, exitPrice: 30 }],
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.errors.lots?.[0]).toBeDefined();
  });

  test("calculates accumulated average price and target profit", () => {
    const result = calculateAccumulatedPosition({
      targetExitPrice: 50,
      lots: [
        { entryPrice: 15, shares: 7 },
        { entryPrice: 18, shares: 5 },
        { entryPrice: 23, shares: 6 },
      ],
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.totalShares).toBe(18);
    expect(result.totalCost).toBe(333);
    expect(result.averageEntryPrice).toBe(18.5);
    expect(result.lotResults[0].profit).toBe(245);
    expect(result.lotResults[1].profit).toBe(160);
    expect(result.lotResults[2].profit).toBe(162);
    expect(result.totalProfit).toBe(567);
  });

  test("accumulation validates lots and target exit price", () => {
    const result = calculateAccumulatedPosition({
      targetExitPrice: -1,
      lots: [{ entryPrice: 0, shares: 5 }],
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.errors.targetExitPrice).toBeDefined();
    expect(result.errors.lots?.[0]).toBeDefined();
  });
});
