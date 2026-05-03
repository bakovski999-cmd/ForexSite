import { describe, expect, test } from "vitest";

import {
  calculateLeverageRisk,
  calculateReverseLeverageRisk,
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

  test("reverse calculator sizes shares by risk", () => {
    const result = calculateReverseLeverageRisk({
      side: "long",
      maxRisk: 1000,
      leverage: 100,
      entryPrice: 50,
      stopPrice: 40,
      exitPrice: 60,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.riskPerShare).toBe(10);
    expect(result.sharesByRisk).toBe(100);
    expect(result.sharesByMargin).toBe(2000);
    expect(result.recommendedShares).toBe(100);
    expect(result.limitingFactor).toBe("risk");
    expect(result.expectedProfit).toBe(1000);
  });

  test("reverse calculator limits shares by margin", () => {
    const result = calculateReverseLeverageRisk({
      side: "short",
      maxRisk: 100,
      leverage: 2,
      entryPrice: 50,
      stopPrice: 100,
      exitPrice: 40,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.sharesByRisk).toBe(2);
    expect(result.sharesByMargin).toBe(4);
    expect(result.recommendedShares).toBe(2);
    expect(result.limitingFactor).toBe("risk");
    expect(result.expectedProfit).toBe(20);
  });

  test("reverse calculator can use margin as the limiting factor", () => {
    const result = calculateReverseLeverageRisk({
      side: "short",
      maxRisk: 100,
      leverage: 2,
      entryPrice: 50,
      stopPrice: 51,
      exitPrice: 40,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.sharesByRisk).toBe(100);
    expect(result.sharesByMargin).toBe(4);
    expect(result.recommendedShares).toBe(4);
    expect(result.limitingFactor).toBe("margin");
    expect(result.lossAtStop).toBe(4);
  });

  test("reverse calculator validates stop direction by side", () => {
    const invalidLong = calculateReverseLeverageRisk({
      side: "long",
      maxRisk: 1000,
      leverage: 100,
      entryPrice: 50,
      stopPrice: 55,
      exitPrice: 60,
    });
    const invalidShort = calculateReverseLeverageRisk({
      side: "short",
      maxRisk: 1000,
      leverage: 100,
      entryPrice: 50,
      stopPrice: 45,
      exitPrice: 40,
    });

    expect(invalidLong.ok).toBe(false);
    expect(invalidShort.ok).toBe(false);

    if (!invalidLong.ok) {
      expect(invalidLong.errors.stopPrice).toContain("Long");
    }

    if (!invalidShort.ok) {
      expect(invalidShort.errors.stopPrice).toContain("Short");
    }
  });
});
