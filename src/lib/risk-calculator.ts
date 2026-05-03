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

export type ReverseLeverageRiskInput = {
  side: PositionSide;
  maxRisk: number;
  leverage: number;
  entryPrice: number;
  stopPrice: number;
  exitPrice: number;
};

export type ReverseLeverageRiskErrors = Partial<Record<keyof ReverseLeverageRiskInput, string>>;

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

export type ReverseLeverageRiskResult =
  | {
      ok: true;
      input: ReverseLeverageRiskInput;
      riskPerShare: number;
      sharesByRisk: number;
      sharesByMargin: number;
      recommendedShares: number;
      limitingFactor: "risk" | "margin";
      notional: number;
      requiredMargin: number;
      lossAtStop: number;
      expectedProfit: number;
      expectedReturnPct: number;
    }
  | {
      ok: false;
      errors: ReverseLeverageRiskErrors;
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

export function calculateReverseLeverageRisk(
  input: ReverseLeverageRiskInput,
): ReverseLeverageRiskResult {
  const errors: ReverseLeverageRiskErrors = {};

  const maxRiskError = validatePositive(input.maxRisk, "Максималният риск");
  const leverageError = validatePositive(input.leverage, "Ливъриджът");
  const entryPriceError = validatePositive(input.entryPrice, "Цената на вход");
  const stopPriceError = validatePositive(input.stopPrice, "Цената на стоп/затваряне");

  if (input.side !== "long" && input.side !== "short") {
    errors.side = "Посоката трябва да е Long или Short.";
  }

  if (maxRiskError) {
    errors.maxRisk = maxRiskError;
  }

  if (leverageError) {
    errors.leverage = leverageError;
  }

  if (entryPriceError) {
    errors.entryPrice = entryPriceError;
  }

  if (stopPriceError) {
    errors.stopPrice = stopPriceError;
  }

  if (!Number.isFinite(input.exitPrice) || input.exitPrice < 0) {
    errors.exitPrice = "Планираната цена на изход трябва да е 0 или повече.";
  }

  if (!errors.entryPrice && !errors.stopPrice) {
    if (input.side === "long" && input.stopPrice >= input.entryPrice) {
      errors.stopPrice = "При Long стоп/затваряне трябва да е под входната цена.";
    }

    if (input.side === "short" && input.stopPrice <= input.entryPrice) {
      errors.stopPrice = "При Short стоп/затваряне трябва да е над входната цена.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const riskPerShare = Math.abs(input.entryPrice - input.stopPrice);
  const sharesByRisk = input.maxRisk / riskPerShare;
  const sharesByMargin = (input.maxRisk * input.leverage) / input.entryPrice;
  const recommendedShares = Math.min(sharesByRisk, sharesByMargin);
  const limitingFactor = sharesByRisk <= sharesByMargin ? "risk" : "margin";
  const notional = recommendedShares * input.entryPrice;
  const requiredMargin = notional / input.leverage;
  const lossAtStop = recommendedShares * riskPerShare;
  const expectedProfit =
    input.side === "long"
      ? (input.exitPrice - input.entryPrice) * recommendedShares
      : (input.entryPrice - input.exitPrice) * recommendedShares;
  const expectedReturnPct = (expectedProfit / input.maxRisk) * 100;

  return {
    ok: true,
    input,
    riskPerShare,
    sharesByRisk,
    sharesByMargin,
    recommendedShares,
    limitingFactor,
    notional,
    requiredMargin,
    lossAtStop,
    expectedProfit,
    expectedReturnPct,
  };
}
