import { describe, expect, test } from "vitest";

import {
  calculateAccumulatedPosition,
  calculateLeverageRisk,
  calculatePartialSales,
  parseLeverage,
} from "@/lib/risk-calculator";
import {
  calculateCustomCrashStress,
  calculatePortfolioRisk,
  calculateUniformDropStress,
  type AccountRiskProfile,
  type SavedPortfolioPosition,
} from "@/lib/portfolio-risk";

describe("leverage risk calculator", () => {
  test("parses common leverage formats", () => {
    expect(parseLeverage("1:1000")).toBe(1000);
    expect(parseLeverage("1/500")).toBe(500);
    expect(parseLeverage("100")).toBe(100);
    expect(parseLeverage("1000:1")).toBe(1000);
    expect(parseLeverage("")).toBeNull();
    expect(parseLeverage("abc")).toBeNull();
  });

  test("uses real broker margin from any trading platform example", () => {
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
      temporaryFixedLeverage: 5,
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
    expect(result.autoClosePrice).toBeCloseTo(6.6608);
    expect(result.stopOutRange?.normal.displayAutoClosePrice).toBeCloseTo(6.6608);
    expect(result.stopOutRange?.temporary.displayAutoClosePrice).toBeCloseTo(7.1496);
    expect(result.stopOutRange?.temporary.leverage).toBe(5);
    expect(result.grossProfitInstrument).toBeCloseTo(82.2);
    expect(result.grossProfitAccount).toBeCloseTo(69.87);
    expect(result.currentProfitAccount).toBeCloseTo(-1.632);
    expect(result.positionAllowed).toBe(true);
  });

  test("real broker margin range falls back to floating P/L equity when manual equity is missing", () => {
    const result = calculateLeverageRisk({
      marginMode: "real_broker_margin",
      direction: "buy",
      accountBalance: 50,
      usedMargin: 4.16,
      accountCurrency: "EUR",
      instrumentCurrency: "USD",
      entryPrice: 16.3,
      currentPrice: 15.98,
      quantity: 6,
      plannedExitPrice: 30,
      stopOutLevelPercent: 20,
      fxRateInstrumentToAccount: 0.85,
      temporaryFixedLeverage: 10,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.equitySource).toBe("floating_pnl");
    expect(result.resolvedEquity).toBeCloseTo(48.368);
    expect(result.autoClosePrice).toBeCloseTo(6.6592);
    expect(result.stopOutRange?.temporary.displayAutoClosePrice).toBeCloseTo(6.8221);
  });

  test("real broker margin range falls back to account balance when no equity or current price exists", () => {
    const result = calculateLeverageRisk({
      marginMode: "real_broker_margin",
      direction: "buy",
      accountBalance: 50,
      usedMargin: 4.16,
      accountCurrency: "EUR",
      instrumentCurrency: "USD",
      entryPrice: 16.3,
      quantity: 6,
      plannedExitPrice: 30,
      stopOutLevelPercent: 20,
      fxRateInstrumentToAccount: 0.85,
      temporaryFixedLeverage: 5,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.equitySource).toBe("account_balance");
    expect(result.resolvedEquity).toBe(50);
    expect(result.stopOutPriceBasis).toBe(16.3);
  });

  test("real broker margin range flags active stop-out risk when available loss is negative", () => {
    const result = calculateLeverageRisk({
      marginMode: "real_broker_margin",
      direction: "buy",
      accountBalance: 50,
      equity: 1,
      usedMargin: 10,
      accountCurrency: "EUR",
      instrumentCurrency: "USD",
      entryPrice: 16.3,
      currentPrice: 15.98,
      quantity: 6,
      plannedExitPrice: 30,
      stopOutLevelPercent: 20,
      fxRateInstrumentToAccount: 0.85,
      temporaryFixedLeverage: 5,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.stopOutRange?.normal.isStopOutRiskActive).toBe(true);
    expect(result.stopOutRange?.temporary.isStopOutRiskActive).toBe(true);
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
      temporaryFixedLeverage: 0,
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

describe("portfolio risk manager calculations", () => {
  const profile: AccountRiskProfile = {
    id: null,
    accountName: "Test CFD account",
    brokerName: "Any broker",
    accountCurrency: "EUR",
    balance: 2000,
    addedFundsSimulation: 0,
    stopOutLevelPercent: 20,
    marginCallLevelPercent: 50,
    normalFixedLeverage: 20,
    temporaryFixedLeverage: 5,
    fxRateInstrumentToAccount: 0.85,
  };
  const sofiPosition: SavedPortfolioPosition = {
    id: "sofi",
    symbol: "SOFI",
    direction: "buy",
    entryPrice: 16.3,
    currentPrice: null,
    quantity: 6,
    instrumentCurrency: "USD",
  };

  test("summarizes one SOFI share CFD position with normal and temporary fixed leverage", () => {
    const result = calculatePortfolioRisk(profile, [sofiPosition]);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.positions[0].basePrice).toBe(16.3);
    expect(result.positions[0].positionValueInstrument).toBeCloseTo(97.8);
    expect(result.positions[0].positionValueAccount).toBeCloseTo(83.13);
    expect(result.positions[0].normalUsedMargin).toBeCloseTo(4.1565);
    expect(result.positions[0].temporaryUsedMargin).toBeCloseTo(16.626);
    expect(result.summary.normal.usedMargin).toBeCloseTo(4.1565);
    expect(result.summary.temporary.usedMargin).toBeCloseTo(16.626);
  });

  test("uses current price when available and handles BUY and SELL PnL direction", () => {
    const buy = calculatePortfolioRisk(profile, [
      { ...sofiPosition, currentPrice: 15, quantity: 10 },
    ]);
    const sell = calculatePortfolioRisk(profile, [
      { ...sofiPosition, direction: "sell", currentPrice: 15, quantity: 10 },
    ]);

    expect(buy.ok).toBe(true);
    expect(sell.ok).toBe(true);

    if (!buy.ok || !sell.ok) {
      return;
    }

    expect(buy.positions[0].unrealizedPnLInstrument).toBeCloseTo(-13);
    expect(sell.positions[0].unrealizedPnLInstrument).toBeCloseTo(13);
    expect(buy.positions[0].normalAutoClose.autoClosePrice).toBeLessThan(
      buy.positions[0].basePrice,
    );
    expect(sell.positions[0].normalAutoClose.autoClosePrice).toBeGreaterThan(
      sell.positions[0].basePrice,
    );
  });

  test("added funds simulation recalculates equity, margin level and individual auto-close", () => {
    const baseline = calculatePortfolioRisk(profile, [sofiPosition]);
    const funded = calculatePortfolioRisk(
      { ...profile, addedFundsSimulation: 500 },
      [sofiPosition],
    );

    expect(baseline.ok).toBe(true);
    expect(funded.ok).toBe(true);

    if (!baseline.ok || !funded.ok) {
      return;
    }

    expect(funded.summary.equity).toBeCloseTo(2500);
    expect(funded.summary.normal.freeMargin).toBeGreaterThan(baseline.summary.normal.freeMargin);
    expect(funded.summary.normal.marginLevel).toBeGreaterThan(baseline.summary.normal.marginLevel);
    expect(funded.positions[0].normalAutoClose.autoClosePrice).toBeLessThan(
      baseline.positions[0].normalAutoClose.autoClosePrice,
    );
  });

  test("uniform drop and custom crash stress tests report survival state", () => {
    const uniform = calculateUniformDropStress(profile, [sofiPosition], 50);
    const crash = calculateCustomCrashStress(profile, [sofiPosition], { sofi: 5 });
    const critical = calculateUniformDropStress({ ...profile, balance: 5 }, [sofiPosition], 50);

    expect(uniform.ok).toBe(true);
    expect(crash.ok).toBe(true);
    expect(critical.ok).toBe(true);

    if (!uniform.ok || !crash.ok || !critical.ok) {
      return;
    }

    expect(uniform.totalLossAccount).toBeGreaterThan(0);
    expect(uniform.survivesNormal).toBe(true);
    expect(uniform.survivesTemporary).toBe(true);
    expect(crash.positions[0].crashPrice).toBe(5);
    expect(critical.survivesNormal).toBe(false);
    expect(critical.survivesTemporary).toBe(false);
  });

  test("low margin level and negative free margin generate warnings", () => {
    const result = calculatePortfolioRisk({ ...profile, balance: 5 }, [sofiPosition]);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.summary.riskStatus).toBe("critical");
    expect(result.summary.temporary.freeMargin).toBeLessThan(0);
    expect(result.summary.warnings.join(" ")).toContain("Критично");
  });
});
