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
  lots?: SavedPortfolioLot[];
  createdAt?: string;
  updatedAt?: string;
};

export type SavedPortfolioLot = {
  id: string;
  userId?: string;
  savedPositionId?: string;
  entryPrice: number;
  quantity: number;
  plannedExitPrice?: number | null;
  sharesToSell?: number | null;
  notes?: string | null;
  displayOrder?: number;
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

export type PortfolioLotAnalysis = {
  lot: SavedPortfolioLot;
  effectiveSharesToSell: number;
  costBasisInstrument: number;
  normalAutoCloseRawPrice: number;
  normalAutoClosePrice: number;
  normalAutoCloseBelowZero: boolean;
  riskAutoCloseRawPrice: number;
  riskAutoClosePrice: number;
  riskAutoCloseBelowZero: boolean;
  lossToNormalStopInstrument: number;
  lossToNormalStopAccount: number;
  lossToRiskStopInstrument: number;
  lossToRiskStopAccount: number;
  plannedSaleValueInstrument: number | null;
  plannedProfitInstrument: number | null;
  plannedProfitAccount: number | null;
  plannedReturnPercent: number | null;
};

export type PortfolioAutoCloseRange = {
  min: number;
  max: number;
  hasBelowZero: boolean;
};

export type PortfolioPlannedExitSummary = {
  totalShares: number;
  weightedAverageEntryPrice: number;
  plannedSharesToSell: number;
  totalPlannedSaleValueInstrument: number;
  totalPlannedProfitInstrument: number;
  totalPlannedProfitAccount: number;
  plannedReturnPercent: number;
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
  autoCloseRangeNormal: PortfolioAutoCloseRange;
  autoCloseRangeRisk: PortfolioAutoCloseRange;
  totalLossToNormalStopAccount: number;
  totalLossToRiskStopAccount: number;
  allocationPercent: number;
  riskBadge: "safe" | "moderate" | "high" | "critical";
  warnings: string[];
  lotAnalyses: PortfolioLotAnalysis[];
  plannedExitSummary: PortfolioPlannedExitSummary | null;
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
  incrementalPnlInstrument: number;
  incrementalPnlAccount: number;
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

function getSortedLots(position: SavedPortfolioPosition) {
  return [...(position.lots ?? [])].sort((first, second) => {
    const firstOrder = first.displayOrder ?? 0;
    const secondOrder = second.displayOrder ?? 0;

    if (firstOrder !== secondOrder) {
      return firstOrder - secondOrder;
    }

    return String(first.createdAt ?? "").localeCompare(String(second.createdAt ?? ""));
  });
}

function buildLotAnalyses(
  position: SavedPortfolioPosition,
  lots: SavedPortfolioLot[],
  fxRateInstrumentToAccount: number,
): {
  lotAnalyses: PortfolioLotAnalysis[];
  plannedExitSummary: PortfolioPlannedExitSummary | null;
} {
  const lotAnalyses = lots.map((lot) => {
    const effectiveSharesToSell = lot.sharesToSell ?? lot.quantity;
    const costBasisInstrument = lot.entryPrice * effectiveSharesToSell;
    const hasPlan = lot.plannedExitPrice != null && Number.isFinite(lot.plannedExitPrice);
    const plannedSaleValueInstrument = hasPlan
      ? lot.plannedExitPrice! * effectiveSharesToSell
      : null;
    const plannedProfitInstrument = hasPlan
      ? calculatePositionPnl(
          position.direction,
          lot.entryPrice,
          lot.plannedExitPrice!,
          effectiveSharesToSell,
        )
      : null;
    const plannedProfitAccount =
      plannedProfitInstrument === null ? null : plannedProfitInstrument * fxRateInstrumentToAccount;

    return {
      lot,
      effectiveSharesToSell,
      costBasisInstrument,
      normalAutoCloseRawPrice: Number.NaN,
      normalAutoClosePrice: Number.NaN,
      normalAutoCloseBelowZero: false,
      riskAutoCloseRawPrice: Number.NaN,
      riskAutoClosePrice: Number.NaN,
      riskAutoCloseBelowZero: false,
      lossToNormalStopInstrument: 0,
      lossToNormalStopAccount: 0,
      lossToRiskStopInstrument: 0,
      lossToRiskStopAccount: 0,
      plannedSaleValueInstrument,
      plannedProfitInstrument,
      plannedProfitAccount,
      plannedReturnPercent:
        plannedProfitInstrument === null || costBasisInstrument <= 0
          ? null
          : (plannedProfitInstrument / costBasisInstrument) * 100,
    };
  });
  const plannedLots = lotAnalyses.filter((analysis) => analysis.plannedProfitInstrument !== null);

  if (plannedLots.length === 0) {
    return { lotAnalyses, plannedExitSummary: null };
  }

  const plannedSharesToSell = plannedLots.reduce(
    (sum, analysis) => sum + analysis.effectiveSharesToSell,
    0,
  );
  const totalCostBasisInstrument = plannedLots.reduce(
    (sum, analysis) => sum + analysis.costBasisInstrument,
    0,
  );
  const totalPlannedSaleValueInstrument = plannedLots.reduce(
    (sum, analysis) => sum + (analysis.plannedSaleValueInstrument ?? 0),
    0,
  );
  const totalPlannedProfitInstrument = plannedLots.reduce(
    (sum, analysis) => sum + (analysis.plannedProfitInstrument ?? 0),
    0,
  );

  return {
    lotAnalyses,
    plannedExitSummary: {
      totalShares: lots.reduce((sum, lot) => sum + lot.quantity, 0),
      weightedAverageEntryPrice:
        lots.reduce((sum, lot) => sum + lot.entryPrice * lot.quantity, 0) /
        lots.reduce((sum, lot) => sum + lot.quantity, 0),
      plannedSharesToSell,
      totalPlannedSaleValueInstrument,
      totalPlannedProfitInstrument,
      totalPlannedProfitAccount: totalPlannedProfitInstrument * fxRateInstrumentToAccount,
      plannedReturnPercent:
        totalCostBasisInstrument > 0
          ? (totalPlannedProfitInstrument / totalCostBasisInstrument) * 100
          : 0,
    },
  };
}

function aggregatePositionLots(position: SavedPortfolioPosition) {
  const lots = getSortedLots(position);

  if (lots.length === 0) {
    return { position, lots };
  }

  const quantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const entryValue = lots.reduce((sum, lot) => sum + lot.entryPrice * lot.quantity, 0);

  return {
    lots,
    position: {
      ...position,
      entryPrice: entryValue / quantity,
      quantity,
      lots,
    },
  };
}

function getEffectiveRiskLots(position: SavedPortfolioPosition) {
  const lots = getSortedLots(position);

  if (lots.length > 0) {
    return lots;
  }

  return [
    {
      id: `position-lot:${position.id}`,
      savedPositionId: position.id,
      entryPrice: position.entryPrice,
      quantity: position.quantity,
      plannedExitPrice: null,
      sharesToSell: null,
      notes: "Позиция",
      displayOrder: 0,
      createdAt: position.createdAt,
      updatedAt: position.updatedAt,
    } satisfies SavedPortfolioLot,
  ];
}

function calculateLotAutoClosePrice(
  direction: PortfolioDirection,
  entryPrice: number,
  bufferPerShareInstrument: number,
) {
  return direction === "buy"
    ? entryPrice - bufferPerShareInstrument
    : entryPrice + bufferPerShareInstrument;
}

function calculateLotStopLossInstrument(
  direction: PortfolioDirection,
  entryPrice: number,
  autoClosePrice: number,
  quantity: number,
) {
  const loss =
    direction === "buy"
      ? (entryPrice - autoClosePrice) * quantity
      : (autoClosePrice - entryPrice) * quantity;

  return Math.max(loss, 0);
}

function buildAutoCloseRange(
  values: { price: number; belowZero: boolean }[],
): PortfolioAutoCloseRange {
  const finiteValues = values
    .filter((value) => !value.belowZero && Number.isFinite(value.price))
    .map((value) => value.price);
  const hasBelowZero = values.some((value) => value.belowZero);

  if (finiteValues.length === 0) {
    return { min: Number.NaN, max: Number.NaN, hasBelowZero };
  }

  return {
    min: Math.min(...finiteValues),
    max: Math.max(...finiteValues),
    hasBelowZero,
  };
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
    const lots = getSortedLots(position);

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

    lots.forEach((lot, lotIndex) => {
      const lotRow = `${row}.${lotIndex + 1}`;

      if (!isPositiveNumber(lot.entryPrice)) {
        errors.push(`Лот ${lotRow}: входната цена трябва да е над 0.`);
      }

      if (!isPositiveNumber(lot.quantity)) {
        errors.push(`Лот ${lotRow}: броят акции трябва да е над 0.`);
      }

      if (lot.plannedExitPrice != null && !isNonNegativeNumber(lot.plannedExitPrice)) {
        errors.push(`Лот ${lotRow}: целевата цена трябва да е 0 или повече.`);
      }

      if (lot.sharesToSell != null) {
        if (!isPositiveNumber(lot.sharesToSell)) {
          errors.push(`Лот ${lotRow}: броят акции за продажба трябва да е над 0.`);
        }

        if (lot.sharesToSell > lot.quantity) {
          errors.push(`Лот ${lotRow}: акциите за продажба не може да са повече от лота.`);
        }
      }
    });

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
    const aggregated = aggregatePositionLots(position);
    const normalizedPosition = aggregated.position;
    const basePrice = normalizedPosition.currentPrice ?? normalizedPosition.entryPrice;
    const normalFixedLeverage = normalizedPosition.normalFixedLeverage ?? profile.normalFixedLeverage;
    const temporaryFixedLeverage =
      normalizedPosition.temporaryFixedLeverage ?? profile.temporaryFixedLeverage;
    const positionValueInstrument = basePrice * normalizedPosition.quantity;
    const positionValueAccount = positionValueInstrument * profile.fxRateInstrumentToAccount;
    const unrealizedPnLInstrument = calculatePositionPnl(
      normalizedPosition.direction,
      normalizedPosition.entryPrice,
      basePrice,
      normalizedPosition.quantity,
    );
    const unrealizedPnLAccount = unrealizedPnLInstrument * profile.fxRateInstrumentToAccount;
    const { lotAnalyses, plannedExitSummary } = buildLotAnalyses(
      normalizedPosition,
      aggregated.lots,
      profile.fxRateInstrumentToAccount,
    );

    return {
      position: {
        ...normalizedPosition,
        symbol: normalizedPosition.symbol.trim().toUpperCase(),
        instrumentCurrency: normalizeCurrency(normalizedPosition.instrumentCurrency, "USD"),
      },
      basePrice,
      positionValueInstrument,
      positionValueAccount,
      normalUsedMargin: positionValueAccount / normalFixedLeverage,
      temporaryUsedMargin: positionValueAccount / temporaryFixedLeverage,
      unrealizedPnLInstrument,
      unrealizedPnLAccount,
      lotAnalyses,
      plannedExitSummary,
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
    const effectiveRiskLots = getEffectiveRiskLots(position.position);
    const riskLotAnalyses = effectiveRiskLots.map((lot) => {
      const normalAutoCloseRawPrice = calculateLotAutoClosePrice(
        position.position.direction,
        lot.entryPrice,
        normalAutoClose.bufferPerShareInstrument,
      );
      const riskAutoCloseRawPrice = calculateLotAutoClosePrice(
        position.position.direction,
        lot.entryPrice,
        temporaryAutoClose.bufferPerShareInstrument,
      );
      const normalAutoCloseBelowZero =
        position.position.direction === "buy" && normalAutoCloseRawPrice < 0;
      const riskAutoCloseBelowZero =
        position.position.direction === "buy" && riskAutoCloseRawPrice < 0;
      const normalAutoClosePrice = Math.max(0, normalAutoCloseRawPrice);
      const riskAutoClosePrice = Math.max(0, riskAutoCloseRawPrice);
      const lossToNormalStopInstrument = calculateLotStopLossInstrument(
        position.position.direction,
        lot.entryPrice,
        normalAutoClosePrice,
        lot.quantity,
      );
      const lossToRiskStopInstrument = calculateLotStopLossInstrument(
        position.position.direction,
        lot.entryPrice,
        riskAutoClosePrice,
        lot.quantity,
      );

      return {
        lot,
        normalAutoCloseRawPrice,
        normalAutoClosePrice,
        normalAutoCloseBelowZero,
        riskAutoCloseRawPrice,
        riskAutoClosePrice,
        riskAutoCloseBelowZero,
        lossToNormalStopInstrument,
        lossToNormalStopAccount: lossToNormalStopInstrument * profile.fxRateInstrumentToAccount,
        lossToRiskStopInstrument,
        lossToRiskStopAccount: lossToRiskStopInstrument * profile.fxRateInstrumentToAccount,
      };
    });
    const riskLotAnalysesById = new Map(riskLotAnalyses.map((item) => [item.lot.id, item]));
    const lotAnalyses = position.lotAnalyses.map((lotAnalysis) => {
      const riskLotAnalysis = riskLotAnalysesById.get(lotAnalysis.lot.id);

      if (!riskLotAnalysis) {
        return lotAnalysis;
      }

      return {
        ...lotAnalysis,
        normalAutoCloseRawPrice: riskLotAnalysis.normalAutoCloseRawPrice,
        normalAutoClosePrice: riskLotAnalysis.normalAutoClosePrice,
        normalAutoCloseBelowZero: riskLotAnalysis.normalAutoCloseBelowZero,
        riskAutoCloseRawPrice: riskLotAnalysis.riskAutoCloseRawPrice,
        riskAutoClosePrice: riskLotAnalysis.riskAutoClosePrice,
        riskAutoCloseBelowZero: riskLotAnalysis.riskAutoCloseBelowZero,
        lossToNormalStopInstrument: riskLotAnalysis.lossToNormalStopInstrument,
        lossToNormalStopAccount: riskLotAnalysis.lossToNormalStopAccount,
        lossToRiskStopInstrument: riskLotAnalysis.lossToRiskStopInstrument,
        lossToRiskStopAccount: riskLotAnalysis.lossToRiskStopAccount,
      };
    });
    const totalLossToNormalStopAccount = riskLotAnalyses.reduce(
      (sum, item) => sum + item.lossToNormalStopAccount,
      0,
    );
    const totalLossToRiskStopAccount = riskLotAnalyses.reduce(
      (sum, item) => sum + item.lossToRiskStopAccount,
      0,
    );
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
      lotAnalyses,
      normalAutoClose,
      temporaryAutoClose,
      autoCloseRangeNormal: buildAutoCloseRange(
        riskLotAnalyses.map((item) => ({
          price: item.normalAutoClosePrice,
          belowZero: item.normalAutoCloseBelowZero,
        })),
      ),
      autoCloseRangeRisk: buildAutoCloseRange(
        riskLotAnalyses.map((item) => ({
          price: item.riskAutoClosePrice,
          belowZero: item.riskAutoCloseBelowZero,
        })),
      ),
      totalLossToNormalStopAccount,
      totalLossToRiskStopAccount,
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
  const originalBaseline = calculatePortfolioRisk(profile, originalPositions);

  if (!stressed.ok) {
    return stressed;
  }

  if (!originalBaseline.ok) {
    return originalBaseline;
  }

  const positions = stressed.positions.map((analysis, index) => {
    const original = originalBaseline.positions[index];
    const crashPrice = analysis.basePrice;
    const originalBasePrice = original.basePrice;
    const pnlInstrument = calculatePositionPnl(
      original.position.direction,
      original.position.entryPrice,
      crashPrice,
      original.position.quantity,
    );
    const pnlAccount = pnlInstrument * profile.fxRateInstrumentToAccount;
    const incrementalPnlInstrument = calculatePositionPnl(
      original.position.direction,
      originalBasePrice,
      crashPrice,
      original.position.quantity,
    );
    const incrementalPnlAccount = incrementalPnlInstrument * profile.fxRateInstrumentToAccount;

    return {
      positionId: getPositionKey(original.position),
      symbol: original.position.symbol,
      crashPrice,
      pnlInstrument,
      pnlAccount,
      incrementalPnlInstrument,
      incrementalPnlAccount,
    };
  });
  const totalIncrementalPnlAccount = positions.reduce(
    (sum, position) => sum + position.incrementalPnlAccount,
    0,
  );

  return {
    ok: true,
    equityAfter: stressed.summary.equity,
    totalLossAccount: Math.max(0, -totalIncrementalPnlAccount),
    normalMarginLevel: stressed.summary.normal.marginLevel,
    temporaryMarginLevel: stressed.summary.temporary.marginLevel,
    survivesNormal: stressed.summary.equity > stressed.summary.normal.stopOutEquity,
    survivesTemporary: stressed.summary.equity > stressed.summary.temporary.stopOutEquity,
    positions,
  };
}
