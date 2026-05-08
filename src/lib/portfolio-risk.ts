export type PortfolioDirection = "buy" | "sell";

export type AccountRiskProfile = {
  id: string | null;
  userId?: string;
  accountName: string;
  brokerName: string;
  accountCurrency: string;
  balance: number;
  addedFundsSimulation: number;
  stopOutLevelPercent: number;
  marginCallLevelPercent: number;
  normalFixedLeverage: number;
  temporaryFixedLeverage: number;
  fxRateInstrumentToAccount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type SavedPortfolioPosition = {
  id: string;
  userId?: string;
  accountRiskProfileId?: string | null;
  symbol: string;
  assetName?: string | null;
  direction: PortfolioDirection;
  entryPrice: number;
  currentPrice?: number | null;
  quantity: number;
  instrumentCurrency: string;
  normalFixedLeverage?: number | null;
  temporaryFixedLeverage?: number | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PortfolioRiskData = {
  profile: AccountRiskProfile;
  positions: SavedPortfolioPosition[];
  databaseReady?: boolean;
  message?: string;
};

export type PortfolioScenarioSummary = {
  usedMargin: number;
  freeMargin: number;
  marginLevel: number;
  stopOutEquity: number;
  maxLossBeforeStopOut: number;
  uniformDropThresholdPercent: number;
};

export type IndividualStopOut = {
  autoClosePrice: number;
  displayAutoClosePrice: number;
  autoCloseBelowZero: boolean;
  bufferPerShareAccount: number;
  bufferPerShareInstrument: number;
};

export type PortfolioPositionAnalysis = {
  position: SavedPortfolioPosition;
  basePrice: number;
  positionValueInstrument: number;
  positionValueAccount: number;
  normalUsedMargin: number;
  temporaryUsedMargin: number;
  unrealizedPnLInstrument: number;
  unrealizedPnLAccount: number;
  normalAutoClose: IndividualStopOut;
  temporaryAutoClose: IndividualStopOut;
  allocationPercent: number;
  riskBadge: "safe" | "moderate" | "high" | "critical";
  warnings: string[];
};

export type PortfolioRiskSummary = {
  accountCurrency: string;
  instrumentCurrency: string;
  balance: number;
  addedFunds: number;
  simulatedBalance: number;
  equity: number;
  totalPositionValueAccount: number;
  totalPositionValueInstrument: number;
  totalUnrealizedPnLAccount: number;
  normal: PortfolioScenarioSummary;
  temporary: PortfolioScenarioSummary;
  riskStatus: "safe" | "moderate" | "high" | "critical";
  warnings: string[];
};

export type PortfolioRiskResult =
  | {
      ok: true;
      profile: AccountRiskProfile;
      positions: PortfolioPositionAnalysis[];
      summary: PortfolioRiskSummary;
    }
  | {
      ok: false;
      errors: string[];
    };

export type StressPositionResult = {
  positionId: string;
  symbol: string;
  crashPrice: number;
  pnlInstrument: number;
  pnlAccount: number;
};

export type PortfolioStressResult =
  | {
      ok: true;
      equityAfter: number;
      totalLossAccount: number;
      normalMarginLevel: number;
      temporaryMarginLevel: number;
      survivesNormal: boolean;
      survivesTemporary: boolean;
      positions: StressPositionResult[];
    }
  | {
      ok: false;
      errors: string[];
    };

const defaultProfile: AccountRiskProfile = {
  id: null,
  accountName: "Основен CFD акаунт",
  brokerName: "PU Prime",
  accountCurrency: "EUR",
  balance: 2000,
  addedFundsSimulation: 0,
  stopOutLevelPercent: 20,
  marginCallLevelPercent: 50,
  normalFixedLeverage: 20,
  temporaryFixedLeverage: 5,
  fxRateInstrumentToAccount: 0.85,
};

function isPositiveNumber(value: number) {
  return Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: number) {
  return Number.isFinite(value) && value >= 0;
}

function normalizeCurrency(value: string | undefined, fallback: string) {
  return (value?.trim().toUpperCase() || fallback).slice(0, 8);
}

function calculatePositionPnl(
  direction: PortfolioDirection,
  entryPrice: number,
  price: number,
  quantity: number,
) {
  return direction === "buy"
    ? (price - entryPrice) * quantity
    : (entryPrice - price) * quantity;
}

export function getDefaultAccountRiskProfile(overrides: Partial<AccountRiskProfile> = {}) {
  return {
    ...defaultProfile,
    ...overrides,
    id: overrides.id ?? null,
    accountName: overrides.accountName ?? defaultProfile.accountName,
    brokerName: overrides.brokerName ?? defaultProfile.brokerName,
    accountCurrency: normalizeCurrency(overrides.accountCurrency, defaultProfile.accountCurrency),
  };
}

export function getPositionKey(position: Pick<SavedPortfolioPosition, "id" | "symbol">) {
  return position.id || position.symbol;
}

export function calculatePortfolioRisk(
  profileInput: AccountRiskProfile,
  positionsInput: SavedPortfolioPosition[],
  options: { addedFundsSimulation?: number } = {},
): PortfolioRiskResult {
  const profile = getDefaultAccountRiskProfile(profileInput);
  const errors: string[] = [];

  if (!isNonNegativeNumber(profile.balance)) {
    errors.push("Balance трябва да е 0 или повече.");
  }

  if (!isNonNegativeNumber(profile.addedFundsSimulation)) {
    errors.push("Симулацията за добавени средства трябва да е 0 или повече.");
  }

  if (!isPositiveNumber(profile.stopOutLevelPercent)) {
    errors.push("Stop-out процентът трябва да е над 0.");
  }

  if (!isPositiveNumber(profile.marginCallLevelPercent)) {
    errors.push("Margin call процентът трябва да е над 0.");
  }

  if (!isPositiveNumber(profile.normalFixedLeverage)) {
    errors.push("Нормалният fixed leverage трябва да е над 0.");
  }

  if (!isPositiveNumber(profile.temporaryFixedLeverage)) {
    errors.push("Временният fixed leverage трябва да е над 0.");
  }

  if (!isPositiveNumber(profile.fxRateInstrumentToAccount)) {
    errors.push("FX курсът трябва да е над 0.");
  }

  positionsInput.forEach((position, index) => {
    const row = index + 1;

    if (!position.symbol.trim()) {
      errors.push(`Позиция ${row}: въведи символ.`);
    }

    if (position.direction !== "buy" && position.direction !== "sell") {
      errors.push(`Позиция ${row}: посоката трябва да е BUY или SELL.`);
    }

    if (!isPositiveNumber(position.entryPrice)) {
      errors.push(`Позиция ${row}: входната цена трябва да е над 0.`);
    }

    if (position.currentPrice != null && !isPositiveNumber(position.currentPrice)) {
      errors.push(`Позиция ${row}: текущата цена трябва да е над 0 или празна.`);
    }

    if (!isPositiveNumber(position.quantity)) {
      errors.push(`Позиция ${row}: броят акции трябва да е над 0.`);
    }

    if (position.normalFixedLeverage != null && !isPositiveNumber(position.normalFixedLeverage)) {
      errors.push(`Позиция ${row}: нормалният leverage трябва да е над 0.`);
    }

    if (
      position.temporaryFixedLeverage != null &&
      !isPositiveNumber(position.temporaryFixedLeverage)
    ) {
      errors.push(`Позиция ${row}: временният leverage трябва да е над 0.`);
    }
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const accountCurrency = normalizeCurrency(profile.accountCurrency, "EUR");
  const addedFunds = options.addedFundsSimulation ?? profile.addedFundsSimulation;
  const simulatedBalance = profile.balance + addedFunds;
  const baseAnalyses = positionsInput.map((position) => {
    const basePrice = position.currentPrice ?? position.entryPrice;
    const normalFixedLeverage = position.normalFixedLeverage ?? profile.normalFixedLeverage;
    const temporaryFixedLeverage =
      position.temporaryFixedLeverage ?? profile.temporaryFixedLeverage;
    const positionValueInstrument = basePrice * position.quantity;
    const positionValueAccount = positionValueInstrument * profile.fxRateInstrumentToAccount;
    const unrealizedPnLInstrument = calculatePositionPnl(
      position.direction,
      position.entryPrice,
      basePrice,
      position.quantity,
    );
    const unrealizedPnLAccount = unrealizedPnLInstrument * profile.fxRateInstrumentToAccount;

    return {
      position: {
        ...position,
        symbol: position.symbol.trim().toUpperCase(),
        instrumentCurrency: normalizeCurrency(position.instrumentCurrency, "USD"),
      },
      basePrice,
      positionValueInstrument,
      positionValueAccount,
      normalUsedMargin: positionValueAccount / normalFixedLeverage,
      temporaryUsedMargin: positionValueAccount / temporaryFixedLeverage,
      unrealizedPnLInstrument,
      unrealizedPnLAccount,
    };
  });

  const totalPositionValueAccount = baseAnalyses.reduce(
    (sum, item) => sum + item.positionValueAccount,
    0,
  );
  const totalPositionValueInstrument = baseAnalyses.reduce(
    (sum, item) => sum + item.positionValueInstrument,
    0,
  );
  const totalUnrealizedPnLAccount = baseAnalyses.reduce(
    (sum, item) => sum + item.unrealizedPnLAccount,
    0,
  );
  const totalNormalUsedMargin = baseAnalyses.reduce((sum, item) => sum + item.normalUsedMargin, 0);
  const totalTemporaryUsedMargin = baseAnalyses.reduce(
    (sum, item) => sum + item.temporaryUsedMargin,
    0,
  );
  const equity = simulatedBalance + totalUnrealizedPnLAccount;

  const buildScenario = (usedMargin: number): PortfolioScenarioSummary => {
    const stopOutEquity = usedMargin * (profile.stopOutLevelPercent / 100);
    const maxLossBeforeStopOut = equity - stopOutEquity;

    return {
      usedMargin,
      freeMargin: equity - usedMargin,
      marginLevel: usedMargin > 0 ? (equity / usedMargin) * 100 : Number.POSITIVE_INFINITY,
      stopOutEquity,
      maxLossBeforeStopOut,
      uniformDropThresholdPercent:
        totalPositionValueAccount > 0
          ? (maxLossBeforeStopOut / totalPositionValueAccount) * 100
          : Number.POSITIVE_INFINITY,
    };
  };

  const normal = buildScenario(totalNormalUsedMargin);
  const temporary = buildScenario(totalTemporaryUsedMargin);

  const buildIndividualStopOut = (
    position: (typeof baseAnalyses)[number],
    scenario: PortfolioScenarioSummary,
  ): IndividualStopOut => {
    const bufferPerShareAccount = scenario.maxLossBeforeStopOut / position.position.quantity;
    const bufferPerShareInstrument = bufferPerShareAccount / profile.fxRateInstrumentToAccount;
    const autoClosePrice =
      position.position.direction === "buy"
        ? position.basePrice - bufferPerShareInstrument
        : position.basePrice + bufferPerShareInstrument;

    return {
      autoClosePrice,
      displayAutoClosePrice: Math.max(0, autoClosePrice),
      autoCloseBelowZero: position.position.direction === "buy" && autoClosePrice < 0,
      bufferPerShareAccount,
      bufferPerShareInstrument,
    };
  };

  const worstMarginLevel = Math.min(normal.marginLevel, temporary.marginLevel);
  const riskStatus: PortfolioRiskSummary["riskStatus"] =
    normal.freeMargin < 0 ||
    temporary.freeMargin < 0 ||
    normal.maxLossBeforeStopOut < 0 ||
    temporary.maxLossBeforeStopOut < 0 ||
    worstMarginLevel < 100
      ? "critical"
      : worstMarginLevel < 200
        ? "high"
        : worstMarginLevel < 500
          ? "moderate"
          : "safe";

  const warnings: string[] = [];

  if (temporary.marginLevel < 200) {
    warnings.push(
      "Внимание: при временен leverage прозорец акаунтът може да бъде силно натоварен.",
    );
  }

  if (normal.marginLevel < 200) {
    warnings.push("Внимание: акаунтът е силно натоварен дори в нормално време.");
  }

  if (normal.freeMargin < 0 || temporary.freeMargin < 0) {
    warnings.push("Критично: позициите изискват повече margin от наличния equity.");
  }

  if (equity > 0 && temporary.usedMargin / equity > 0.5) {
    warnings.push(
      "Внимание: при временен leverage акаунтът има ограничен буфер, защото used margin е над 50% от equity.",
    );
  }

  const positions: PortfolioPositionAnalysis[] = baseAnalyses.map((position) => {
    const normalAutoClose = buildIndividualStopOut(position, normal);
    const temporaryAutoClose = buildIndividualStopOut(position, temporary);
    const autoCloseDistancePct =
      position.basePrice > 0
        ? Math.min(
            Math.abs((normalAutoClose.autoClosePrice - position.basePrice) / position.basePrice),
            Math.abs(
              (temporaryAutoClose.autoClosePrice - position.basePrice) / position.basePrice,
            ),
          ) * 100
        : Number.POSITIVE_INFINITY;
    const positionWarnings: string[] = [];

    if (autoCloseDistancePct < 10) {
      positionWarnings.push("Малко движение срещу позицията може да доведе до stop-out.");
    }

    const riskBadge: PortfolioPositionAnalysis["riskBadge"] =
      autoCloseDistancePct < 10
        ? "critical"
        : autoCloseDistancePct < 25
          ? "high"
          : autoCloseDistancePct < 50
            ? "moderate"
            : "safe";

    return {
      ...position,
      normalAutoClose,
      temporaryAutoClose,
      allocationPercent:
        totalPositionValueAccount > 0
          ? (position.positionValueAccount / totalPositionValueAccount) * 100
          : 0,
      riskBadge,
      warnings: positionWarnings,
    };
  });

  return {
    ok: true,
    profile,
    positions,
    summary: {
      accountCurrency,
      instrumentCurrency: positions[0]?.position.instrumentCurrency ?? "USD",
      balance: profile.balance,
      addedFunds,
      simulatedBalance,
      equity,
      totalPositionValueAccount,
      totalPositionValueInstrument,
      totalUnrealizedPnLAccount,
      normal,
      temporary,
      riskStatus,
      warnings,
    },
  };
}

export function calculateUniformDropStress(
  profile: AccountRiskProfile,
  positions: SavedPortfolioPosition[],
  dropPercent: number,
): PortfolioStressResult {
  if (!Number.isFinite(dropPercent) || dropPercent < 0 || dropPercent > 100) {
    return { ok: false, errors: ["Процентът спад трябва да е между 0 и 100."] };
  }

  const stressedPositions = positions.map((position) => {
    const basePrice = position.currentPrice ?? position.entryPrice;
    return {
      ...position,
      currentPrice: basePrice * (1 - dropPercent / 100),
    };
  });

  return calculateStressScenario(profile, positions, stressedPositions);
}

export function calculateCustomCrashStress(
  profile: AccountRiskProfile,
  positions: SavedPortfolioPosition[],
  crashPrices: Record<string, number>,
): PortfolioStressResult {
  const stressedPositions = positions.map((position) => {
    const key = getPositionKey(position);
    const crashPrice = crashPrices[key];

    return {
      ...position,
      currentPrice:
        Number.isFinite(crashPrice) && crashPrice >= 0
          ? crashPrice
          : position.currentPrice ?? position.entryPrice,
    };
  });

  return calculateStressScenario(profile, positions, stressedPositions);
}

function calculateStressScenario(
  profile: AccountRiskProfile,
  originalPositions: SavedPortfolioPosition[],
  stressedPositions: SavedPortfolioPosition[],
): PortfolioStressResult {
  const stressed = calculatePortfolioRisk(profile, stressedPositions);

  if (!stressed.ok) {
    return stressed;
  }

  const positions = stressed.positions.map((analysis, index) => {
    const original = originalPositions[index];
    const crashPrice = analysis.basePrice;
    const pnlInstrument = calculatePositionPnl(
      original.direction,
      original.entryPrice,
      crashPrice,
      original.quantity,
    );
    const pnlAccount = pnlInstrument * profile.fxRateInstrumentToAccount;

    return {
      positionId: getPositionKey(original),
      symbol: original.symbol,
      crashPrice,
      pnlInstrument,
      pnlAccount,
    };
  });
  const totalPnlAccount = positions.reduce((sum, position) => sum + position.pnlAccount, 0);

  return {
    ok: true,
    equityAfter: stressed.summary.equity,
    totalLossAccount: Math.max(0, -totalPnlAccount),
    normalMarginLevel: stressed.summary.normal.marginLevel,
    temporaryMarginLevel: stressed.summary.temporary.marginLevel,
    survivesNormal: stressed.summary.equity > stressed.summary.normal.stopOutEquity,
    survivesTemporary: stressed.summary.equity > stressed.summary.temporary.stopOutEquity,
    positions,
  };
}
