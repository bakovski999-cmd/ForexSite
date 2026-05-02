import { describe, expect, test } from "vitest";

import { calculateLeverageRisk, parseLeverage } from "@/lib/risk-calculator";

describe("leverage risk calculator", () => {
  test("parses common leverage formats", () => {
    expect(parseLeverage("1:1000")).toBe(1000);
    expect(parseLeverage("1/500")).toBe(500);
    expect(parseLeverage("100")).toBe(100);
    expect(parseLeverage("1000:1")).toBe(1000);
    expect(parseLeverage("")).toBeNull();
    expect(parseLeverage("abc")).toBeNull();
  });

  test("calculates liquidation price and expected profit", () => {
    const result = calculateLeverageRisk({
      investedAmount: 1000,
      leverage: 100,
      buyPrice: 50,
      shares: 100,
      plannedSellPrice: 60,
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

  test("detects when the selected volume needs more margin than invested", () => {
    const result = calculateLeverageRisk({
      investedAmount: 100,
      leverage: 10,
      buyPrice: 50,
      shares: 100,
      plannedSellPrice: 55,
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
      investedAmount: 0,
      leverage: Number.NaN,
      buyPrice: -10,
      shares: 0,
      plannedSellPrice: -1,
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.errors.investedAmount).toBeDefined();
    expect(result.errors.leverage).toBeDefined();
    expect(result.errors.buyPrice).toBeDefined();
    expect(result.errors.shares).toBeDefined();
    expect(result.errors.plannedSellPrice).toBeDefined();
  });
});
