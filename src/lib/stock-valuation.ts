export type ValuationSource =
  | "SEC"
  | "SEC TTM"
  | "SEC FY"
  | "SEC IFRS"
  | "SEC IFRS + FX"
  | "Alpha Vantage"
  | "Macrotrends"
  | "IBKR"
  | "Yahoo"
  | "Yahoo TTM"
  | "Yahoo TTM + FX"
  | "Manual"
  | "Derived"
  | "FinanceCharts";

export type ValuationSignal = "BUY" | "SELL" | "NEUTRAL";

export type ValuationOriginalValue = {
  value: number;
  currency: string;
  unit?: "total" | "perShare";
};

export type ValuationFxConversion = {
  from: string;
  to: string;
  rate: number;
};

export type ValuationField<T = number> = {
  value: T | null;
  source: ValuationSource;
  asOf?: string;
  needsManualInput?: boolean;
  original?: ValuationOriginalValue;
  fx?: ValuationFxConversion;
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

export type HistoricalFreeCashFlowRow = {
  year: number | null;
  freeCashFlow: number | null;
  source?: ValuationSource;
  asOf?: string;
};

export type HistoricalFreeCashFlowCalculationRow = HistoricalFreeCashFlowRow & {
  label: string;
  slot: number;
  growthLabel: string | null;
  growthPercent: number | null;
};

export type HistoricalFreeCashFlowAverageCalculation = {
  rows: HistoricalFreeCashFlowCalculationRow[];
  averageFreeCashFlow: number | null;
  averageGrowthPercent: number | null;
  isPartialHistory: boolean;
  missingRows: number;
};

export type HistoricalMultipleKey =
  | "priceToFreeCashFlow"
  | "peRatio"
  | "evToEbitda";

export type HistoricalMultipleRow = {
  year: number | null;
  numerator: number | null;
  denominator: number | null;
  multiple: number | null;
  source?: ValuationSource;
  asOf?: string;
  needsReview?: boolean;
  reviewReason?: string;
};

export type HistoricalMultipleSeriesPoint = {
  date: string;
  year: number | null;
  numerator: number | null;
  denominator: number | null;
  multiple: number | null;
  source?: ValuationSource;
  asOf?: string;
  needsReview?: boolean;
  reviewReason?: string;
};

export type HistoricalMultipleCalculationRow = HistoricalMultipleRow & {
  usableForApply: boolean;
  ignoredReason: "missing" | "negative-or-zero" | "needs-review" | null;
};

export type HistoricalMultiplePeriodKey = "TTM" | "3Y" | "5Y" | "10Y" | "15Y" | "20Y";

export type HistoricalMultiplePeriodAverage = {
  key: HistoricalMultiplePeriodKey;
  label: string;
  years: number;
  average: number | null;
  count: number;
};

export type HistoricalMultipleChartSource = "FinanceCharts" | "Derived";

export type HistoricalMultipleSourceStatus =
  | "available"
  | "fallback"
  | "unavailable";

export type HistoricalMultipleBenchmark = {
  source: Extract<HistoricalMultipleChartSource, "FinanceCharts">;
  sourceStatus: Extract<HistoricalMultipleSourceStatus, "available" | "unavailable">;
  sourceMessage?: string;
  currentMultiple: number | null;
  low: number | null;
  average: number | null;
  high: number | null;
  periodAverages: HistoricalMultiplePeriodAverage[];
  seriesPoints: HistoricalMultipleSeriesPoint[];
};

export type HistoricalMultipleSummary = {
  key: HistoricalMultipleKey;
  source: HistoricalMultipleChartSource;
  sourceStatus: HistoricalMultipleSourceStatus;
  sourceMessage?: string;
  rows: HistoricalMultipleCalculationRow[];
  seriesPoints: HistoricalMultipleSeriesPoint[];
  currentMultiple: number | null;
  low: number | null;
  average: number | null;
  high: number | null;
  periodAverages: HistoricalMultiplePeriodAverage[];
  canApply: boolean;
  applyValues: Record<ValuationScenarioId, number> | null;
};

export type StockValuationInput = {
  ticker: string;
  companyName: string;
  title?: string;
  currency: string;
  analysisDate?: string;
  currentPrice: number | null;
  sharesOutstanding: number | null;
  historicalFreeCashFlows?: HistoricalFreeCashFlowRow[];
  historicalMultiples?: Partial<Record<HistoricalMultipleKey, HistoricalMultipleRow[]>>;
  historicalMultipleSeries?: Partial<
    Record<HistoricalMultipleKey, HistoricalMultipleSeriesPoint[]>
  >;
  historicalMultipleBenchmarks?: Partial<
    Record<HistoricalMultipleKey, HistoricalMultipleBenchmark>
  >;
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

export type FcfPerShareTtmCalculation = {
  freeCashFlow: number | null;
  sharesOutstanding: number | null;
  fcfPerShare: number | null;
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
  historicalFreeCashFlows?: HistoricalFreeCashFlowRow[];
  historicalMultiples?: Partial<Record<HistoricalMultipleKey, HistoricalMultipleRow[]>>;
  historicalMultipleSeries?: Partial<
    Record<HistoricalMultipleKey, HistoricalMultipleSeriesPoint[]>
  >;
  historicalMultipleBenchmarks?: Partial<
    Record<HistoricalMultipleKey, HistoricalMultipleBenchmark>
  >;
};

const historicalFreeCashFlowRowCount = 11;
const historicalMultipleRowCount = 20;

const historicalMultiplePeriods: Array<{
  key: HistoricalMultiplePeriodKey;
  years: number;
}> = [
  { key: "TTM", years: 1 },
  { key: "3Y", years: 3 },
  { key: "5Y", years: 5 },
  { key: "10Y", years: 10 },
  { key: "15Y", years: 15 },
  { key: "20Y", years: 20 },
];

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

function yearOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }

  return value >= 1900 && value <= 2200 ? value : null;
}

function dateOrNull(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function yearFromDate(date: string | null) {
  if (!date) {
    return null;
  }

  const year = Number(date.slice(0, 4));

  return Number.isInteger(year) ? yearOrNull(year) : null;
}

function normalizeHistoricalFreeCashFlowRows(
  rows: HistoricalFreeCashFlowRow[] | undefined,
) {
  return (rows ?? [])
    .map((row) => ({
      year: yearOrNull(row.year),
      freeCashFlow: numberOrNull(row.freeCashFlow),
      source: row.source,
      asOf: row.asOf,
    }))
    .filter((row) => row.year !== null || row.freeCashFlow !== null)
    .sort((first, second) => (second.year ?? -Infinity) - (first.year ?? -Infinity))
    .slice(0, historicalFreeCashFlowRowCount);
}

function normalizeHistoricalMultipleRows(rows: HistoricalMultipleRow[] | undefined) {
  return (rows ?? [])
    .map((row) => {
      const normalized: HistoricalMultipleRow = {
        year: yearOrNull(row.year),
        numerator: numberOrNull(row.numerator),
        denominator: numberOrNull(row.denominator),
        multiple: numberOrNull(row.multiple),
        source: row.source,
        asOf: row.asOf,
      };

      if (row.needsReview === true) {
        normalized.needsReview = true;
        normalized.reviewReason =
          typeof row.reviewReason === "string" ? row.reviewReason : undefined;
      }

      return normalized;
    })
    .filter(
      (row) =>
        row.year !== null ||
        row.numerator !== null ||
        row.denominator !== null ||
        row.multiple !== null,
    )
    .sort((first, second) => (second.year ?? -Infinity) - (first.year ?? -Infinity))
    .slice(0, historicalMultipleRowCount);
}

function normalizeHistoricalMultiples(
  historicalMultiples: Partial<Record<HistoricalMultipleKey, HistoricalMultipleRow[]>> | undefined,
) {
  if (!historicalMultiples) {
    return undefined;
  }

  return {
    priceToFreeCashFlow: normalizeHistoricalMultipleRows(
      historicalMultiples.priceToFreeCashFlow,
    ),
    peRatio: normalizeHistoricalMultipleRows(historicalMultiples.peRatio),
    evToEbitda: normalizeHistoricalMultipleRows(historicalMultiples.evToEbitda),
  };
}

function normalizeHistoricalMultipleSeriesPoints(
  points: HistoricalMultipleSeriesPoint[] | undefined,
) {
  return (points ?? [])
    .map((point) => {
      const date = dateOrNull(point.date);
      const normalized: HistoricalMultipleSeriesPoint = {
        date: date ?? point.date,
        year: yearOrNull(point.year) ?? yearFromDate(date),
        numerator: numberOrNull(point.numerator),
        denominator: numberOrNull(point.denominator),
        multiple: numberOrNull(point.multiple),
        source: point.source,
        asOf: point.asOf,
      };

      if (point.needsReview === true) {
        normalized.needsReview = true;
        normalized.reviewReason =
          typeof point.reviewReason === "string" ? point.reviewReason : undefined;
      }

      return normalized;
    })
    .filter(
      (point) =>
        dateOrNull(point.date) !== null ||
        point.numerator !== null ||
        point.denominator !== null ||
        point.multiple !== null,
    )
    .sort((first, second) => first.date.localeCompare(second.date));
}

function historicalMultipleRowsFromSeries(
  points: HistoricalMultipleSeriesPoint[],
): HistoricalMultipleRow[] {
  const byYear = new Map<
    number,
    { point: HistoricalMultipleSeriesPoint; score: number; timestamp: number }
  >();

  for (const point of points) {
    if (point.year === null) {
      continue;
    }

    const timestamp = Date.parse(point.date);
    const score =
      positiveMultiple(point.multiple) &&
      (point.denominator === null || point.denominator > 0)
        ? 2
        : point.numerator !== null || point.denominator !== null || point.multiple !== null
          ? 1
          : 0;
    const current = byYear.get(point.year);

    if (
      !current ||
      score > current.score ||
      (score === current.score &&
        Number.isFinite(timestamp) &&
        timestamp > current.timestamp)
    ) {
      byYear.set(point.year, {
        point,
        score,
        timestamp: Number.isFinite(timestamp) ? timestamp : -Infinity,
      });
    }
  }

  return [...byYear.values()]
    .map(({ point }) => ({
      year: point.year,
      numerator: point.numerator,
      denominator: point.denominator,
      multiple: point.multiple,
      source: point.source,
      asOf: point.date,
      ...(point.needsReview
        ? { needsReview: true, reviewReason: point.reviewReason }
        : {}),
    }))
    .sort((first, second) => (second.year ?? -Infinity) - (first.year ?? -Infinity))
    .slice(0, historicalMultipleRowCount);
}

function normalizeHistoricalMultipleSeries(
  historicalMultipleSeries:
    | Partial<Record<HistoricalMultipleKey, HistoricalMultipleSeriesPoint[]>>
    | undefined,
) {
  if (!historicalMultipleSeries) {
    return undefined;
  }

  return {
    priceToFreeCashFlow: normalizeHistoricalMultipleSeriesPoints(
      historicalMultipleSeries.priceToFreeCashFlow,
    ),
    peRatio: normalizeHistoricalMultipleSeriesPoints(historicalMultipleSeries.peRatio),
    evToEbitda: normalizeHistoricalMultipleSeriesPoints(
      historicalMultipleSeries.evToEbitda,
    ),
  };
}

function normalizeHistoricalMultipleBenchmark(
  benchmark: HistoricalMultipleBenchmark | undefined,
) {
  if (!benchmark) {
    return undefined;
  }

  const normalized: HistoricalMultipleBenchmark = {
    source: "FinanceCharts",
    sourceStatus: benchmark.sourceStatus === "available" ? "available" : "unavailable",
    currentMultiple: numberOrNull(benchmark.currentMultiple),
    low: numberOrNull(benchmark.low),
    average: numberOrNull(benchmark.average),
    high: numberOrNull(benchmark.high),
    periodAverages: (benchmark.periodAverages ?? []).map((period) => ({
      key: period.key,
      label: period.label || period.key,
      years: period.years,
      average: numberOrNull(period.average),
      count: Number.isFinite(period.count) ? period.count : 0,
    })),
    seriesPoints: normalizeHistoricalMultipleSeriesPoints(benchmark.seriesPoints),
  };

  if (typeof benchmark.sourceMessage === "string" && benchmark.sourceMessage.trim()) {
    normalized.sourceMessage = benchmark.sourceMessage.trim();
  }

  return normalized;
}

function normalizeHistoricalMultipleBenchmarks(
  historicalMultipleBenchmarks:
    | Partial<Record<HistoricalMultipleKey, HistoricalMultipleBenchmark>>
    | undefined,
) {
  if (!historicalMultipleBenchmarks) {
    return undefined;
  }

  return {
    priceToFreeCashFlow: normalizeHistoricalMultipleBenchmark(
      historicalMultipleBenchmarks.priceToFreeCashFlow,
    ),
    peRatio: normalizeHistoricalMultipleBenchmark(historicalMultipleBenchmarks.peRatio),
    evToEbitda: normalizeHistoricalMultipleBenchmark(
      historicalMultipleBenchmarks.evToEbitda,
    ),
  };
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
    historicalFreeCashFlows: normalizeHistoricalFreeCashFlowRows(
      options.historicalFreeCashFlows,
    ),
    historicalMultiples: normalizeHistoricalMultiples(options.historicalMultiples),
    historicalMultipleSeries: normalizeHistoricalMultipleSeries(
      options.historicalMultipleSeries,
    ),
    historicalMultipleBenchmarks: normalizeHistoricalMultipleBenchmarks(
      options.historicalMultipleBenchmarks,
    ),
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
          evEbitdaScenario("optimistic", 0.25, 0.19, 0.14, 18, fields),
          evEbitdaScenario("base", 0.5, 0.15, 0.1, 14, fields),
          evEbitdaScenario("worst", 0.25, 0.1, 0.05, 11, fields),
        ],
      },
      pe: {
        scenarios: [
          terminalMultipleScenario("optimistic", 0.2, 0.2, 0.15, 29, eps),
          terminalMultipleScenario("base", 0.5, 0.15, 0.1, 24, eps),
          terminalMultipleScenario("worst", 0.3, 0.1, 0.05, 18, eps),
        ],
      },
      dcfMultiple: {
        scenarios: [
          terminalMultipleScenario(
            "optimistic",
            0.25,
            0.2,
            0.15,
            31,
            fcfPerShare,
          ),
          terminalMultipleScenario(
            "base",
            0.5,
            0.15,
            0.1,
            28,
            fcfPerShare,
          ),
          terminalMultipleScenario(
            "worst",
            0.25,
            0.1,
            0.05,
            24,
            fcfPerShare,
          ),
        ],
      },
    },
  };
}

export function calculateFcfPerShareTtm(
  input: StockValuationInput,
): FcfPerShareTtmCalculation {
  const dcfScenarios = input.models.dcf10Years.scenarios;
  const averageScenario = dcfScenarios.find((scenario) => scenario.id === "base");
  const averageFcf = numberOrNull(averageScenario?.baseFreeCashFlow);
  const firstScenarioFcf =
    dcfScenarios
      .map((scenario) => numberOrNull(scenario.baseFreeCashFlow))
      .find((value) => value !== null) ?? null;
  const sourceFcf = numberOrNull(input.sources?.freeCashFlow?.value);
  const freeCashFlow = averageFcf ?? firstScenarioFcf ?? sourceFcf;
  const sharesOutstanding = numberOrNull(input.sharesOutstanding);
  const fcfPerShare =
    freeCashFlow !== null && sharesOutstanding !== null && sharesOutstanding !== 0
      ? freeCashFlow / sharesOutstanding
      : null;

  return {
    freeCashFlow,
    sharesOutstanding,
    fcfPerShare,
  };
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

type HistoricalMultipleAverageSource = Pick<
  HistoricalMultipleSeriesPoint,
  "date" | "multiple" | "year"
>;

function positiveMultiple(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function historicalMultiplePeriodAverages(
  points: HistoricalMultipleAverageSource[],
): HistoricalMultiplePeriodAverage[] {
  const usablePoints = points.filter((point) => positiveMultiple(point.multiple));
  const datedPoints = usablePoints
    .map((point) => ({ ...point, timestamp: Date.parse(point.date) }))
    .filter((point) => Number.isFinite(point.timestamp));
  const latestTimestamp = datedPoints.length
    ? Math.max(...datedPoints.map((point) => point.timestamp))
    : null;
  const years = usablePoints
    .map((point) => point.year)
    .filter((year): year is number => year !== null);
  const latestYear = years.length ? Math.max(...years) : null;

  return historicalMultiplePeriods.map((period) => {
    const periodPoints =
      latestTimestamp !== null
        ? datedPoints.filter((point) => {
            const startDate = new Date(latestTimestamp);
            startDate.setUTCFullYear(startDate.getUTCFullYear() - period.years);
            startDate.setUTCDate(startDate.getUTCDate() + 1);

            return point.timestamp >= startDate.getTime();
          })
        : latestYear === null
          ? usablePoints.slice(0, period.years)
          : usablePoints.filter(
              (point) =>
                point.year !== null && point.year >= latestYear - period.years + 1,
            );
    const values = periodPoints
      .map((point) => point.multiple)
      .filter(positiveMultiple);

    return {
      key: period.key,
      label: period.key,
      years: period.years,
      average: average(values),
      count: values.length,
    };
  });
}

export function calculateHistoricalFcfAverage(
  input: StockValuationInput,
): HistoricalFreeCashFlowAverageCalculation {
  const sourceRows = normalizeHistoricalFreeCashFlowRows(input.historicalFreeCashFlows);
  const paddedRows: HistoricalFreeCashFlowRow[] = Array.from(
    { length: historicalFreeCashFlowRowCount },
    (_, index) => sourceRows[index] ?? { year: null, freeCashFlow: null },
  );
  const rows = paddedRows.map((row, slot): HistoricalFreeCashFlowCalculationRow => {
    const yearIndex = historicalFreeCashFlowRowCount - 1 - slot;
    const previousRow = paddedRows[slot + 1];
    const currentFcf = numberOrNull(row.freeCashFlow);
    const previousFcf = numberOrNull(previousRow?.freeCashFlow);
    const growthPercent =
      yearIndex > 0 &&
      currentFcf !== null &&
      previousFcf !== null &&
      previousFcf !== 0
        ? (currentFcf - previousFcf) / Math.abs(previousFcf)
        : null;

    return {
      year: yearOrNull(row.year),
      freeCashFlow: currentFcf,
      source: row.source,
      asOf: row.asOf,
      label: `Year ${yearIndex}`,
      slot,
      growthLabel: yearIndex > 0 ? `Y${yearIndex - 1} to Y${yearIndex}` : null,
      growthPercent,
    };
  });
  const numericFreeCashFlows = rows
    .map((row) => numberOrNull(row.freeCashFlow))
    .filter((value): value is number => value !== null);
  const validGrowthPercents = rows
    .map((row) => numberOrNull(row.growthPercent))
    .filter((value): value is number => value !== null);

  return {
    rows,
    averageFreeCashFlow: average(numericFreeCashFlows),
    averageGrowthPercent: average(validGrowthPercents),
    isPartialHistory: numericFreeCashFlows.length < historicalFreeCashFlowRowCount,
    missingRows: historicalFreeCashFlowRowCount - numericFreeCashFlows.length,
  };
}

export function calculateHistoricalMultipleSummary(
  input: StockValuationInput,
  key: HistoricalMultipleKey,
): HistoricalMultipleSummary {
  const explicitSeriesPoints = normalizeHistoricalMultipleSeriesPoints(
    input.historicalMultipleSeries?.[key],
  );
  const normalizedRows = normalizeHistoricalMultipleRows(input.historicalMultiples?.[key]);
  const sourceRows =
    normalizedRows.length > 0
      ? normalizedRows
      : historicalMultipleRowsFromSeries(explicitSeriesPoints);
  const rows = sourceRows.map(
    (row): HistoricalMultipleCalculationRow => {
      const multiple = numberOrNull(row.multiple);
      const denominator = numberOrNull(row.denominator);
      const usableForApply =
        row.needsReview !== true &&
        multiple !== null &&
        multiple > 0 &&
        denominator !== null &&
        denominator > 0;
      const ignoredReason =
        usableForApply
          ? null
          : row.needsReview === true
            ? "needs-review"
            : multiple === null || denominator === null
              ? "missing"
              : "negative-or-zero";

      return {
        ...row,
        usableForApply,
        ignoredReason,
      };
    },
  );
  const seriesPoints =
    explicitSeriesPoints.length > 0
      ? explicitSeriesPoints
      : rows
          .filter((row) => row.year !== null || row.asOf || row.multiple !== null)
          .map(
            (row): HistoricalMultipleSeriesPoint => ({
              date: dateOrNull(row.asOf) ?? `${row.year ?? 0}-12-31`,
              year: row.year,
              numerator: row.numerator,
              denominator: row.denominator,
              multiple: row.multiple,
              source: row.source,
              asOf: row.asOf,
              ...(row.needsReview
                ? { needsReview: true, reviewReason: row.reviewReason }
                : {}),
            }),
          );
  const displaySource = rows.length
    ? rows.filter((row) => row.usableForApply)
    : seriesPoints.filter(
        (point) =>
          positiveMultiple(point.multiple) &&
          (point.denominator === null || point.denominator > 0),
      );
  const displayMultiples = displaySource
    .map((row) => row.multiple)
    .filter(positiveMultiple);
  const applySource = rows.length
    ? rows.filter((row) => row.usableForApply)
    : seriesPoints.filter(
        (point) =>
          point.needsReview !== true &&
          positiveMultiple(point.multiple) &&
          point.denominator !== null &&
          point.denominator > 0,
      );
  const applyMultiples = applySource.map((row) => row.multiple).filter(positiveMultiple);
  const low = displayMultiples.length ? Math.min(...displayMultiples) : null;
  const high = displayMultiples.length ? Math.max(...displayMultiples) : null;
  const averageMultiple = average(displayMultiples);
  const applyLow = applyMultiples.length ? Math.min(...applyMultiples) : null;
  const applyHigh = applyMultiples.length ? Math.max(...applyMultiples) : null;
  const applyAverage = average(applyMultiples);
  const currentMultiple = numberOrNull(input.sources?.[key]?.value);
  const applyValues =
    applyLow !== null && applyHigh !== null && applyAverage !== null
      ? {
          optimistic: applyHigh,
          base: applyAverage,
          worst: applyLow,
        }
      : null;
  const benchmark = normalizeHistoricalMultipleBenchmark(
    input.historicalMultipleBenchmarks?.[key],
  );

  if (
    benchmark?.sourceStatus === "available" &&
    (benchmark.seriesPoints.length > 0 || benchmark.periodAverages.length > 0)
  ) {
    const benchmarkMultiples = benchmark.seriesPoints
      .map((point) => point.multiple)
      .filter(positiveMultiple);
    const benchmarkLow =
      benchmark.low ?? (benchmarkMultiples.length ? Math.min(...benchmarkMultiples) : null);
    const benchmarkHigh =
      benchmark.high ?? (benchmarkMultiples.length ? Math.max(...benchmarkMultiples) : null);
    const benchmarkAverage = benchmark.average ?? average(benchmarkMultiples);
    const benchmarkApplyValues =
      benchmarkLow !== null && benchmarkHigh !== null && benchmarkAverage !== null
        ? {
            optimistic: benchmarkHigh,
            base: benchmarkAverage,
            worst: benchmarkLow,
          }
        : null;

    return {
      key,
      source: "FinanceCharts",
      sourceStatus: "available",
      sourceMessage: benchmark.sourceMessage,
      rows,
      seriesPoints: benchmark.seriesPoints,
      currentMultiple: benchmark.currentMultiple ?? currentMultiple,
      low: benchmarkLow,
      average: benchmarkAverage,
      high: benchmarkHigh,
      periodAverages:
        benchmark.periodAverages.length > 0
          ? benchmark.periodAverages
          : historicalMultiplePeriodAverages(benchmark.seriesPoints),
      canApply: benchmarkApplyValues !== null,
      applyValues: benchmarkApplyValues,
    };
  }

  return {
    key,
    source: "Derived",
    sourceStatus: benchmark ? "fallback" : "available",
    sourceMessage:
      benchmark?.sourceStatus === "unavailable"
        ? benchmark.sourceMessage ??
          "FinanceCharts data unavailable; showing derived fallback."
        : undefined,
    rows,
    seriesPoints,
    currentMultiple,
    low,
    average: averageMultiple,
    high,
    periodAverages: historicalMultiplePeriodAverages(
      explicitSeriesPoints.length > 0
        ? seriesPoints
        : rows
            .filter((row) => row.usableForApply)
            .map((row) => ({
              date: dateOrNull(row.asOf) ?? `${row.year ?? 0}-12-31`,
              year: row.year,
              multiple: row.multiple,
            })),
    ),
    canApply: applyValues !== null,
    applyValues,
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
    // The source workbook applies the Average scenario's second-stage growth from year 5.
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
