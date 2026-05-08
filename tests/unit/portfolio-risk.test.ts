import { describe, expect, test } from "vitest";

import {
  calculateCustomCrashStress,
  calculatePortfolioRisk,
  calculateUniformDropStress,
  type AccountRiskProfile,
  type SavedPortfolioPosition,
} from "@/lib/portfolio-risk";

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

  test("aggregates lots into quantity, weighted entry, exposure and planned profit", () => {
    const result = calculatePortfolioRisk(profile, [
      {
        ...sofiPosition,
        currentPrice: 20,
        quantity: 1,
        entryPrice: 1,
        lots: [
          {
            id: "lot-1",
            entryPrice: 15,
            quantity: 10,
            plannedExitPrice: 30,
          },
          {
            id: "lot-2",
            entryPrice: 21,
            quantity: 5,
            plannedExitPrice: 25,
            sharesToSell: 2,
          },
        ],
      },
    ]);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const analysis = result.positions[0];

    expect(analysis.position.quantity).toBeCloseTo(15);
    expect(analysis.position.entryPrice).toBeCloseTo(17);
    expect(analysis.positionValueInstrument).toBeCloseTo(300);
    expect(analysis.positionValueAccount).toBeCloseTo(255);
    expect(analysis.unrealizedPnLInstrument).toBeCloseTo(45);
    expect(analysis.plannedExitSummary?.plannedSharesToSell).toBeCloseTo(12);
    expect(analysis.plannedExitSummary?.totalPlannedProfitInstrument).toBeCloseTo(158);
    expect(analysis.plannedExitSummary?.totalPlannedProfitAccount).toBeCloseTo(134.3);
  });

  test("planned profit respects SELL direction and blank shares-to-sell means whole lot", () => {
    const result = calculatePortfolioRisk(profile, [
      {
        ...sofiPosition,
        direction: "sell",
        lots: [
          {
            id: "short-lot",
            entryPrice: 30,
            quantity: 4,
            plannedExitPrice: 20,
          },
        ],
      },
    ]);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.positions[0].lotAnalyses[0].effectiveSharesToSell).toBe(4);
    expect(result.positions[0].plannedExitSummary?.totalPlannedProfitInstrument).toBeCloseTo(40);
    expect(result.positions[0].plannedExitSummary?.totalPlannedProfitAccount).toBeCloseTo(34);
  });

  test("rejects lots where planned shares to sell exceed lot quantity", () => {
    const result = calculatePortfolioRisk(profile, [
      {
        ...sofiPosition,
        lots: [
          {
            id: "bad-lot",
            entryPrice: 16,
            quantity: 2,
            sharesToSell: 3,
          },
        ],
      },
    ]);

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.errors.join(" ")).toContain("не може да са повече");
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

  test("stress total loss measures the incremental move from current price", () => {
    const position: SavedPortfolioPosition = {
      id: "current-loss",
      symbol: "TEST",
      direction: "buy",
      entryPrice: 100,
      currentPrice: 80,
      quantity: 2,
      instrumentCurrency: "USD",
    };
    const stress = calculateCustomCrashStress(
      { ...profile, accountCurrency: "USD", fxRateInstrumentToAccount: 1 },
      [position],
      { "current-loss": 70 },
    );

    expect(stress.ok).toBe(true);

    if (!stress.ok) {
      return;
    }

    expect(stress.positions[0].pnlAccount).toBe(-60);
    expect(stress.positions[0].incrementalPnlAccount).toBe(-20);
    expect(stress.totalLossAccount).toBe(20);
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
