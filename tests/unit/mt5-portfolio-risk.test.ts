import { describe, expect, test } from "vitest";

import {
  buildMt5PortfolioRiskScenario,
  buildPortfolioRiskFromMt5Snapshot,
} from "@/lib/mt5-portfolio-risk";
import type { Mt5StoredSnapshot } from "@/lib/mt5";
import type { SavedPortfolioPosition } from "@/lib/portfolio-risk";

const storedSnapshot: Mt5StoredSnapshot = {
  id: "snapshot-1",
  connectionKey: "PUPrime-Live 6:28085384",
  accountLogin: "28085384",
  server: "PUPrime-Live 6",
  receivedAt: "2026-05-10T16:11:46.000Z",
  payload: {
    version: 1,
    sentAt: "2026.05.10 19:11:40",
    terminal: { name: "MetaTrader 5", build: 5834, path: "C:\\MT5" },
    account: {
      login: "28085384",
      server: "PUPrime-Live 6",
      broker: "PU Prime",
      company: "PU Prime Ltd",
      currency: "EUR",
      balance: 974,
      equity: 1844.94,
      margin: 4.15,
      freeMargin: 1840.79,
      marginLevel: 44456.39,
      leverage: 500,
      profit: -3.06,
    },
    positions: [
      {
        ticket: "43088356",
        symbol: "SOFI",
        type: "buy",
        volume: 6,
        openPrice: 16.3,
        currentPrice: 15.71,
        stopLoss: 0,
        takeProfit: 30.06,
        profit: -3.06,
        swap: 0,
        commission: 0,
        magic: "0",
        comment: "",
        openTime: "2026.05.06 16:47:10",
        contractSize: 1,
        currencyProfit: "USD",
        currencyMargin: "EUR",
      },
    ],
    historyDeals: [],
  },
};

describe("MT5 to Portfolio Risk adapter", () => {
  test("maps a live SOFI snapshot into portfolio profile, positions and exact MT5 metrics", () => {
    const result = buildPortfolioRiskFromMt5Snapshot(storedSnapshot);

    expect(result.profile.accountName).toBe("MT5 28085384");
    expect(result.profile.brokerName).toBe("PU Prime Ltd");
    expect(result.profile.accountCurrency).toBe("EUR");
    expect(result.profile.balance).toBe(974);
    expect(result.positions).toEqual([
      expect.objectContaining({
        id: "mt5:43088356",
        symbol: "SOFI",
        direction: "buy",
        entryPrice: 16.3,
        currentPrice: 15.71,
        quantity: 6,
        instrumentCurrency: "USD",
      }),
    ]);
    expect(result.liveMetrics).toEqual({
      equity: 1844.94,
      freeMargin: 1840.79,
      margin: 4.15,
      marginLevel: 44456.39,
      profit: -3.06,
      currency: "EUR",
    });
  });

  test("returns null when there is no stored snapshot", () => {
    expect(buildPortfolioRiskFromMt5Snapshot(null)).toBeNull();
  });

  test("builds a manual scenario from live MT5 positions plus only saved plan positions", () => {
    const legacyPosition: SavedPortfolioPosition = {
      id: "legacy-sofi",
      symbol: "SOFI",
      direction: "buy",
      entryPrice: 16.3,
      currentPrice: 15.71,
      quantity: 6,
      instrumentCurrency: "USD",
      scenarioSource: null,
    };
    const planPosition: SavedPortfolioPosition = {
      id: "plan-meta",
      symbol: "META",
      direction: "buy",
      entryPrice: 500,
      currentPrice: 500,
      quantity: 2,
      instrumentCurrency: "USD",
      scenarioSource: "manual_plan",
    };

    const result = buildMt5PortfolioRiskScenario(storedSnapshot, [
      legacyPosition,
      planPosition,
    ]);

    expect(result).not.toBeNull();
    expect(result?.livePositions.map((position) => position.id)).toEqual(["mt5:43088356"]);
    expect(result?.manualPlanPositions.map((position) => position.id)).toEqual(["plan-meta"]);
    expect(result?.combinedScenarioPositions.map((position) => position.id)).toEqual([
      "mt5:43088356",
      "plan-meta",
    ]);
    expect(result?.combinedScenarioPositions.some((position) => position.id === "legacy-sofi")).toBe(
      false,
    );
  });
});
