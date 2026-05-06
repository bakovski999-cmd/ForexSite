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

  test("uses real broker margin from the trading platform example", () => {
    const result = calculateLeverageRisk({
      marginMode: "real_broker_margin",
      direction: "buy",
      accountBalance: 50,
      equity: 48.36,
      usedMargin: 4.16,
      accountCurrency: "EUR",
      instrumentCurrency: "USD",
      entryPrice: 16.3,
      currentPrice: 15.98,
      quantity: 6,
      plannedExitPrice: 30,
      stopOutLevelPercent: 20,
      fxRateInstrumentToAccount: 0.85,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.positionValueInstrument).toBeCloseTo(97.8);
    expect(result.positionValueAccount).toBeCloseTo(83.13);
    expect(result.requiredMargin).toBeCloseTo(4.16);
    expect(result.effectiveLeverage).toBeCloseTo(19.98);
    expect(result.marginLevel).toBeCloseTo(1162.5);
    expect(result.stopOutEquity).toBeCloseTo(0.832);
    expect(result.autoClosePrice).toBeCloseTo(6.6592);
    expect(result.grossProfitInstrument).toBeCloseTo(82.2);
    expect(result.grossProfitAccount).toBeCloseTo(69.87);
    expect(result.currentProfitAccount).toBeCloseTo(-1.632);
    expect(result.positionAllowed).toBe(true);
  });

  test("fixed leverage ignores account leverage and calculates required margin from product leverage", () => {
    const result = calculateLeverageRisk({
      marginMode: "fixed_leverage",
      direction: "buy",
      accountBalance: 50,
      accountCurrency: "EUR",
      instrumentCurrency: "USD",
      entryPrice: 16.3,
      quantity: 6,
      plannedExitPrice: 30,
      stopOutLevelPercent: 20,
      fxRateInstrumentToAccount: 0.85,
      accountLeverage: 1000,
      fixedLeverage: 20,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.positionValueAccount).toBeCloseTo(83.13);
    expect(result.requiredMargin).toBeCloseTo(4.1565);
    expect(result.effectiveLeverage).toBeCloseTo(20);
    expect(result.positionAllowed).toBe(true);
  });

  test("account leverage mode uses account leverage when the instrument follows it", () => {
    const result = calculateLeverageRisk({
      marginMode: "account_leverage",
      direction: "buy",
      accountBalance: 50,
      accountCurrency: "EUR",
      instrumentCurrency: "USD",
      entryPrice: 16.3,
      quantity: 6,
      plannedExitPrice: 30,
      stopOutLevelPercent: 20,
      fxRateInstrumentToAccount: 0.85,
      accountLeverage: 1000,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.requiredMargin).toBeCloseTo(0.08313);
    expect(result.effectiveLeverage).toBeCloseTo(1000);
  });

  test("calculates sell auto close above entry and sell profit on lower exit", () => {
    const result = calculateLeverageRisk({
      marginMode: "fixed_leverage",
      direction: "sell",
      accountBalance: 1000,
      accountCurrency: "USD",
      instrumentCurrency: "USD",
      entryPrice: 50,
      quantity: 100,
      plannedExitPrice: 40,
      stopOutLevelPercent: 20,
      fxRateInstrumentToAccount: 1,
      fixedLeverage: 100,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.requiredMargin).toBe(50);
    expect(result.autoClosePrice).toBe(59.9);
    expect(result.grossProfitInstrument).toBe(1000);
    expect(result.grossProfitAccount).toBe(1000);
  });

  test("detects when the selected volume needs more margin than account balance", () => {
    const result = calculateLeverageRisk({
      marginMode: "fixed_leverage",
      direction: "buy",
      accountBalance: 100,
      accountCurrency: "USD",
      instrumentCurrency: "USD",
      entryPrice: 50,
      quantity: 100,
      plannedExitPrice: 55,
      stopOutLevelPercent: 20,
      fxRateInstrumentToAccount: 1,
      fixedLeverage: 10,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.requiredMargin).toBe(500);
    expect(result.positionAllowed).toBe(false);
  });

  test("stop-out percent changes stop-out equity and auto close price", () => {
    const commonInput = {
      marginMode: "fixed_leverage" as const,
      direction: "buy" as const,
      accountBalance: 1000,
      accountCurrency: "USD",
      instrumentCurrency: "USD",
      entryPrice: 50,
      quantity: 100,
      plannedExitPrice: 60,
      fxRateInstrumentToAccount: 1,
      fixedLeverage: 100,
    };
    const lowStopOut = calculateLeverageRisk({ ...commonInput, stopOutLevelPercent: 20 });
    const highStopOut = calculateLeverageRisk({ ...commonInput, stopOutLevelPercent: 50 });

    expect(lowStopOut.ok).toBe(true);
    expect(highStopOut.ok).toBe(true);

    if (!lowStopOut.ok || !highStopOut.ok) {
      return;
    }

    expect(lowStopOut.stopOutEquity).toBe(10);
    expect(highStopOut.stopOutEquity).toBe(25);
    expect(highStopOut.autoClosePrice).toBeGreaterThan(lowStopOut.autoClosePrice);
  });

  test("returns validation errors for invalid inputs", () => {
    const result = calculateLeverageRisk({
      marginMode: "real_broker_margin",
      direction: "buy",
      accountBalance: 0,
      accountCurrency: "EUR",
      instrumentCurrency: "USD",
      entryPrice: -10,
      quantity: 0,
      plannedExitPrice: -1,
      stopOutLevelPercent: 0,
      fxRateInstrumentToAccount: 0,
      equity: Number.NaN,
      usedMargin: 0,
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.errors.accountBalance).toBeDefined();
    expect(result.errors.entryPrice).toBeDefined();
    expect(result.errors.quantity).toBeDefined();
    expect(result.errors.plannedExitPrice).toBeDefined();
    expect(result.errors.stopOutLevelPercent).toBeDefined();
    expect(result.errors.fxRateInstrumentToAccount).toBeDefined();
    expect(result.errors.equity).toBeDefined();
    expect(result.errors.usedMargin).toBeDefined();
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
