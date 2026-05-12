import type { Mt5StoredSnapshot } from "@/lib/mt5";
import {
  getDefaultAccountRiskProfile,
  type AccountRiskProfile,
  type PortfolioBrokerBaseline,
  type SavedPortfolioPosition,
} from "@/lib/portfolio-risk";

export type Mt5PortfolioRiskLiveMetrics = {
  currency: string;
  equity: number;
  freeMargin: number;
  margin: number;
  marginLevel: number;
  profit: number;
};

export type Mt5PortfolioRiskData = {
  accountLogin: string;
  liveMetrics: Mt5PortfolioRiskLiveMetrics;
  positions: SavedPortfolioPosition[];
  profile: AccountRiskProfile;
  receivedAt: string;
  server: string;
};

export type Mt5PortfolioRiskScenario = Mt5PortfolioRiskData & {
  brokerBaseline: PortfolioBrokerBaseline;
  combinedScenarioPositions: SavedPortfolioPosition[];
  livePositions: SavedPortfolioPosition[];
  manualPlanPositions: SavedPortfolioPosition[];
};

function normalizeCurrency(value: string | undefined, fallback: string) {
  return (value?.trim().toUpperCase() || fallback).slice(0, 8);
}

function resolveQuantity(volume: number, contractSize: number | undefined) {
  if (typeof contractSize === "number" && Number.isFinite(contractSize) && contractSize > 0) {
    return volume * contractSize;
  }

  return volume;
}

export function maskMt5AccountLogin(login: string | number | null | undefined) {
  const value = String(login ?? "").trim();

  if (!value) {
    return "****";
  }

  return `****${value.slice(-4)}`;
}

export function buildPortfolioRiskFromMt5Snapshot(
  snapshot: Mt5StoredSnapshot | null,
  fallbackProfile: AccountRiskProfile = getDefaultAccountRiskProfile(),
): Mt5PortfolioRiskData | null {
  if (!snapshot) {
    return null;
  }

  const account = snapshot.payload.account;
  const accountCurrency = normalizeCurrency(account.currency, fallbackProfile.accountCurrency);
  const brokerName = account.company || account.broker || snapshot.server || "MT5";
  const profile = getDefaultAccountRiskProfile({
    ...fallbackProfile,
    id: null,
    accountName: `MT5 ${account.login}`,
    accountCurrency,
    balance: account.balance,
    brokerName,
    userId: undefined,
  });

  const positions: SavedPortfolioPosition[] = snapshot.payload.positions.map((position) => {
    const instrumentCurrency = normalizeCurrency(position.currencyProfit, accountCurrency);
    const quantity = resolveQuantity(position.volume, position.contractSize);

    return {
      id: `mt5:${position.ticket}`,
      accountRiskProfileId: null,
      assetName: position.comment || position.symbol,
      currentPrice: position.currentPrice,
      direction: position.type,
      entryPrice: position.openPrice,
      instrumentCurrency,
      lots: [
        {
          id: `mt5-lot:${position.ticket}`,
          entryPrice: position.openPrice,
          quantity,
          notes: "MT5 live position",
          displayOrder: 0,
        },
      ],
      normalFixedLeverage: null,
      notes: `MT5 ticket ${position.ticket}`,
      quantity,
      symbol: position.symbol,
      temporaryFixedLeverage: null,
    };
  });

  return {
    accountLogin: snapshot.accountLogin,
    liveMetrics: {
      currency: accountCurrency,
      equity: account.equity,
      freeMargin: account.freeMargin,
      margin: account.margin,
      marginLevel: account.marginLevel,
      profit: account.profit,
    },
    positions,
    profile,
    receivedAt: snapshot.receivedAt,
    server: snapshot.server,
  };
}

export function buildMt5PortfolioRiskScenario(
  snapshot: Mt5StoredSnapshot | null,
  savedPositions: SavedPortfolioPosition[],
  fallbackProfile: AccountRiskProfile = getDefaultAccountRiskProfile(),
): Mt5PortfolioRiskScenario | null {
  const liveData = buildPortfolioRiskFromMt5Snapshot(snapshot, fallbackProfile);

  if (!liveData) {
    return null;
  }

  const manualPlanPositions = savedPositions.filter(
    (position) => position.scenarioSource === "manual_plan",
  );
  const livePositions = liveData.positions;

  return {
    ...liveData,
    brokerBaseline: {
      equity: liveData.liveMetrics.equity,
      freeMargin: liveData.liveMetrics.freeMargin,
      margin: liveData.liveMetrics.margin,
      marginLevel: liveData.liveMetrics.marginLevel,
      profit: liveData.liveMetrics.profit,
    },
    combinedScenarioPositions: [...livePositions, ...manualPlanPositions],
    livePositions,
    manualPlanPositions,
  };
}
