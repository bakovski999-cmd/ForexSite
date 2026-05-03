export type PositionSide = "long" | "short";

export type LeverageRiskInput = {
  side: PositionSide;
  investedAmount: number;
  leverage: number;
  entryPrice: number;
  shares: number;
  exitPrice: number;
};

export type LeverageRiskErrors = Partial<Record<keyof LeverageRiskInput, string>>;

export type PartialSaleLegInput = {
  shares: number;
  exitPrice: number;
};

export type PartialSalesInput = {
  entryPrice: number;
  totalShares: number;
  sales: PartialSaleLegInput[];
};

export type PartialSalesErrors = Partial<
  Record<"entryPrice" | "totalShares" | "totalSold", string>
> & {
  sales?: string[];
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
      notional: number;
      requiredMargin: number;
      maxNotional: number;
      maxShares: number;
      marginBuffer: number;
      marginUsagePct: number;
      positionAllowed: boolean;
      liquidationPrice: number;
      displayLiquidationPrice: number;
      liquidationMove: number;
      liquidationMovePct: number;
      liquidationBelowZero: boolean;
      expectedProfit: number;
      expectedReturnPct: number;
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
        PartialSaleLegInput & {
          index: number;
          profit: number;
          remainingSharesAfter: number;
        }
      >;
      soldShares: number;
      remainingShares: number;
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

export function calculateLeverageRisk(input: LeverageRiskInput): LeverageRiskResult {
  const errors: LeverageRiskErrors = {};

  const investedAmountError = validatePositive(input.investedAmount, "Сумата");
  const leverageError = validatePositive(input.leverage, "Ливъриджът");
  const entryPriceError = validatePositive(input.entryPrice, "Цената на вход");
  const sharesError = validatePositive(input.shares, "Броят акции");

  if (input.side !== "long" && input.side !== "short") {
    errors.side = "Посоката трябва да е Long или Short.";
  }

  if (investedAmountError) {
    errors.investedAmount = investedAmountError;
  }

  if (leverageError) {
    errors.leverage = leverageError;
  }

  if (entryPriceError) {
    errors.entryPrice = entryPriceError;
  }

  if (sharesError) {
    errors.shares = sharesError;
  }

  if (!Number.isFinite(input.exitPrice) || input.exitPrice < 0) {
    errors.exitPrice = "Планираната цена на изход трябва да е 0 или повече.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const notional = input.entryPrice * input.shares;
  const requiredMargin = notional / input.leverage;
  const maxNotional = input.investedAmount * input.leverage;
  const maxShares = maxNotional / input.entryPrice;
  const marginBuffer = input.investedAmount - requiredMargin;
  const marginUsagePct = (requiredMargin / input.investedAmount) * 100;
  const liquidationMove = input.investedAmount / input.shares;
  const liquidationPrice =
    input.side === "long" ? input.entryPrice - liquidationMove : input.entryPrice + liquidationMove;
  const displayLiquidationPrice = Math.max(0, liquidationPrice);
  const liquidationMovePct = (liquidationMove / input.entryPrice) * 100;
  const expectedProfit =
    input.side === "long"
      ? (input.exitPrice - input.entryPrice) * input.shares
      : (input.entryPrice - input.exitPrice) * input.shares;
  const expectedReturnPct = (expectedProfit / input.investedAmount) * 100;

  return {
    ok: true,
    input,
    notional,
    requiredMargin,
    maxNotional,
    maxShares,
    marginBuffer,
    marginUsagePct,
    positionAllowed: requiredMargin <= input.investedAmount + Number.EPSILON,
    liquidationPrice,
    displayLiquidationPrice,
    liquidationMove,
    liquidationMovePct,
    liquidationBelowZero: input.side === "long" && liquidationPrice < 0,
    expectedProfit,
    expectedReturnPct,
  };
}

export function calculatePartialSales(input: PartialSalesInput): PartialSalesResult {
  const errors: PartialSalesErrors = {};
  const saleErrors: string[] = [];

  const entryPriceError = validatePositive(input.entryPrice, "Цената на вход");
  const totalSharesError = validatePositive(input.totalShares, "Общият брой акции");

  if (entryPriceError) {
    errors.entryPrice = entryPriceError;
  }

  if (totalSharesError) {
    errors.totalShares = totalSharesError;
  }

  if (input.sales.length === 0) {
    saleErrors.push("Добави поне една продажба.");
  }

  for (const [index, sale] of input.sales.entries()) {
    const saleNumber = index + 1;
    const sharesError = validatePositive(sale.shares, `Акциите в продажба ${saleNumber}`);

    if (sharesError) {
      saleErrors[index] = sharesError;
      continue;
    }

    if (!Number.isFinite(sale.exitPrice) || sale.exitPrice < 0) {
      saleErrors[index] = `Цената в продажба ${saleNumber} трябва да е 0 или повече.`;
    }
  }

  const soldShares = input.sales.reduce((total, sale) => total + sale.shares, 0);

  if (Number.isFinite(input.totalShares) && soldShares > input.totalShares + Number.EPSILON) {
    errors.totalSold = "Продадените акции са повече от общо купените акции.";
  }

  if (saleErrors.length > 0) {
    errors.sales = saleErrors;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  let remainingShares = input.totalShares;
  const saleResults = input.sales.map((sale, index) => {
    remainingShares -= sale.shares;

    return {
      ...sale,
      index,
      profit: (sale.exitPrice - input.entryPrice) * sale.shares,
      remainingSharesAfter: remainingShares,
    };
  });
  const totalProfit = saleResults.reduce((total, sale) => total + sale.profit, 0);

  return {
    ok: true,
    input,
    saleResults,
    soldShares,
    remainingShares,
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
