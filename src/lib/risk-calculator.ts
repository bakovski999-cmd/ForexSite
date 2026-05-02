export type LeverageRiskInput = {
  investedAmount: number;
  leverage: number;
  buyPrice: number;
  shares: number;
  plannedSellPrice: number;
};

export type LeverageRiskErrors = Partial<Record<keyof LeverageRiskInput, string>>;

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
      liquidationDrop: number;
      liquidationDropPct: number;
      liquidationBelowZero: boolean;
      expectedProfit: number;
      expectedReturnPct: number;
    }
  | {
      ok: false;
      errors: LeverageRiskErrors;
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
  const buyPriceError = validatePositive(input.buyPrice, "Цената на покупка");
  const sharesError = validatePositive(input.shares, "Броят акции");

  if (investedAmountError) {
    errors.investedAmount = investedAmountError;
  }

  if (leverageError) {
    errors.leverage = leverageError;
  }

  if (buyPriceError) {
    errors.buyPrice = buyPriceError;
  }

  if (sharesError) {
    errors.shares = sharesError;
  }

  if (!Number.isFinite(input.plannedSellPrice) || input.plannedSellPrice < 0) {
    errors.plannedSellPrice = "Планираната продажна цена трябва да е 0 или повече.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const notional = input.buyPrice * input.shares;
  const requiredMargin = notional / input.leverage;
  const maxNotional = input.investedAmount * input.leverage;
  const maxShares = maxNotional / input.buyPrice;
  const marginBuffer = input.investedAmount - requiredMargin;
  const marginUsagePct = (requiredMargin / input.investedAmount) * 100;
  const liquidationPrice = input.buyPrice - input.investedAmount / input.shares;
  const displayLiquidationPrice = Math.max(0, liquidationPrice);
  const liquidationDrop = input.buyPrice - liquidationPrice;
  const liquidationDropPct = (liquidationDrop / input.buyPrice) * 100;
  const expectedProfit = (input.plannedSellPrice - input.buyPrice) * input.shares;
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
    liquidationDrop,
    liquidationDropPct,
    liquidationBelowZero: liquidationPrice < 0,
    expectedProfit,
    expectedReturnPct,
  };
}
