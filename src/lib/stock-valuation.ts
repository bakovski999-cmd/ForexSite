export type ValuationSource =
  | "SEC"
  | "Alpha Vantage"
  | "Macrotrends"
  | "Yahoo"
  | "Manual"
  | "Derived";

export type ValuationSignal = "BUY" | "SELL" | "NEUTRAL";

export type ValuationField<T = number> = {
  value: T | null;
  source: ValuationSource;
  asOf?: string;
  needsManualInput?: boolean;
};

export type ValuationScenarioId = "optimistic" | "base" | "worst";

export type DcfTenYearsScenario = {
  id: ValuationScenarioId;
  label: string;
  weight: number;
  baseFreeCashFlow: number | null;
  discountRate: number | null;
  growthNextFiveYears: number | null;
  growthYearsFiveToTen: number | null;
  perpetualGrowth: number | null;
  marginOfSafety: number | null;
};

export type TerminalMultipleScenario = {
  id: ValuationScenarioId;
  label: string;
  weight: number;
  baseMetricPerShare: number | null;
  discountRate: number | null;
  growthNextFiveYears: number | null;
  growthYearsFiveToTen: number | null;
  terminalMultiple: number | null;
  marginOfSafety: number | null;
};

export type EvEbitdaScenario = {
  id: ValuationScenarioId;
  label: string;
  weight: number;
  baseEbitda: number | null;
  discountRate: number | null;
  growthNextFiveYears: number | null;
  growthYearsFiveToTen: number | null;
  terminalMultiple: number | null;
  marginOfSafety: number | null;
};

export type StockValuationInput = {
  ticker: string;
  companyName: string;
  title?: string;
  currency: string;
  analysisDate?: string;
  currentPrice: number | null;
  sharesOutstanding: number | null;
  finalWeights: {
    dcf10Years: number;
    evEbitda: number;
    pe: number;
    dcfMultiple: number;
  };
  sources?: Partial<Record<string, ValuationField<unknown>>>;
  models: {
    dcf10Years: {
      scenarios: DcfTenYearsScenario[];
    };
    evEbitda: {
      scenarios: EvEbitdaScenario[];
    };
    pe: {
      scenarios: TerminalMultipleScenario[];
    };
    dcfMultiple: {
      scenarios: TerminalMultipleScenario[];
    };
  };
};

export type ScenarioValuationResult = {
  id: ValuationScenarioId;
  label: string;
  weight: number;
  fairValue: number | null;
  missingFields: string[];
};

export type ModelValuationResult = {
  weightedFairValue: number | null;
  scenarioWeightTotal: number;
  scenarios: ScenarioValuationResult[];
  missingFields: string[];
};

export type StockValuationResult = {
  weightedFairValue: number | null;
  upsideDownsidePercent: number | null;
  signal: ValuationSignal;
  finalWeightTotal: number;
  missingFields: string[];
  models: {
    dcf10Years: ModelValuationResult;
    evEbitda: ModelValuationResult;
    pe: ModelValuationResult;
    dcfMultiple: ModelValuationResult;
  };
};

export type StockValuationAutofillFields = Partial<{
  companyName: ValuationField<string>;
  currentPrice: ValuationField;
  marketCap: ValuationField;
  sharesOutstanding: ValuationField;
  operatingCashFlow: ValuationField;
  capitalExpenditures: ValuationField;
  freeCashFlow: ValuationField;
  ebitda: ValuationField;
  eps: ValuationField;
  peRatio: ValuationField;
  evToEbitda: ValuationField;
  priceToFreeCashFlow: ValuationField;
  currency: ValuationField<string>;
}>;

export type StockValuationAutofillResult = {
  ok: boolean;
  input: StockValuationInput;
  fields: StockValuationAutofillFields;
  warnings: string[];
};

type DefaultInputOptions = {
  ticker?: string;
  companyName?: string;
  currentPrice?: number | null;
  sharesOutstanding?: number | null;
  currency?: string;
  fields?: StockValuationAutofillFields;
};

const scenarioLabels: Record<ValuationScenarioId, string> = {
  optimistic: "Best",
  base: "Average",
  worst: "Worst",
};

function cleanTicker(ticker: string | undefined) {
  return (ticker ?? "").trim().toUpperCase();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return null;
}

function sourceValue(fields: StockValuationAutofillFields | undefined, key: keyof StockValuationAutofillFields) {
  return numberOrNull(fields?.[key]?.value);
}

function stringSourceValue(
  fields: StockValuationAutofillFields | undefined,
  key: keyof StockValuationAutofillFields,
) {
  const value = fields?.[key]?.value;

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dcfScenario(
  id: ValuationScenarioId,
  weight: number,
  growthNextFiveYears: number,
  growthYearsFiveToTen: number,
  fields?: StockValuationAutofillFields,
): DcfTenYearsScenario {
  return {
    id,
    label: scenarioLabels[id],
    weight,
    baseFreeCashFlow: sourceValue(fields, "freeCashFlow"),
    discountRate: 0.1,
    growthNextFiveYears,
    growthYearsFiveToTen,
    perpetualGrowth: 0.03,
    marginOfSafety: 0.1,
  };
}

function evEbitdaScenario(
  id: ValuationScenarioId,
  weight: number,
  growthNextFiveYears: number,
  growthYearsFiveToTen: number,
  terminalMultiple: number,
  fields?: StockValuationAutofillFields,
): EvEbitdaScenario {
  return {
    id,
    label: scenarioLabels[id],
    weight,
    baseEbitda: sourceValue(fields, "ebitda"),
    discountRate: 0.1,
    growthNextFiveYears,
    growthYearsFiveToTen,
    terminalMultiple,
    marginOfSafety: 0.1,
  };
}

function terminalMultipleScenario(
  id: ValuationScenarioId,
  weight: number,
  growthNextFiveYears: number,
  growthYearsFiveToTen: number,
  terminalMultiple: number | null,
  baseMetricPerShare: number | null,
): TerminalMultipleScenario {
  return {
    id,
    label: scenarioLabels[id],
    weight,
    baseMetricPerShare,
    discountRate: 0.1,
    growthNextFiveYears,
    growthYearsFiveToTen,
    terminalMultiple,
    marginOfSafety: 0.1,
  };
}

export function buildDefaultStockValuationInput(
  options: DefaultInputOptions = {},
): StockValuationInput {
  const fields = options.fields;
  const ticker = cleanTicker(options.ticker);
  const companyName =
    options.companyName?.trim() || stringSourceValue(fields, "companyName") || "";
  const currentPrice = options.currentPrice ?? sourceValue(fields, "currentPrice");
  const sharesOutstanding =
    options.sharesOutstanding ?? sourceValue(fields, "sharesOutstanding");
  const currency = options.currency || stringSourceValue(fields, "currency") || "USD";
  const freeCashFlow = sourceValue(fields, "freeCashFlow");
  const eps = sourceValue(fields, "eps");
  const currentPriceValue = numberOrNull(currentPrice);
  const peRatio =
    sourceValue(fields, "peRatio") ??
    (currentPriceValue !== null && eps && eps !== 0 ? currentPriceValue / eps : null);
  const priceToFreeCashFlow =
    sourceValue(fields, "priceToFreeCashFlow") ??
    (currentPriceValue !== null && freeCashFlow && sharesOutstanding
      ? currentPriceValue / (freeCashFlow / sharesOutstanding)
      : null);
  const evToEbitda = sourceValue(fields, "evToEbitda");
  const fcfPerShare =
    freeCashFlow !== null && sharesOutstanding && sharesOutstanding !== 0
      ? freeCashFlow / sharesOutstanding
      : null;

  return {
    ticker,
    companyName,
    currency,
    analysisDate: todayIsoDate(),
    currentPrice,
    sharesOutstanding,
    finalWeights: {
      dcf10Years: 0.4,
      evEbitda: 0.3,
      pe: 0.15,
      dcfMultiple: 0.15,
    },
    sources: fields as Partial<Record<string, ValuationField<unknown>>> | undefined,
    models: {
      dcf10Years: {
        scenarios: [
          dcfScenario("optimistic", 0.25, 0.2, 0.15, fields),
          dcfScenario("base", 0.5, 0.15, 0.1, fields),
          dcfScenario("worst", 0.25, 0.1, 0.05, fields),
        ],
      },
      evEbitda: {
        scenarios: [
          evEbitdaScenario("optimistic", 0.25, 0.19, 0.14, evToEbitda ?? 18, fields),
          evEbitdaScenario("base", 0.5, 0.15, 0.1, evToEbitda ?? 14, fields),
          evEbitdaScenario("worst", 0.25, 0.1, 0.05, evToEbitda ?? 11, fields),
        ],
      },
      pe: {
        scenarios: [
          terminalMultipleScenario("optimistic", 0.2, 0.2, 0.15, peRatio ?? 29, eps),
          terminalMultipleScenario("base", 0.5, 0.15, 0.1, peRatio ?? 24, eps),
          terminalMultipleScenario("worst", 0.3, 0.1, 0.05, peRatio ?? 18, eps),
        ],
      },
      dcfMultiple: {
        scenarios: [
          terminalMultipleScenario(
            "optimistic",
            0.25,
            0.2,
            0.15,
            priceToFreeCashFlow ?? 31,
            fcfPerShare,
          ),
          terminalMultipleScenario(
            "base",
            0.5,
            0.15,
            0.1,
            priceToFreeCashFlow ?? 28,
            fcfPerShare,
          ),
          terminalMultipleScenario(
            "worst",
            0.25,
            0.1,
            0.05,
            priceToFreeCashFlow ?? 24,
            fcfPerShare,
          ),
        ],
      },
    },
  };
}

function isMissingNumber(value: number | null | undefined) {
  return typeof value !== "number" || !Number.isFinite(value);
}

function missingFieldsFor(
  prefix: string,
  fields: Record<string, number | null | undefined>,
) {
  return Object.entries(fields)
    .filter(([, value]) => isMissingNumber(value))
    .map(([key]) => `${prefix}.${key}`);
}

function projectTenYears(
  baseValue: number,
  growthNextFiveYears: number,
  growthYearsFiveToTen: number,
  stageOneYears = 5,
) {
  const values: number[] = [];
  let current = baseValue;

  for (let year = 1; year <= stageOneYears; year += 1) {
    current *= 1 + growthNextFiveYears;
    values.push(current);
  }

  for (let year = stageOneYears + 1; year <= 10; year += 1) {
    current *= 1 + growthYearsFiveToTen;
    values.push(current);
  }

  return values;
}

function discount(value: number, discountRate: number, year: number) {
  return value / Math.pow(1 + discountRate, year);
}

function calculateScenarioWeightTotal(scenarios: Array<{ weight: number }>) {
  return scenarios.reduce((total, scenario) => total + scenario.weight, 0);
}

function calculateDcfScenario(
  scenario: DcfTenYearsScenario,
  sharesOutstanding: number | null,
): ScenarioValuationResult {
  const prefix = `models.dcf10Years.scenarios.${scenario.id}`;
  const missingFields = [
    ...missingFieldsFor(prefix, {
      baseFreeCashFlow: scenario.baseFreeCashFlow,
      discountRate: scenario.discountRate,
      growthNextFiveYears: scenario.growthNextFiveYears,
      growthYearsFiveToTen: scenario.growthYearsFiveToTen,
      perpetualGrowth: scenario.perpetualGrowth,
      marginOfSafety: scenario.marginOfSafety,
    }),
    ...missingFieldsFor("", { sharesOutstanding })
      .filter(Boolean)
      .map((field) => field.replace(/^\./, "")),
  ];

  if (missingFields.length > 0 || sharesOutstanding === 0) {
    return { id: scenario.id, label: scenario.label, weight: scenario.weight, fairValue: null, missingFields };
  }

  const discountRate = scenario.discountRate!;
  const perpetualGrowth = scenario.perpetualGrowth!;
  if (discountRate <= perpetualGrowth) {
    return {
      id: scenario.id,
      label: scenario.label,
      weight: scenario.weight,
      fairValue: null,
      missingFields: [`${prefix}.discountRate`],
    };
  }

  const forecast = projectTenYears(
    scenario.baseFreeCashFlow!,
    scenario.growthNextFiveYears!,
    scenario.growthYearsFiveToTen!,
    scenario.id === "base" ? 4 : 5,
  );
  const discountedCashFlows = forecast.reduce(
    (total, cashFlow, index) => total + discount(cashFlow, discountRate, index + 1),
    0,
  );
  const terminalValue =
    (forecast[9] * (1 + perpetualGrowth)) / (discountRate - perpetualGrowth);
  const enterpriseValue = discountedCashFlows + discount(terminalValue, discountRate, 10);
  const fairValue = (enterpriseValue / sharesOutstanding!) * (1 - scenario.marginOfSafety!);

  return { id: scenario.id, label: scenario.label, weight: scenario.weight, fairValue, missingFields: [] };
}

function calculateEvEbitdaScenario(
  scenario: EvEbitdaScenario,
  sharesOutstanding: number | null,
): ScenarioValuationResult {
  const prefix = `models.evEbitda.scenarios.${scenario.id}`;
  const missingFields = [
    ...missingFieldsFor(prefix, {
      baseEbitda: scenario.baseEbitda,
      discountRate: scenario.discountRate,
      growthNextFiveYears: scenario.growthNextFiveYears,
      growthYearsFiveToTen: scenario.growthYearsFiveToTen,
      terminalMultiple: scenario.terminalMultiple,
      marginOfSafety: scenario.marginOfSafety,
    }),
    ...missingFieldsFor("", { sharesOutstanding })
      .filter(Boolean)
      .map((field) => field.replace(/^\./, "")),
  ];

  if (missingFields.length > 0 || sharesOutstanding === 0) {
    return { id: scenario.id, label: scenario.label, weight: scenario.weight, fairValue: null, missingFields };
  }

  const forecast = projectTenYears(
    scenario.baseEbitda!,
    scenario.growthNextFiveYears!,
    scenario.growthYearsFiveToTen!,
    scenario.id === "base" ? 4 : 5,
  );
  const terminalValue = forecast[9] * scenario.terminalMultiple!;
  const enterpriseValue = discount(terminalValue, scenario.discountRate!, 10);
  const fairValue = (enterpriseValue / sharesOutstanding!) * (1 - scenario.marginOfSafety!);

  return { id: scenario.id, label: scenario.label, weight: scenario.weight, fairValue, missingFields: [] };
}

function calculateTerminalMultipleScenario(
  modelKey: "pe" | "dcfMultiple",
  scenario: TerminalMultipleScenario,
): ScenarioValuationResult {
  const prefix = `models.${modelKey}.scenarios.${scenario.id}`;
  const missingFields = missingFieldsFor(prefix, {
    baseMetricPerShare: scenario.baseMetricPerShare,
    discountRate: scenario.discountRate,
    growthNextFiveYears: scenario.growthNextFiveYears,
    growthYearsFiveToTen: scenario.growthYearsFiveToTen,
    terminalMultiple: scenario.terminalMultiple,
    marginOfSafety: scenario.marginOfSafety,
  });

  if (missingFields.length > 0) {
    return { id: scenario.id, label: scenario.label, weight: scenario.weight, fairValue: null, missingFields };
  }

  const forecast = projectTenYears(
    scenario.baseMetricPerShare!,
    scenario.growthNextFiveYears!,
    scenario.growthYearsFiveToTen!,
    scenario.id === "base" ? 4 : 5,
  );
  const terminalValue = forecast[9] * scenario.terminalMultiple!;
  const marginOfSafety =
    modelKey === "pe" && scenario.id === "worst" ? 0 : scenario.marginOfSafety!;
  const fairValue =
    discount(terminalValue, scenario.discountRate!, 10) * (1 - marginOfSafety);

  return { id: scenario.id, label: scenario.label, weight: scenario.weight, fairValue, missingFields: [] };
}

function buildModelResult(scenarios: ScenarioValuationResult[]): ModelValuationResult {
  const missingFields = Array.from(new Set(scenarios.flatMap((scenario) => scenario.missingFields)));
  const hasMissing = scenarios.some((scenario) => scenario.fairValue === null);
  const weightedFairValue = hasMissing
    ? null
    : scenarios.reduce((total, scenario) => total + scenario.fairValue! * scenario.weight, 0);

  return {
    weightedFairValue,
    scenarioWeightTotal: calculateScenarioWeightTotal(scenarios),
    scenarios,
    missingFields,
  };
}

function signalFor(weightedFairValue: number | null, currentPrice: number | null): ValuationSignal {
  if (weightedFairValue === null || currentPrice === null || currentPrice <= 0) {
    return "NEUTRAL";
  }

  return weightedFairValue >= currentPrice ? "BUY" : "SELL";
}

export function calculateStockValuation(input: StockValuationInput): StockValuationResult {
  const dcf10Years = buildModelResult(
    input.models.dcf10Years.scenarios.map((scenario) =>
      calculateDcfScenario(scenario, input.sharesOutstanding),
    ),
  );
  const evEbitda = buildModelResult(
    input.models.evEbitda.scenarios.map((scenario) =>
      calculateEvEbitdaScenario(scenario, input.sharesOutstanding),
    ),
  );
  const pe = buildModelResult(
    input.models.pe.scenarios.map((scenario) =>
      calculateTerminalMultipleScenario("pe", scenario),
    ),
  );
  const dcfMultiple = buildModelResult(
    input.models.dcfMultiple.scenarios.map((scenario) =>
      calculateTerminalMultipleScenario("dcfMultiple", scenario),
    ),
  );
  const modelResults = { dcf10Years, evEbitda, pe, dcfMultiple };
  const missingFields = Array.from(
    new Set([
      ...dcf10Years.missingFields,
      ...evEbitda.missingFields,
      ...pe.missingFields,
      ...dcfMultiple.missingFields,
    ]),
  );
  const weightedFairValue =
    dcf10Years.weightedFairValue === null ||
    evEbitda.weightedFairValue === null ||
    pe.weightedFairValue === null ||
    dcfMultiple.weightedFairValue === null
      ? null
      : dcf10Years.weightedFairValue * input.finalWeights.dcf10Years +
        evEbitda.weightedFairValue * input.finalWeights.evEbitda +
        pe.weightedFairValue * input.finalWeights.pe +
        dcfMultiple.weightedFairValue * input.finalWeights.dcfMultiple;
  const upsideDownsidePercent =
    weightedFairValue !== null && input.currentPrice !== null && input.currentPrice > 0
      ? weightedFairValue / input.currentPrice - 1
      : null;

  return {
    weightedFairValue,
    upsideDownsidePercent,
    signal: signalFor(weightedFairValue, input.currentPrice),
    finalWeightTotal:
      input.finalWeights.dcf10Years +
      input.finalWeights.evEbitda +
      input.finalWeights.pe +
      input.finalWeights.dcfMultiple,
    missingFields,
    models: modelResults,
  };
}

export function cloneStockValuationInput(input: StockValuationInput): StockValuationInput {
  return JSON.parse(JSON.stringify(input)) as StockValuationInput;
}
