import { env } from "@/lib/env";
import { fetchFinanceChartsHistoricalMultipleBenchmarks } from "@/lib/financecharts-historical-multiples";
import {
  buildDefaultStockValuationInput,
  type HistoricalFreeCashFlowRow,
  type HistoricalMultipleBenchmark,
  type HistoricalMultipleKey,
  type HistoricalMultipleRow,
  type HistoricalMultipleSeriesPoint,
  type StockValuationAutofillFields,
  type StockValuationAutofillResult,
  type ValuationField,
  type ValuationSource,
} from "@/lib/stock-valuation";

type MacrotrendsRow = Record<string, string>;

type AlphaOverview = Record<string, unknown>;

type StockValuationAutofillFieldsWithHistory = StockValuationAutofillFields & {
  historicalFreeCashFlows?: HistoricalFreeCashFlowRow[];
  historicalFinancialMetrics?: HistoricalFinancialMetricRow[];
  historicalMultiples?: Partial<Record<HistoricalMultipleKey, HistoricalMultipleRow[]>>;
  historicalMultipleSeries?: Partial<
    Record<HistoricalMultipleKey, HistoricalMultipleSeriesPoint[]>
  >;
  historicalMultipleBenchmarks?: Partial<
    Record<HistoricalMultipleKey, HistoricalMultipleBenchmark>
  >;
};

type HistoricalPriceRow = {
  date: string;
  close: number;
  source: Extract<ValuationSource, "Yahoo">;
};

type YahooTtmFields = {
  currency?: string;
  fields: StockValuationAutofillFields;
};

type AnnualSecValue = {
  value: number;
  end?: string;
  source?: ValuationSource;
  unit?: string;
};

type HistoricalFinancialMetricRow = {
  year: number;
  fiscalYearEnd?: string;
  freeCashFlow?: number;
  eps?: number;
  sharesOutstanding?: number;
  ebitda?: number;
  cashAndCashEquivalents?: number;
  totalDebt?: number;
  needsReview?: boolean;
  reviewReason?: string;
};

const historicalFinancialMetricRowCount = 20;

type SecFactUnit = {
  start?: string;
  end?: string;
  fy?: number;
  fp?: string;
  form?: string;
  frame?: string;
  unit?: string;
  val?: number;
};

type SecCompanyFacts = {
  cik?: number;
  entityName?: string;
  facts?: Record<string, Record<string, { units?: Record<string, SecFactUnit[]> }> | undefined>;
};

const requestHeaders = {
  "User-Agent": `ForexSite valuation tool (${env.NEXT_PUBLIC_APP_URL})`,
  Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
};

function cleanTicker(ticker: string) {
  return ticker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.replace(/[$,%\s,]/g, "");
  if (!cleaned || cleaned === "None" || cleaned === "null" || cleaned === "-") {
    return null;
  }

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

function field<T>(
  value: T | null | undefined,
  source: ValuationSource,
  asOf?: string,
): ValuationField<T> | undefined {
  if (value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value))) {
    return undefined;
  }

  return { value, source, asOf };
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function latestNumericYear(row: MacrotrendsRow) {
  return Object.keys(row)
    .filter((key) => macroYearFromKey(key) !== null)
    .sort((first, second) => macroYearFromKey(second)! - macroYearFromKey(first)!)
    .find((key) => parseNumber(row[key]) !== null);
}

function macroYearFromKey(key: string) {
  const match = key.match(/^(\d{4})(?:-\d{2}-\d{2})?$/);

  return match ? Number(match[1]) : null;
}

function macroAsOfFromKey(key: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : `${key}-12-31`;
}

function findMacroRow(rows: MacrotrendsRow[], includes: string[]) {
  return rows.find((row) => {
    const name = stripHtml(row.field_name ?? "").toLowerCase();

    return includes.every((needle) => name.includes(needle.toLowerCase()));
  });
}

function macroRowMillions(row: MacrotrendsRow | undefined) {
  if (!row) {
    return undefined;
  }

  const latestYear = latestNumericYear(row);
  if (!latestYear) {
    return undefined;
  }

  const value = parseNumber(row[latestYear]);

  return field(value === null ? null : value * 1_000_000, "Macrotrends", macroAsOfFromKey(latestYear));
}

function macroAnnualValues(row: MacrotrendsRow | undefined) {
  if (!row) {
    return new Map<number, AnnualSecValue>();
  }

  return new Map(
    Object.keys(row)
      .map((key) => [macroYearFromKey(key), key, parseNumber(row[key])] as const)
      .filter(
        (entry): entry is readonly [number, string, number] =>
          entry[0] !== null && entry[2] !== null,
      )
      .map(([year, key, value]) => [
        year,
        {
          asOf: macroAsOfFromKey(key),
          source: "Macrotrends",
          value: value * 1_000_000,
        },
      ] as const),
  );
}

function historicalRowsFromCashFlowMaps(
  operatingCashFlowByYear: Map<number, number | AnnualSecValue>,
  capitalExpendituresByYear: Map<number, number | AnnualSecValue>,
  source: Extract<ValuationSource, "SEC FY" | "SEC IFRS" | "Macrotrends">,
) {
  return Array.from(operatingCashFlowByYear.keys())
    .filter((year) => capitalExpendituresByYear.has(year))
    .sort((first, second) => second - first)
    .slice(0, 11)
    .map((year): HistoricalFreeCashFlowRow => {
      const operatingCashFlowEntry = operatingCashFlowByYear.get(year)!;
      const capitalExpendituresEntry = capitalExpendituresByYear.get(year)!;
      const operatingCashFlow =
        typeof operatingCashFlowEntry === "number"
          ? operatingCashFlowEntry
          : operatingCashFlowEntry.value;
      const capitalExpenditures =
        typeof capitalExpendituresEntry === "number"
          ? capitalExpendituresEntry
          : capitalExpendituresEntry.value;
      const freeCashFlow =
        capitalExpenditures < 0
          ? operatingCashFlow + capitalExpenditures
          : operatingCashFlow - capitalExpenditures;
      const asOf =
        typeof operatingCashFlowEntry === "number"
          ? undefined
          : operatingCashFlowEntry.end;

      return {
        year,
        freeCashFlow,
        source,
        asOf:
          source === "Macrotrends"
            ? asOf ?? `${year}-12-31`
            : `FY ${year}`,
      };
    });
}

export function extractMacrotrendsOriginalData(html: string): MacrotrendsRow[] {
  const match = html.match(/var\s+originalData\s*=\s*(\[[\s\S]*?\]);/);
  if (!match?.[1]) {
    return [];
  }

  try {
    const parsed = JSON.parse(match[1]) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((row): row is MacrotrendsRow => row !== null && typeof row === "object")
      : [];
  } catch {
    return [];
  }
}

export function mapMacrotrendsCashFlow(
  rows: MacrotrendsRow[],
): StockValuationAutofillFieldsWithHistory {
  const operatingCashFlowRow = findMacroRow(rows, ["cash flow from operating activities"]);
  const capitalExpendituresRow =
    findMacroRow(rows, ["net change in property, plant, and equipment"]) ??
    findMacroRow(rows, ["capital expenditures"]);
  const operatingCashFlow = macroRowMillions(operatingCashFlowRow);
  const capitalExpenditures = macroRowMillions(capitalExpendituresRow);
  const capexValue = capitalExpenditures?.value ?? null;
  const freeCashFlow =
    operatingCashFlow?.value !== null &&
    operatingCashFlow?.value !== undefined &&
    capexValue !== null
      ? field(
          capexValue < 0
            ? operatingCashFlow.value + capexValue
            : operatingCashFlow.value - capexValue,
          "Macrotrends",
          operatingCashFlow.asOf,
        )
      : undefined;

  return {
    operatingCashFlow,
    capitalExpenditures,
    freeCashFlow,
    historicalFreeCashFlows: historicalRowsFromCashFlowMaps(
      macroAnnualValues(operatingCashFlowRow),
      macroAnnualValues(capitalExpendituresRow),
      "Macrotrends",
    ),
  };
}

export function mapYahooChartQuote(payload: unknown):
  | (StockValuationAutofillFields & { financialStatements?: never })
  | StockValuationAutofillFields {
  const result = (payload as { chart?: { result?: Array<{ meta?: Record<string, unknown> }> } })?.chart
    ?.result?.[0];
  const meta = result?.meta ?? {};
  const currentPrice = field(parseNumber(meta.regularMarketPrice), "Yahoo");
  const companyNameValue =
    typeof meta.longName === "string"
      ? meta.longName
      : typeof meta.shortName === "string"
        ? meta.shortName
        : undefined;
  const currencyValue = typeof meta.currency === "string" ? meta.currency : undefined;

  return {
    currentPrice,
    companyName: field(companyNameValue, "Yahoo"),
    currency: field(currencyValue, "Yahoo"),
  };
}

export function mapYahooHistoricalPrices(payload: unknown): HistoricalPriceRow[] {
  const result = (payload as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
    };
  })?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];

  return timestamps
    .map((timestamp, index) => {
      const close = parseNumber(closes[index]);
      if (close === null) {
        return null;
      }

      return {
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        close,
        source: "Yahoo" as const,
      };
    })
    .filter((row): row is HistoricalPriceRow => row !== null)
    .sort((first, second) => first.date.localeCompare(second.date));
}

function yahooTimeseriesValue(payload: unknown, key: string) {
  const results = (payload as {
    timeseries?: {
      result?: Array<Record<string, unknown>>;
    };
  })?.timeseries?.result ?? [];
  const row = results.find((result) => Array.isArray(result[key]));
  const values = (row?.[key] as Array<Record<string, unknown>> | undefined) ?? [];
  const validValues = values
    .map((value) => {
      const reportedValue = value.reportedValue as { raw?: unknown } | undefined;
      const raw = parseNumber(reportedValue?.raw);
      const asOfDate =
        typeof value.asOfDate === "string" && value.asOfDate ? value.asOfDate : undefined;
      const currencyCode =
        typeof value.currencyCode === "string" && value.currencyCode
          ? value.currencyCode
          : undefined;
      const periodType =
        typeof value.periodType === "string" && value.periodType ? value.periodType : undefined;

      return raw === null
        ? null
        : {
            asOfDate,
            currencyCode,
            periodType,
            value: raw,
          };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((first, second) => String(second.asOfDate ?? "").localeCompare(String(first.asOfDate ?? "")));

  return validValues[0] ?? null;
}

export function mapYahooFundamentalsTimeseries(payload: unknown): YahooTtmFields {
  const freeCashFlow = yahooTimeseriesValue(payload, "trailingFreeCashFlow");
  const ebitda = yahooTimeseriesValue(payload, "trailingEBITDA");
  const eps =
    yahooTimeseriesValue(payload, "trailingDilutedEPS") ??
    yahooTimeseriesValue(payload, "trailingBasicEPS");
  const shares =
    yahooTimeseriesValue(payload, "trailingDilutedAverageShares") ??
    yahooTimeseriesValue(payload, "trailingBasicAverageShares");
  const currency = freeCashFlow?.currencyCode ?? ebitda?.currencyCode ?? eps?.currencyCode;

  return {
    currency,
    fields: {
      freeCashFlow: field(
        freeCashFlow?.value,
        "Yahoo TTM",
        freeCashFlow?.asOfDate ? `TTM ${freeCashFlow.asOfDate}` : undefined,
      ),
      ebitda: field(
        ebitda?.value,
        "Yahoo TTM",
        ebitda?.asOfDate ? `TTM ${ebitda.asOfDate}` : undefined,
      ),
      eps: field(
        eps?.value,
        "Yahoo TTM",
        eps?.asOfDate ? `TTM ${eps.asOfDate}` : undefined,
      ),
      sharesOutstanding: field(
        shares?.value,
        "Yahoo TTM",
        shares?.asOfDate ? `TTM ${shares.asOfDate}` : undefined,
      ),
    },
  };
}

export function mapAlphaVantageOverview(payload: AlphaOverview): StockValuationAutofillFields {
  return {
    companyName: field(typeof payload.Name === "string" ? payload.Name : undefined, "Alpha Vantage"),
    marketCap: field(parseNumber(payload.MarketCapitalization), "Alpha Vantage"),
    ebitda: field(parseNumber(payload.EBITDA), "Alpha Vantage"),
    eps: field(parseNumber(payload.EPS), "Alpha Vantage"),
    peRatio: field(parseNumber(payload.PERatio), "Alpha Vantage"),
    evToEbitda: field(parseNumber(payload.EVToEBITDA), "Alpha Vantage"),
    sharesOutstanding: field(parseNumber(payload.SharesOutstanding), "Alpha Vantage"),
    currency: field(typeof payload.Currency === "string" ? payload.Currency : undefined, "Alpha Vantage"),
  };
}

function stringFromAliases(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function numberFromAliases(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = parseNumber(payload[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

export function mapIbkrSnapshot(payload: Record<string, unknown>): StockValuationAutofillFields {
  return {
    companyName: field(
      stringFromAliases(payload, ["companyName", "company_name", "longName", "name"]),
      "IBKR",
    ),
    currentPrice: field(numberFromAliases(payload, ["lastPrice", "last_price", "price"]), "IBKR"),
    marketCap: field(numberFromAliases(payload, ["marketCap", "market_cap"]), "IBKR"),
    sharesOutstanding: field(
      numberFromAliases(payload, ["sharesOutstanding", "shares_outstanding"]),
      "IBKR",
    ),
    freeCashFlow: field(numberFromAliases(payload, ["freeCashFlow", "free_cash_flow"]), "IBKR"),
    ebitda: field(numberFromAliases(payload, ["ebitda", "EBITDA"]), "IBKR"),
    eps: field(numberFromAliases(payload, ["eps", "EPS"]), "IBKR"),
    peRatio: field(numberFromAliases(payload, ["peRatio", "pe_ratio", "PERatio"]), "IBKR"),
    evToEbitda: field(
      numberFromAliases(payload, ["evToEbitda", "ev_to_ebitda", "EVToEBITDA"]),
      "IBKR",
    ),
    priceToFreeCashFlow: field(
      numberFromAliases(payload, ["priceToFreeCashFlow", "price_to_free_cash_flow"]),
      "IBKR",
    ),
    currency: field(stringFromAliases(payload, ["currency"]), "IBKR"),
  };
}

type NormalizedSecFact = {
  asOf?: string;
  source: Extract<ValuationSource, "SEC" | "SEC TTM" | "SEC FY" | "SEC IFRS">;
  value: number;
};

const fullYearMinimumDays = 330;

function secFactValues(fact: { units?: Record<string, SecFactUnit[]> } | undefined) {
  return Object.entries(fact?.units ?? {})
    .flatMap(([unit, items]) => items.map((item) => ({ ...item, unit })))
    .filter((item) => typeof item.val === "number" && Number.isFinite(item.val));
}

function dateMs(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(`${value}T00:00:00.000Z`);

  return Number.isFinite(parsed) ? parsed : null;
}

function durationDays(item: SecFactUnit) {
  const start = dateMs(item.start);
  const end = dateMs(item.end);

  if (start === null || end === null || end < start) {
    return null;
  }

  return Math.round((end - start) / 86_400_000) + 1;
}

function sortLatestFirst(first: SecFactUnit, second: SecFactUnit) {
  const dateCompare = String(second.end ?? "").localeCompare(String(first.end ?? ""));
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return (durationDays(second) ?? 0) - (durationDays(first) ?? 0);
}

function isFullYearFact(item: SecFactUnit) {
  const duration = durationDays(item);
  const frame = item.frame ?? "";

  return (
    item.fp === "FY" ||
    item.form === "10-K" ||
    (/^CY\d{4}$/.test(frame) && !frame.includes("Q")) ||
    (duration !== null && duration >= fullYearMinimumDays)
  );
}

function shiftedOneYearEarlier(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const year = Number(value.slice(0, 4));

  return `${year - 1}${value.slice(4)}`;
}

function latestSecPointFact(fact: { units?: Record<string, SecFactUnit[]> } | undefined) {
  const values = secFactValues(fact);
  if (values.length === 0) {
    return null;
  }

  return [...values].sort(sortLatestFirst)[0];
}

function secFiscalYear(item: SecFactUnit) {
  if (typeof item.fy === "number" && Number.isInteger(item.fy)) {
    return item.fy;
  }

  if (typeof item.end === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.end)) {
    return Number(item.end.slice(0, 4));
  }

  return null;
}

function annualSecFactMap(fact: { units?: Record<string, SecFactUnit[]> } | undefined) {
  const yearly = new Map<number, SecFactUnit>();

  for (const item of secFactValues(fact).filter(isFullYearFact).sort(sortLatestFirst)) {
    const year = secFiscalYear(item);

    if (year !== null && !yearly.has(year)) {
      yearly.set(year, item);
    }
  }

  return yearly;
}

type SecTaxonomyMatch = {
  fact: { units?: Record<string, SecFactUnit[]> };
  source: Extract<ValuationSource, "SEC" | "SEC IFRS">;
};

const secTaxonomyOrder: Array<{
  key: string;
  source: Extract<ValuationSource, "SEC" | "SEC IFRS">;
}> = [
  { key: "us-gaap", source: "SEC" },
  { key: "ifrs-full", source: "SEC IFRS" },
];

function findSecFact(
  facts: SecCompanyFacts,
  conceptNames: string[],
): SecTaxonomyMatch | null {
  for (const taxonomy of secTaxonomyOrder) {
    const taxonomyFacts = facts.facts?.[taxonomy.key] ?? {};

    for (const conceptName of conceptNames) {
      const fact = taxonomyFacts[conceptName];
      if (fact && secFactValues(fact).length > 0) {
        return { fact, source: taxonomy.source };
      }
    }
  }

  return null;
}

function annualSecValueDetailsForConcept(
  facts: SecCompanyFacts,
  conceptNames: string[],
) {
  const match = findSecFact(facts, conceptNames);
  if (!match) {
    return new Map<number, AnnualSecValue>();
  }
  const annualFacts = annualSecFactMap(match.fact);

  if (annualFacts.size === 0) {
    return new Map<number, AnnualSecValue>();
  }

  return new Map(
    Array.from(annualFacts.entries()).map(
      ([year, item]) =>
        [
          year,
          {
            value: item.val!,
            end: item.end,
            source: match.source,
            unit: item.unit,
          },
        ] as const,
    ),
  );
}

function deriveAnnualSumByYear(
  firstByYear: Map<number, AnnualSecValue>,
  secondByYear: Map<number, AnnualSecValue>,
) {
  const years = Array.from(firstByYear.keys()).filter((year) => secondByYear.has(year));

  return new Map(
    years.map((year) => {
      const first = firstByYear.get(year)!;
      const second = secondByYear.get(year)!;

      return [
        year,
        {
          value: first.value + second.value,
          end: first.end ?? second.end,
          source: first.source === second.source ? first.source : "Derived",
          unit: first.unit ?? second.unit,
        },
      ] as const;
    }),
  );
}

function hasIfrsAnnualValues(...maps: Array<Map<number, AnnualSecValue>>) {
  return maps.some((map) =>
    Array.from(map.values()).some((value) => value.source === "SEC IFRS"),
  );
}

function findPriorComparableInterim(
  values: SecFactUnit[],
  latestInterim: SecFactUnit,
) {
  const priorStart = shiftedOneYearEarlier(latestInterim.start);
  const priorEnd = shiftedOneYearEarlier(latestInterim.end);

  if (!priorStart || !priorEnd) {
    return null;
  }

  return (
    values
      .filter((item) => item.start === priorStart && item.end === priorEnd)
      .sort(sortLatestFirst)[0] ?? null
  );
}

function latestSecDurationFact(
  fact: { units?: Record<string, SecFactUnit[]> } | undefined,
  source: Extract<ValuationSource, "SEC" | "SEC IFRS">,
): NormalizedSecFact | null {
  const values = secFactValues(fact);
  if (values.length === 0) {
    return null;
  }

  const latestAnnual =
    values.filter(isFullYearFact).sort(sortLatestFirst)[0] ?? null;
  if (latestAnnual?.val === undefined) {
    return null;
  }

  const latestAnnualEnd = dateMs(latestAnnual.end);
  const latestInterim =
    latestAnnualEnd === null
      ? null
      : values
          .filter((item) => {
            const itemEnd = dateMs(item.end);

            return (
              itemEnd !== null &&
              itemEnd > latestAnnualEnd &&
              !isFullYearFact(item) &&
              durationDays(item) !== null
            );
          })
          .sort(sortLatestFirst)[0] ?? null;

  const priorComparable = latestInterim
    ? findPriorComparableInterim(values, latestInterim)
    : null;

  if (latestInterim?.val !== undefined && priorComparable?.val !== undefined) {
    return {
      value: latestAnnual.val + latestInterim.val - priorComparable.val,
      source: source === "SEC IFRS" ? "SEC IFRS" : "SEC TTM",
      asOf: latestInterim.end ? `TTM ${latestInterim.end}` : undefined,
    };
  }

  return {
    value: latestAnnual.val,
    source: source === "SEC IFRS" ? "SEC IFRS" : "SEC FY",
    asOf: latestAnnual.fy ? `FY ${latestAnnual.fy}` : latestAnnual.end,
  };
}

function secNumber(
  facts: SecCompanyFacts,
  conceptNames: string[],
  mode: "duration" | "point" = "duration",
): ValuationField | undefined {
  const match = findSecFact(facts, conceptNames);
  if (!match) {
    return undefined;
  }

  const fact =
    mode === "point"
      ? latestSecPointFact(match.fact)
      : latestSecDurationFact(match.fact, match.source);

  if (!fact) {
    return undefined;
  }

  if ("value" in fact) {
    return field(fact.value, fact.source, fact.asOf);
  }

  if (fact.val !== undefined) {
    return field(fact.val, match.source, fact.end);
  }

  return undefined;
}

function derivedSource(
  first: ValuationField | undefined,
  second: ValuationField | undefined,
): ValuationSource {
  return first && second && first.source === second.source ? first.source : "Derived";
}

function derivedAsOf(first: ValuationField | undefined, second: ValuationField | undefined) {
  return first?.asOf === second?.asOf ? first?.asOf : first?.asOf ?? second?.asOf;
}

export function mapSecCompanyFacts(facts: SecCompanyFacts): StockValuationAutofillFieldsWithHistory {
  const operatingCashFlowConcepts = [
    "NetCashProvidedByUsedInOperatingActivities",
    "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
    "CashFlowsFromUsedInOperatingActivities",
  ];
  const capitalExpendituresConcepts = [
    "PaymentsToAcquirePropertyPlantAndEquipment",
    "PaymentsToAcquireProductiveAssets",
    "PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities",
  ];
  const epsConcepts = [
    "EarningsPerShareDiluted",
    "EarningsPerShareBasic",
    "DilutedEarningsLossPerShare",
    "BasicEarningsLossPerShare",
  ];
  const sharesConcepts = [
    "EntityCommonStockSharesOutstanding",
    "NumberOfSharesOutstanding",
    "WeightedAverageShares",
    "AdjustedWeightedAverageShares",
  ];
  const directEbitdaConcepts = [
    "EarningsBeforeInterestTaxesDepreciationAmortization",
    "Ebitda",
  ];
  const operatingProfitConcepts = [
    "OperatingIncomeLoss",
    "ProfitLossFromOperatingActivities",
  ];
  const depreciationAmortizationConcepts = [
    "DepreciationDepletionAndAmortization",
    "DepreciationAndAmortization",
    "DepreciationAndAmortizationExpense",
    "DepreciationAmortisationAndImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss",
  ];
  const cashConcepts = [
    "CashAndCashEquivalentsAtCarryingValue",
    "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    "CashAndCashEquivalentsAtCarryingValueIncludingDisposalGroupAndDiscontinuedOperations",
    "CashAndCashEquivalents",
  ];
  const totalDebtConcepts = [
    "LongTermDebtAndFinanceLeaseObligations",
    "LongTermDebtAndFinanceLeaseObligationsIncludingCurrentMaturities",
    "LongTermDebt",
    "DebtCurrent",
    "BondsIssuedUndiscountedCashFlows",
  ];
  const operatingCashFlowByYear = annualSecValueDetailsForConcept(facts, operatingCashFlowConcepts);
  const capitalExpendituresByYear = annualSecValueDetailsForConcept(facts, capitalExpendituresConcepts);
  const epsByYear = annualSecValueDetailsForConcept(facts, epsConcepts);
  const sharesByYear = annualSecValueDetailsForConcept(facts, sharesConcepts);
  const directEbitdaByYear = annualSecValueDetailsForConcept(facts, directEbitdaConcepts);
  const operatingProfitByYear = annualSecValueDetailsForConcept(facts, operatingProfitConcepts);
  const depreciationAmortizationByYear = annualSecValueDetailsForConcept(
    facts,
    depreciationAmortizationConcepts,
  );
  const ebitdaByYear = directEbitdaByYear.size
    ? directEbitdaByYear
    : deriveAnnualSumByYear(operatingProfitByYear, depreciationAmortizationByYear);
  const cashByYear = annualSecValueDetailsForConcept(facts, cashConcepts);
  const totalDebtByYear = annualSecValueDetailsForConcept(facts, totalDebtConcepts);
  const operatingCashFlow = secNumber(facts, operatingCashFlowConcepts);
  const capitalExpenditures = secNumber(facts, capitalExpendituresConcepts);
  const freeCashFlow =
    operatingCashFlow?.value !== null &&
    operatingCashFlow?.value !== undefined &&
    capitalExpenditures?.value !== null &&
    capitalExpenditures?.value !== undefined
      ? field(
          capitalExpenditures.value < 0
            ? operatingCashFlow.value + capitalExpenditures.value
            : operatingCashFlow.value - capitalExpenditures.value,
          derivedSource(operatingCashFlow, capitalExpenditures),
          derivedAsOf(operatingCashFlow, capitalExpenditures),
        )
      : undefined;
  const directEbitda = secNumber(facts, directEbitdaConcepts);
  const operatingProfit = secNumber(facts, operatingProfitConcepts);
  const depreciationAmortization = secNumber(facts, depreciationAmortizationConcepts);
  const derivedEbitda =
    directEbitda ??
    (operatingProfit?.value !== null &&
    operatingProfit?.value !== undefined &&
    depreciationAmortization?.value !== null &&
    depreciationAmortization?.value !== undefined
      ? field(
          operatingProfit.value + depreciationAmortization.value,
          derivedSource(operatingProfit, depreciationAmortization),
          derivedAsOf(operatingProfit, depreciationAmortization),
        )
      : undefined);
  const historicalFreeCashFlows = historicalRowsFromCashFlowMaps(
    operatingCashFlowByYear,
    capitalExpendituresByYear,
    hasIfrsAnnualValues(operatingCashFlowByYear, capitalExpendituresByYear)
      ? "SEC IFRS"
      : "SEC FY",
  );
  const historicalFinancialMetrics = buildHistoricalFinancialMetricRows({
    operatingCashFlowByYear,
    capitalExpendituresByYear,
    epsByYear,
    sharesByYear,
    ebitdaByYear,
    cashByYear,
    totalDebtByYear,
  });

  return {
    companyName: field(facts.entityName, "SEC"),
    operatingCashFlow,
    capitalExpenditures,
    freeCashFlow,
    ebitda: derivedEbitda,
    eps: secNumber(facts, epsConcepts),
    sharesOutstanding: secNumber(facts, sharesConcepts, "point"),
    historicalFreeCashFlows,
    historicalFinancialMetrics,
  };
}

function buildHistoricalFinancialMetricRows({
  operatingCashFlowByYear,
  capitalExpendituresByYear,
  epsByYear,
  sharesByYear,
  ebitdaByYear,
  cashByYear,
  totalDebtByYear,
}: {
  operatingCashFlowByYear: Map<number, AnnualSecValue>;
  capitalExpendituresByYear: Map<number, AnnualSecValue>;
  epsByYear: Map<number, AnnualSecValue>;
  sharesByYear: Map<number, AnnualSecValue>;
  ebitdaByYear: Map<number, AnnualSecValue>;
  cashByYear: Map<number, AnnualSecValue>;
  totalDebtByYear: Map<number, AnnualSecValue>;
}) {
  const years = new Set<number>([
    ...operatingCashFlowByYear.keys(),
    ...epsByYear.keys(),
    ...sharesByYear.keys(),
    ...ebitdaByYear.keys(),
  ]);

  return Array.from(years)
    .sort((first, second) => second - first)
    .slice(0, historicalFinancialMetricRowCount)
    .map((year): HistoricalFinancialMetricRow => {
      const operatingCashFlow = operatingCashFlowByYear.get(year);
      const capitalExpenditures = capitalExpendituresByYear.get(year);
      const capexValue = capitalExpenditures?.value;
      const freeCashFlow =
        operatingCashFlow?.value !== undefined && capexValue !== undefined
          ? capexValue < 0
            ? operatingCashFlow.value + capexValue
            : operatingCashFlow.value - capexValue
          : undefined;
      const fallbackEnd =
        operatingCashFlow?.end ??
        epsByYear.get(year)?.end ??
        sharesByYear.get(year)?.end ??
        ebitdaByYear.get(year)?.end;
      const sourceValues = [
        operatingCashFlow,
        capitalExpenditures,
        epsByYear.get(year),
        sharesByYear.get(year),
        ebitdaByYear.get(year),
        cashByYear.get(year),
        totalDebtByYear.get(year),
      ].filter((value): value is AnnualSecValue => Boolean(value));
      const needsReview = sourceValues.some((value) => value.source === "SEC IFRS");
      const reviewReason = needsReview
        ? "Price is USD ADR data; SEC denominators may be local-currency ordinary-share data."
        : undefined;

      return {
        year,
        fiscalYearEnd: fallbackEnd,
        freeCashFlow,
        eps: epsByYear.get(year)?.value,
        sharesOutstanding: sharesByYear.get(year)?.value,
        ebitda: ebitdaByYear.get(year)?.value,
        cashAndCashEquivalents: cashByYear.get(year)?.value,
        totalDebt: totalDebtByYear.get(year)?.value,
        needsReview,
        reviewReason,
      };
    });
}

function dateToUnixSeconds(value: string) {
  return Math.floor(Date.parse(`${value}T00:00:00.000Z`) / 1000);
}

async function fetchYahooHistoricalPrices(
  ticker: string,
  metricRows: HistoricalFinancialMetricRow[],
) {
  const years = metricRows.map((row) => row.year);
  if (years.length === 0) {
    return [];
  }

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const period1 = dateToUnixSeconds(`${Math.max(minYear - 1, maxYear - 10)}-01-01`);
  const period2 = dateToUnixSeconds(`${maxYear + 1}-01-15`);
  const payload = await fetchJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker,
    )}?period1=${period1}&period2=${period2}&interval=1mo&events=history`,
  );

  return mapYahooHistoricalPrices(payload);
}

function priceAtOrBefore(prices: HistoricalPriceRow[], asOf: string) {
  const asOfMs = Date.parse(`${asOf}T23:59:59.999Z`);
  const minimumMs = asOfMs - 21 * 86_400_000;

  return (
    [...prices]
      .filter((price) => {
        const priceMs = Date.parse(`${price.date}T00:00:00.000Z`);

        return priceMs <= asOfMs && priceMs >= minimumMs;
      })
      .sort((first, second) => second.date.localeCompare(first.date))[0] ?? null
  );
}

function yearEndDate(row: HistoricalFinancialMetricRow) {
  return row.fiscalYearEnd && /^\d{4}-\d{2}-\d{2}$/.test(row.fiscalYearEnd)
    ? row.fiscalYearEnd
    : `${row.year}-12-31`;
}

function metricRowAtOrBefore(
  metricRows: HistoricalFinancialMetricRow[],
  asOf: string,
) {
  const asOfMs = Date.parse(`${asOf}T23:59:59.999Z`);

  if (!Number.isFinite(asOfMs)) {
    return null;
  }

  return (
    [...metricRows]
      .filter((row) => Date.parse(`${yearEndDate(row)}T23:59:59.999Z`) <= asOfMs)
      .sort(
        (first, second) =>
          Date.parse(`${yearEndDate(second)}T00:00:00.000Z`) -
          Date.parse(`${yearEndDate(first)}T00:00:00.000Z`),
      )[0] ?? null
  );
}

function multipleOrNull(numerator: number | null, denominator: number | null) {
  if (
    numerator === null ||
    denominator === null ||
    denominator === 0 ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator)
  ) {
    return null;
  }

  return numerator / denominator;
}

function buildHistoricalMultiples(
  metricRows: HistoricalFinancialMetricRow[],
  prices: HistoricalPriceRow[],
): {
  historicalMultiples: Partial<Record<"priceToFreeCashFlow" | "peRatio" | "evToEbitda", HistoricalMultipleRow[]>>;
  historicalMultipleSeries: Partial<
    Record<"priceToFreeCashFlow" | "peRatio" | "evToEbitda", HistoricalMultipleSeriesPoint[]>
  >;
} {
  const priceToFreeCashFlow: HistoricalMultipleRow[] = [];
  const peRatio: HistoricalMultipleRow[] = [];
  const evToEbitda: HistoricalMultipleRow[] = [];
  const priceToFreeCashFlowSeries: HistoricalMultipleSeriesPoint[] = [];
  const peRatioSeries: HistoricalMultipleSeriesPoint[] = [];
  const evToEbitdaSeries: HistoricalMultipleSeriesPoint[] = [];

  for (const metricRow of metricRows) {
    const price = priceAtOrBefore(prices, yearEndDate(metricRow));
    if (!price) {
      continue;
    }

    const sharesOutstanding = metricRow.sharesOutstanding;
    const fcfPerShare =
      metricRow.freeCashFlow !== undefined &&
      sharesOutstanding !== undefined &&
      sharesOutstanding !== 0
        ? metricRow.freeCashFlow / sharesOutstanding
        : null;
    priceToFreeCashFlow.push({
      year: metricRow.year,
      numerator: price.close,
      denominator: fcfPerShare,
      multiple: multipleOrNull(price.close, fcfPerShare),
      source: "Derived",
      asOf: price.date,
      ...(metricRow.needsReview
        ? { needsReview: true, reviewReason: metricRow.reviewReason }
        : {}),
    });

    peRatio.push({
      year: metricRow.year,
      numerator: price.close,
      denominator: metricRow.eps ?? null,
      multiple: multipleOrNull(price.close, metricRow.eps ?? null),
      source: "Derived",
      asOf: price.date,
      ...(metricRow.needsReview
        ? { needsReview: true, reviewReason: metricRow.reviewReason }
        : {}),
    });

    if (sharesOutstanding !== undefined && metricRow.ebitda !== undefined) {
      const enterpriseValue =
        price.close * sharesOutstanding +
        (metricRow.totalDebt ?? 0) -
        (metricRow.cashAndCashEquivalents ?? 0);

      evToEbitda.push({
        year: metricRow.year,
        numerator: enterpriseValue,
        denominator: metricRow.ebitda,
        multiple: multipleOrNull(enterpriseValue, metricRow.ebitda),
        source: "Derived",
        asOf: price.date,
        ...(metricRow.needsReview
          ? { needsReview: true, reviewReason: metricRow.reviewReason }
          : {}),
      });
    }
  }

  for (const price of prices) {
    const metricRow = metricRowAtOrBefore(metricRows, price.date);

    if (!metricRow) {
      continue;
    }

    const sharesOutstanding = metricRow.sharesOutstanding;
    const fcfPerShare =
      metricRow.freeCashFlow !== undefined &&
      sharesOutstanding !== undefined &&
      sharesOutstanding !== 0
        ? metricRow.freeCashFlow / sharesOutstanding
        : null;
    const reviewFields = metricRow.needsReview
      ? { needsReview: true, reviewReason: metricRow.reviewReason }
      : {};

    priceToFreeCashFlowSeries.push({
      date: price.date,
      year: Number(price.date.slice(0, 4)),
      numerator: price.close,
      denominator: fcfPerShare,
      multiple: multipleOrNull(price.close, fcfPerShare),
      source: "Derived",
      asOf: yearEndDate(metricRow),
      ...reviewFields,
    });

    peRatioSeries.push({
      date: price.date,
      year: Number(price.date.slice(0, 4)),
      numerator: price.close,
      denominator: metricRow.eps ?? null,
      multiple: multipleOrNull(price.close, metricRow.eps ?? null),
      source: "Derived",
      asOf: yearEndDate(metricRow),
      ...reviewFields,
    });

    if (sharesOutstanding !== undefined && metricRow.ebitda !== undefined) {
      const enterpriseValue =
        price.close * sharesOutstanding +
        (metricRow.totalDebt ?? 0) -
        (metricRow.cashAndCashEquivalents ?? 0);

      evToEbitdaSeries.push({
        date: price.date,
        year: Number(price.date.slice(0, 4)),
        numerator: enterpriseValue,
        denominator: metricRow.ebitda,
        multiple: multipleOrNull(enterpriseValue, metricRow.ebitda),
        source: "Derived",
        asOf: yearEndDate(metricRow),
        ...reviewFields,
      });
    }
  }

  return {
    historicalMultiples: {
      priceToFreeCashFlow,
      peRatio,
      evToEbitda,
    },
    historicalMultipleSeries: {
      priceToFreeCashFlow: priceToFreeCashFlowSeries,
      peRatio: peRatioSeries,
      evToEbitda: evToEbitdaSeries,
    },
  };
}

function mergeFields(...fieldSets: StockValuationAutofillFields[]) {
  const merged: StockValuationAutofillFields = {};

  for (const fieldSet of fieldSets) {
    for (const [key, value] of Object.entries(fieldSet) as Array<
      [keyof StockValuationAutofillFields, ValuationField<unknown> | undefined]
    >) {
      if (!merged[key] && value?.value !== null && value?.value !== undefined) {
        merged[key] = value as never;
      }
    }
  }

  return merged;
}

type FetchJsonOptions = RequestInit & { next?: { revalidate: number } };

async function fetchJson(
  url: string,
  options: FetchJsonOptions = { next: { revalidate: 60 * 60 } },
) {
  const headers = new Headers(requestHeaders);
  if (options.headers) {
    new Headers(options.headers).forEach((value, key) => headers.set(key, value));
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });
  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}`);
  }

  return response.json() as Promise<unknown>;
}

async function fetchText(url: string) {
  const response = await fetch(url, { headers: requestHeaders, next: { revalidate: 60 * 60 } });
  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}`);
  }

  return response.text();
}

async function fetchYahooQuote(ticker: string) {
  const payload = await fetchJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker,
    )}?range=1d&interval=1d`,
  );

  return mapYahooChartQuote(payload);
}

async function fetchYahooTtmMetrics(ticker: string) {
  const metricTypes = [
    "trailingFreeCashFlow",
    "trailingEBITDA",
    "trailingDilutedEPS",
    "trailingBasicEPS",
    "trailingDilutedAverageShares",
    "trailingBasicAverageShares",
  ];
  const payload = await fetchJson(
    `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(
      ticker,
    )}?symbol=${encodeURIComponent(ticker)}&type=${metricTypes.join(",")}&period1=0&period2=${Math.floor(
      Date.now() / 1000,
    )}`,
  );

  return mapYahooFundamentalsTimeseries(payload);
}

async function fetchYahooFxRate(fromCurrency: string, toCurrency: string) {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) {
    return 1;
  }

  const directPayload = await fetchJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      `${from}${to}=X`,
    )}?range=1d&interval=1d`,
  );
  const directRate = mapYahooChartQuote(directPayload).currentPrice?.value;
  if (typeof directRate === "number" && Number.isFinite(directRate) && directRate > 0) {
    return directRate;
  }

  const inversePayload = await fetchJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      `${to}${from}=X`,
    )}?range=1d&interval=1d`,
  );
  const inverseRate = mapYahooChartQuote(inversePayload).currentPrice?.value;
  if (typeof inverseRate === "number" && Number.isFinite(inverseRate) && inverseRate > 0) {
    return 1 / inverseRate;
  }

  return null;
}

function convertYahooTtmFieldsToCurrency(
  fields: StockValuationAutofillFields,
  rate: number,
  fromCurrency: string,
  toCurrency: string,
) {
  const converted: StockValuationAutofillFields = {};
  for (const key of ["freeCashFlow", "ebitda", "eps"] as const) {
    const value = fields[key];
    if (value?.value !== null && value?.value !== undefined) {
      converted[key] = {
        value: value.value * rate,
        source: "Yahoo TTM + FX",
        asOf: value.asOf,
        original: {
          value: value.value,
          currency: fromCurrency.toUpperCase(),
          unit: key === "eps" ? "perShare" : "total",
        },
        fx: {
          from: fromCurrency.toUpperCase(),
          to: toCurrency.toUpperCase(),
          rate,
        },
      };
    }
  }
  if (fields.sharesOutstanding?.value !== null && fields.sharesOutstanding?.value !== undefined) {
    converted.sharesOutstanding = fields.sharesOutstanding;
  }

  return converted;
}

async function fetchAlphaOverview(ticker: string, allowWithoutKey = false) {
  if (!env.ALPHA_VANTAGE_API_KEY && !allowWithoutKey) {
    return {};
  }

  const apiKey = env.ALPHA_VANTAGE_API_KEY ?? "demo";
  const payload = (await fetchJson(
    `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(
      ticker,
    )}&apikey=${encodeURIComponent(apiKey)}`,
  )) as AlphaOverview;

  if (typeof payload.Information === "string" || typeof payload.Note === "string") {
    return {};
  }

  return mapAlphaVantageOverview(payload);
}

async function fetchIbkrSnapshot(ticker: string) {
  if (!env.IBKR_CLIENT_PORTAL_BASE_URL) {
    return {};
  }

  const url = new URL(
    `valuation/${encodeURIComponent(ticker)}`,
    env.IBKR_CLIENT_PORTAL_BASE_URL.endsWith("/")
      ? env.IBKR_CLIENT_PORTAL_BASE_URL
      : `${env.IBKR_CLIENT_PORTAL_BASE_URL}/`,
  );
  if (env.IBKR_ACCOUNT_ID) {
    url.searchParams.set("accountId", env.IBKR_ACCOUNT_ID);
  }

  const payload = (await fetchJson(url.toString())) as Record<string, unknown>;

  return mapIbkrSnapshot(payload);
}

type SecTickerRecord = {
  cik_str: number;
  ticker: string;
  title: string;
};

async function fetchSecCompanyFacts(ticker: string) {
  const tickers = (await fetchJson("https://www.sec.gov/files/company_tickers.json")) as Record<
    string,
    SecTickerRecord
  >;
  const match = Object.values(tickers).find(
    (item) => item.ticker.toUpperCase() === ticker.toUpperCase(),
  );

  if (!match) {
    return {};
  }

  const cik = String(match.cik_str).padStart(10, "0");
  const companyFacts = (await fetchJson(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
    { cache: "no-store" },
  )) as SecCompanyFacts;
  const mapped = mapSecCompanyFacts(companyFacts);

  return {
    ...mergeFields({ companyName: field(match.title, "SEC") }, mapped),
    historicalFreeCashFlows: mapped.historicalFreeCashFlows,
    historicalFinancialMetrics: mapped.historicalFinancialMetrics,
  };
}

function slugifyCompanyName(companyName: string | undefined, ticker: string) {
  const base = companyName || ticker;

  return base
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-inc$|-corp$|-corporation$|-class-a$/g, "");
}

async function fetchMacrotrendsFallback(ticker: string, companyName?: string) {
  const slug = slugifyCompanyName(companyName, ticker);
  const html = await fetchText(
    `https://www.macrotrends.net/stocks/charts/${encodeURIComponent(
      ticker,
    )}/${encodeURIComponent(slug)}/cash-flow-statement`,
  );

  return mapMacrotrendsCashFlow(extractMacrotrendsOriginalData(html));
}

export async function fetchValuationAutofill(
  rawTicker: string,
): Promise<StockValuationAutofillResult> {
  const ticker = cleanTicker(rawTicker);
  const warnings: string[] = [];

  if (!ticker) {
    return {
      ok: false,
      input: buildDefaultStockValuationInput(),
      fields: {},
      warnings: ["Ticker is required."],
    };
  }

  const [yahooResult, yahooTtmResult, secResult, ibkrResult] = await Promise.allSettled([
    fetchYahooQuote(ticker),
    fetchYahooTtmMetrics(ticker),
    fetchSecCompanyFacts(ticker),
    fetchIbkrSnapshot(ticker),
  ]);
  const yahooFields: StockValuationAutofillFields =
    yahooResult.status === "fulfilled" ? yahooResult.value : {};
  const yahooTtmMetrics: YahooTtmFields =
    yahooTtmResult.status === "fulfilled" ? yahooTtmResult.value : { fields: {} };
  const secFields: StockValuationAutofillFieldsWithHistory =
    secResult.status === "fulfilled" ? secResult.value : {};
  const ibkrFields: StockValuationAutofillFields =
    ibkrResult.status === "fulfilled" ? ibkrResult.value : {};
  const hasSecIfrsFields = Object.values(secFields).some(
    (value) =>
      value &&
      typeof value === "object" &&
      "source" in value &&
      (value as ValuationField<unknown>).source === "SEC IFRS",
  );
  const alphaResult = await Promise.allSettled([
    fetchAlphaOverview(ticker, hasSecIfrsFields),
  ]);
  const alphaFields: StockValuationAutofillFields =
    alphaResult[0].status === "fulfilled" ? alphaResult[0].value : {};

  if (yahooResult.status === "rejected") {
    warnings.push(`Yahoo quote unavailable: ${yahooResult.reason instanceof Error ? yahooResult.reason.message : "unknown error"}`);
  }
  if (alphaResult[0].status === "rejected" && env.ALPHA_VANTAGE_API_KEY) {
    warnings.push(`Alpha Vantage unavailable: ${alphaResult[0].reason instanceof Error ? alphaResult[0].reason.message : "unknown error"}`);
  }
  if (secResult.status === "rejected") {
    warnings.push(`SEC CompanyFacts unavailable: ${secResult.reason instanceof Error ? secResult.reason.message : "unknown error"}`);
  }
  if (ibkrResult.status === "rejected") {
    warnings.push(`IBKR optional provider unavailable: ${ibkrResult.reason instanceof Error ? ibkrResult.reason.message : "unknown error"}`);
  }

  const companyName =
    secFields.companyName?.value ??
    alphaFields.companyName?.value ??
    yahooFields.companyName?.value ??
    ticker;
  const macroResult = await Promise.allSettled([
    fetchMacrotrendsFallback(ticker, typeof companyName === "string" ? companyName : ticker),
  ]);
  const macroFields: StockValuationAutofillFieldsWithHistory =
    macroResult[0].status === "fulfilled" ? macroResult[0].value : {};

  if (macroResult[0].status === "rejected") {
    warnings.push(
      `Macrotrends fallback unavailable: ${
        macroResult[0].reason instanceof Error ? macroResult[0].reason.message : "unknown error"
      }`,
    );
  }

  const quoteCurrency =
    yahooFields.currency?.value ??
    alphaFields.currency?.value ??
    ibkrFields.currency?.value ??
    "USD";
  let yahooTtmFields = yahooTtmMetrics.fields;
  if (
    yahooTtmMetrics.currency &&
    quoteCurrency &&
    yahooTtmMetrics.currency.toUpperCase() !== quoteCurrency.toUpperCase() &&
    (yahooTtmFields.freeCashFlow || yahooTtmFields.ebitda || yahooTtmFields.eps)
  ) {
    try {
      const fxRate = await fetchYahooFxRate(yahooTtmMetrics.currency, quoteCurrency);
      if (fxRate) {
        yahooTtmFields = convertYahooTtmFieldsToCurrency(
          yahooTtmFields,
          fxRate,
          yahooTtmMetrics.currency,
          quoteCurrency,
        );
        warnings.push(
          `Yahoo TTM metrics converted from ${yahooTtmMetrics.currency.toUpperCase()} to ${quoteCurrency.toUpperCase()}.`,
        );
      } else {
        yahooTtmFields = {};
        warnings.push(
          `Yahoo TTM metrics are ${yahooTtmMetrics.currency.toUpperCase()} and need FX conversion to ${quoteCurrency.toUpperCase()}.`,
        );
      }
    } catch (error) {
      yahooTtmFields = {};
      warnings.push(
        `Yahoo FX conversion unavailable: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }

  const useMacroCashFlowForIfrs = Boolean(
    hasSecIfrsFields &&
      !yahooTtmFields.freeCashFlow &&
      macroFields.freeCashFlow?.value !== undefined,
  );

  let historicalMultiples =
    secFields.historicalMultiples ??
    ({} as Partial<Record<HistoricalMultipleKey, HistoricalMultipleRow[]>>);
  let historicalMultipleSeries =
    secFields.historicalMultipleSeries ??
    ({} as Partial<
      Record<HistoricalMultipleKey, HistoricalMultipleSeriesPoint[]>
    >);
  if (secFields.historicalFinancialMetrics?.length) {
    try {
      const historicalMultipleData = buildHistoricalMultiples(
        secFields.historicalFinancialMetrics,
        await fetchYahooHistoricalPrices(ticker, secFields.historicalFinancialMetrics),
      );
      historicalMultiples = historicalMultipleData.historicalMultiples;
      historicalMultipleSeries = historicalMultipleData.historicalMultipleSeries;
    } catch (error) {
      warnings.push(
        `Yahoo historical prices unavailable: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }
  const historicalMultipleBenchmarks = await fetchFinanceChartsHistoricalMultipleBenchmarks(
    ticker,
  );

  const secFieldsForMerge = hasSecIfrsFields
    ? {
        ...secFields,
        ebitda: undefined,
        eps: undefined,
        freeCashFlow: useMacroCashFlowForIfrs ? undefined : secFields.freeCashFlow,
        sharesOutstanding: undefined,
      }
    : secFields;
  const yahooTtmCurrentFields: StockValuationAutofillFields = {
    freeCashFlow: yahooTtmFields.freeCashFlow,
    ebitda: yahooTtmFields.ebitda,
    eps: yahooTtmFields.eps,
  };
  const yahooTtmFallbackFields: StockValuationAutofillFields = {
    sharesOutstanding: yahooTtmFields.sharesOutstanding,
  };
  const fields = mergeFields(
    yahooTtmCurrentFields,
    secFieldsForMerge,
    alphaFields,
    macroFields,
    ibkrFields,
    yahooFields,
    yahooTtmFallbackFields,
  );
  const historicalFreeCashFlows =
    hasSecIfrsFields && macroFields.historicalFreeCashFlows?.length
      ? macroFields.historicalFreeCashFlows
      : secFields.historicalFreeCashFlows?.length
      ? secFields.historicalFreeCashFlows
      : macroFields.historicalFreeCashFlows ?? [];
  if (hasSecIfrsFields) {
    warnings.push("SEC IFRS found but needs FX normalization for direct USD valuation fields.");
  }
  if (useMacroCashFlowForIfrs) {
    warnings.push("Macrotrends used for USD cash-flow history.");
  }
  if (
    hasSecIfrsFields &&
    macroFields.historicalFreeCashFlows?.length &&
    fields.freeCashFlow?.source !== "Macrotrends"
  ) {
    warnings.push("Macrotrends used for historical USD cash-flow rows.");
  }
  if (
    hasSecIfrsFields &&
    (!historicalMultiples.priceToFreeCashFlow?.length ||
      !historicalMultiples.peRatio?.length ||
      !historicalMultiples.evToEbitda?.length ||
      Object.values(historicalMultiples).some((rows) => rows?.some((row) => row.needsReview)))
  ) {
    warnings.push("Historical multiples are partial; review currency and ADR ratio before applying.");
  }
  if (secFields.freeCashFlow?.source === "SEC FY") {
    warnings.push("SEC TTM free cash flow unavailable; latest full-year SEC cash flow was used.");
  }
  if (historicalFreeCashFlows.length > 0 && historicalFreeCashFlows.length < 11) {
    warnings.push("Historical free cash flow history is partial; fill missing years manually.");
  }
  if (!fields.freeCashFlow) {
    warnings.push("Free cash flow unavailable; enter it manually.");
  }
  const input = buildDefaultStockValuationInput({
    ticker,
    companyName: typeof companyName === "string" ? companyName : ticker,
    currentPrice: fields.currentPrice?.value ?? null,
    sharesOutstanding: fields.sharesOutstanding?.value ?? null,
    currency: fields.currency?.value ?? "USD",
    fields,
    historicalFreeCashFlows,
    historicalMultiples,
    historicalMultipleSeries,
    historicalMultipleBenchmarks,
  });

  return {
    ok: true,
    input,
    fields,
    warnings,
  };
}
