export type PositionSide = "buy" | "sell";

export type MarginMode = "account_leverage" | "fixed_leverage" | "real_broker_margin";

export type LeverageRiskInput = {
  marginMode: MarginMode;
  direction: PositionSide;
  accountBalance: number;
  accountCurrency: string;
  instrumentCurrency: string;
  entryPrice: number;
  quantity: number;
  plannedExitPrice: number;
  stopOutLevelPercent: number;
  fxRateInstrumentToAccount: number;
  accountLeverage?: number;
  fixedLeverage?: number;
  equity?: number;
  usedMargin?: number;
  currentPrice?: number;
  temporaryFixedLeverage?: number;
};

export type LeverageRiskErrors = Partial<Record<keyof LeverageRiskInput, string>>;

export type EquitySource = "manual_equity" | "floating_pnl" | "account_balance";

export type StopOutScenario = {
  usedMargin: number;
  stopOutEquity: number;
  availableLossAccount: number;
  lossPerUnitAccount: number;
  lossPerUnitInstrument: number;
  autoClosePrice: number;
  displayAutoClosePrice: number;
  autoCloseBelowZero: boolean;
  effectiveLeverage: number;
  isStopOutRiskActive: boolean;
};

export type StopOutRange = {
  normal: StopOutScenario;
  temporary: StopOutScenario & {
    leverage: number;
  };
};

export type PartialSaleLotInput = {
  entryPrice: number;
  ownedShares: number;
  sharesToSell: number;
  exitPrice: number;
};

export type PartialSalesInput = {
  lots: PartialSaleLotInput[];
};

export type PartialSalesErrors = {
  lots?: string[];
};

export type AccumulationLotInput = {
  entryPrice: number;
  shares: number;
};

export type AccumulatedPositionInput = {
  lots: AccumulationLotInput[];
  targetExitPrice: number;
};

export type AccumulatedPositionErrors = {
  lots?: string[];
  targetExitPrice?: string;
};

export type LeverageRiskResult =
  | {
      ok: true;
      input: LeverageRiskInput;
      positionValueInstrument: number;
      positionValueAccount: number;
      requiredMargin: number;
      freeMargin: number;
      marginLevel: number;
      effectiveLeverage: number;
      positionAllowed: boolean;
      resolvedEquity: number;
      equitySource: EquitySource;
      stopOutPriceBasis: number;
      stopOutEquity: number;
      maxLossAccount: number;
      maxLossPerUnitAccount: number;
      maxLossPerUnitInstrument: number;
      autoClosePrice: number;
      displayAutoClosePrice: number;
      autoCloseBelowZero: boolean;
      stopOutRange?: StopOutRange;
      grossProfitInstrument: number;
      grossProfitAccount: number;
      returnPercentOnBalance: number;
      currentProfitInstrument?: number;
      currentProfitAccount?: number;
    }
  | {
      ok: false;
      errors: LeverageRiskErrors;
    };

export type PartialSalesResult =
  | {
      ok: true;
      input: PartialSalesInput;
      saleResults: Array<
        PartialSaleLotInput & {
          index: number;
          profit: number;
          costBasisSold: number;
          saleValue: number;
          remainingSharesAfter: number;
        }
      >;
      totalOwnedShares: number;
      soldShares: number;
      remainingShares: number;
      totalCostBasisSold: number;
      totalSaleValue: number;
      totalProfit: number;
    }
  | {
      ok: false;
      errors: PartialSalesErrors;
    };

export type AccumulatedPositionResult =
  | {
      ok: true;
      input: AccumulatedPositionInput;
      lotResults: Array<
        AccumulationLotInput & {
          index: number;
          cost: number;
          profit: number;
          returnPct: number;
        }
      >;
      totalShares: number;
      totalCost: number;
      averageEntryPrice: number;
      totalProfit: number;
      totalReturnPct: number;
    }
  | {
      ok: false;
      errors: AccumulatedPositionErrors;
    };

export function parseLeverage(value: string) {
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");

  if (!normalized) {
    return null;
  }

  const ratioMatch = normalized.match(/^(\d+(?:\.\d+)?)(?::|\/)(\d+(?:\.\d+)?)$/);

  if (ratioMatch) {
    const first = Number(ratioMatch[1]);
    const second = Number(ratioMatch[2]);

    if (!Number.isFinite(first) || !Number.isFinite(second) || first <= 0 || second <= 0) {
      return null;
    }

    if (first === 1) {
      return second;
    }

    if (second === 1) {
      return first;
    }

    return second / first;
  }

  const numeric = Number(normalized);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return numeric;
}

function validatePositive(value: number, label: string) {
  if (!Number.isFinite(value)) {
    return `${label} трябва да е число.`;
  }

  if (value <= 0) {
    return `${label} трябва да е над 0.`;
  }

  return null;
}

function validateNonNegative(value: number | undefined, label: string) {
  if (value === undefined) {
    return null;
  }

  if (!Number.isFinite(value)) {
    return `${label} трябва да е число.`;
  }

  if (value < 0) {
    return `${label} трябва да е 0 или повече.`;
  }

  return null;
}

export function calculateLeverageRisk(input: LeverageRiskInput): LeverageRiskResult {
  const errors: LeverageRiskErrors = {};

  const accountBalanceError = validatePositive(input.accountBalance, "Балансът");
  const entryPriceError = validatePositive(input.entryPrice, "Цената на вход");
  const quantityError = validatePositive(input.quantity, "Броят акции");
  const stopOutError = validatePositive(input.stopOutLevelPercent, "Stop-out процентът");
  const fxRateError = validatePositive(input.fxRateInstrumentToAccount, "FX курсът");
  const currentPriceError = validateNonNegative(input.currentPrice, "Текущата цена");

  if (input.direction !== "buy" && input.direction !== "sell") {
    errors.direction = "Посоката трябва да е BUY или SELL.";
  }

  if (
    input.marginMode !== "account_leverage" &&
    input.marginMode !== "fixed_leverage" &&
    input.marginMode !== "real_broker_margin"
  ) {
    errors.marginMode = "Избери валиден режим на маржин.";
  }

  if (accountBalanceError) {
    errors.accountBalance = accountBalanceError;
  }

  if (input.marginMode === "account_leverage") {
    const accountLeverageError = validatePositive(
      input.accountLeverage ?? Number.NaN,
      "Account leverage",
    );

    if (accountLeverageError) {
      errors.accountLeverage = accountLeverageError;
    }
  }

  if (input.marginMode === "fixed_leverage") {
    const fixedLeverageError = validatePositive(
      input.fixedLeverage ?? Number.NaN,
      "Fixed leverage",
    );

    if (fixedLeverageError) {
      errors.fixedLeverage = fixedLeverageError;
    }
  }

  if (input.marginMode === "real_broker_margin") {
    const usedMarginError = validatePositive(input.usedMargin ?? Number.NaN, "Used Margin");
    const temporaryFixedLeverageError = validatePositive(
      input.temporaryFixedLeverage ?? Number.NaN,
      "Временният leverage",
    );

    if (input.equity !== undefined) {
      const equityError = validatePositive(input.equity, "Equity");

      if (equityError) {
        errors.equity = equityError;
      }
    }

    if (usedMarginError) {
      errors.usedMargin = usedMarginError;
    }

    if (temporaryFixedLeverageError) {
      errors.temporaryFixedLeverage = temporaryFixedLeverageError;
    }
  }

  if (entryPriceError) {
    errors.entryPrice = entryPriceError;
  }

  if (quantityError) {
    errors.quantity = quantityError;
  }

  if (stopOutError) {
    errors.stopOutLevelPercent = stopOutError;
  }

  if (fxRateError) {
    errors.fxRateInstrumentToAccount = fxRateError;
  }

  if (currentPriceError) {
    errors.currentPrice = currentPriceError;
  }

  if (!Number.isFinite(input.plannedExitPrice) || input.plannedExitPrice < 0) {
    errors.plannedExitPrice = "Планираната цена на изход трябва да е 0 или повече.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const positionValueInstrument = input.entryPrice * input.quantity;
  const positionValueAccount = positionValueInstrument * input.fxRateInstrumentToAccount;
  const requiredMargin =
    input.marginMode === "account_leverage"
      ? positionValueAccount / Number(input.accountLeverage)
      : input.marginMode === "fixed_leverage"
        ? positionValueAccount / Number(input.fixedLeverage)
        : Number(input.usedMargin);
  const grossProfitInstrument =
    input.direction === "buy"
      ? (input.plannedExitPrice - input.entryPrice) * input.quantity
      : (input.entryPrice - input.plannedExitPrice) * input.quantity;
  const grossProfitAccount = grossProfitInstrument * input.fxRateInstrumentToAccount;
  const currentProfitInstrument =
    input.currentPrice === undefined
      ? undefined
      : input.direction === "buy"
        ? (input.currentPrice - input.entryPrice) * input.quantity
        : (input.entryPrice - input.currentPrice) * input.quantity;
  const currentProfitAccount =
    currentProfitInstrument === undefined
      ? undefined
      : currentProfitInstrument * input.fxRateInstrumentToAccount;
  const equitySource: EquitySource =
    input.equity !== undefined
      ? "manual_equity"
      : currentProfitAccount !== undefined
        ? "floating_pnl"
        : "account_balance";
  const resolvedEquity =
    input.equity ?? (currentProfitAccount !== undefined
      ? input.accountBalance + currentProfitAccount
      : input.accountBalance);
  const freeMargin = resolvedEquity - requiredMargin;
  const marginLevel = (resolvedEquity / requiredMargin) * 100;
  const effectiveLeverage = positionValueAccount / requiredMargin;
  const stopOutPriceBasis = input.currentPrice ?? input.entryPrice;

  const buildStopOutScenario = (usedMargin: number): StopOutScenario => {
    const stopOutEquity = usedMargin * (input.stopOutLevelPercent / 100);
    const availableLossAccount = resolvedEquity - stopOutEquity;
    const lossPerUnitAccount = availableLossAccount / input.quantity;
    const lossPerUnitInstrument = lossPerUnitAccount / input.fxRateInstrumentToAccount;
    const autoClosePrice =
      input.direction === "buy"
        ? stopOutPriceBasis - lossPerUnitInstrument
        : stopOutPriceBasis + lossPerUnitInstrument;

    return {
      usedMargin,
      stopOutEquity,
      availableLossAccount,
      lossPerUnitAccount,
      lossPerUnitInstrument,
      autoClosePrice,
      displayAutoClosePrice: Math.max(0, autoClosePrice),
      autoCloseBelowZero: input.direction === "buy" && autoClosePrice < 0,
      effectiveLeverage: positionValueAccount / usedMargin,
      isStopOutRiskActive: availableLossAccount < 0,
    };
  };

  const normalStopOut = buildStopOutScenario(requiredMargin);
  const stopOutRange =
    input.marginMode === "real_broker_margin"
      ? {
          normal: normalStopOut,
          temporary: {
            ...buildStopOutScenario(positionValueAccount / Number(input.temporaryFixedLeverage)),
            leverage: Number(input.temporaryFixedLeverage),
          },
        }
      : undefined;

  return {
    ok: true,
    input,
    positionValueInstrument,
    positionValueAccount,
    requiredMargin,
    freeMargin,
    marginLevel,
    effectiveLeverage,
    positionAllowed: requiredMargin <= resolvedEquity + Number.EPSILON,
    resolvedEquity,
    equitySource,
    stopOutPriceBasis,
    stopOutEquity: normalStopOut.stopOutEquity,
    maxLossAccount: normalStopOut.availableLossAccount,
    maxLossPerUnitAccount: normalStopOut.lossPerUnitAccount,
    maxLossPerUnitInstrument: normalStopOut.lossPerUnitInstrument,
    autoClosePrice: normalStopOut.autoClosePrice,
    displayAutoClosePrice: normalStopOut.displayAutoClosePrice,
    autoCloseBelowZero: normalStopOut.autoCloseBelowZero,
    stopOutRange,
    grossProfitInstrument,
    grossProfitAccount,
    returnPercentOnBalance: (grossProfitAccount / input.accountBalance) * 100,
    currentProfitInstrument,
    currentProfitAccount,
  };
}

export function calculatePartialSales(input: PartialSalesInput): PartialSalesResult {
  const errors: PartialSalesErrors = {};
  const lotErrors: string[] = [];

  if (input.lots.length === 0) {
    lotErrors.push("Добави поне една покупка/продажба.");
  }

  for (const [index, lot] of input.lots.entries()) {
    const lotNumber = index + 1;
    const entryPriceError = validatePositive(lot.entryPrice, `Цената на покупка ${lotNumber}`);
    const ownedSharesError = validatePositive(lot.ownedShares, `Купените акции в ред ${lotNumber}`);
    const sharesToSellError = validatePositive(
      lot.sharesToSell,
      `Продаваните акции в ред ${lotNumber}`,
    );

    if (entryPriceError) {
      lotErrors[index] = entryPriceError;
      continue;
    }

    if (ownedSharesError) {
      lotErrors[index] = ownedSharesError;
      continue;
    }

    if (sharesToSellError) {
      lotErrors[index] = sharesToSellError;
      continue;
    }

    if (!Number.isFinite(lot.exitPrice) || lot.exitPrice < 0) {
      lotErrors[index] = `Цената на продажба в ред ${lotNumber} трябва да е 0 или повече.`;
      continue;
    }

    if (lot.sharesToSell > lot.ownedShares + Number.EPSILON) {
      lotErrors[index] = `В ред ${lotNumber} продаваш повече акции, отколкото са купени.`;
    }
  }

  if (lotErrors.length > 0) {
    errors.lots = lotErrors;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const saleResults = input.lots.map((lot, index) => {
    const costBasisSold = lot.entryPrice * lot.sharesToSell;
    const saleValue = lot.exitPrice * lot.sharesToSell;

    return {
      ...lot,
      index,
      profit: saleValue - costBasisSold,
      costBasisSold,
      saleValue,
      remainingSharesAfter: lot.ownedShares - lot.sharesToSell,
    };
  });
  const totalOwnedShares = input.lots.reduce((total, lot) => total + lot.ownedShares, 0);
  const soldShares = saleResults.reduce((total, sale) => total + sale.sharesToSell, 0);
  const remainingShares = saleResults.reduce((total, sale) => total + sale.remainingSharesAfter, 0);
  const totalCostBasisSold = saleResults.reduce((total, sale) => total + sale.costBasisSold, 0);
  const totalSaleValue = saleResults.reduce((total, sale) => total + sale.saleValue, 0);
  const totalProfit = saleResults.reduce((total, sale) => total + sale.profit, 0);

  return {
    ok: true,
    input,
    saleResults,
    totalOwnedShares,
    soldShares,
    remainingShares,
    totalCostBasisSold,
    totalSaleValue,
    totalProfit,
  };
}

export function calculateAccumulatedPosition(
  input: AccumulatedPositionInput,
): AccumulatedPositionResult {
  const errors: AccumulatedPositionErrors = {};
  const lotErrors: string[] = [];

  if (input.lots.length === 0) {
    lotErrors.push("Добави поне една покупка.");
  }

  for (const [index, lot] of input.lots.entries()) {
    const lotNumber = index + 1;
    const entryPriceError = validatePositive(lot.entryPrice, `Цената в покупка ${lotNumber}`);
    const sharesError = validatePositive(lot.shares, `Акциите в покупка ${lotNumber}`);

    if (entryPriceError) {
      lotErrors[index] = entryPriceError;
      continue;
    }

    if (sharesError) {
      lotErrors[index] = sharesError;
    }
  }

  if (!Number.isFinite(input.targetExitPrice) || input.targetExitPrice < 0) {
    errors.targetExitPrice = "Целевата продажна цена трябва да е 0 или повече.";
  }

  if (lotErrors.length > 0) {
    errors.lots = lotErrors;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const lotResults = input.lots.map((lot, index) => {
    const cost = lot.entryPrice * lot.shares;
    const profit = (input.targetExitPrice - lot.entryPrice) * lot.shares;

    return {
      ...lot,
      index,
      cost,
      profit,
      returnPct: (profit / cost) * 100,
    };
  });
  const totalShares = lotResults.reduce((total, lot) => total + lot.shares, 0);
  const totalCost = lotResults.reduce((total, lot) => total + lot.cost, 0);
  const totalProfit = lotResults.reduce((total, lot) => total + lot.profit, 0);

  return {
    ok: true,
    input,
    lotResults,
    totalShares,
    totalCost,
    averageEntryPrice: totalCost / totalShares,
    totalProfit,
    totalReturnPct: (totalProfit / totalCost) * 100,
  };
}
