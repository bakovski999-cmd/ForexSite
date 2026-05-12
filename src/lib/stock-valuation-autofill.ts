import { env } from "@/lib/env";
import {
  buildDefaultStockValuationInput,
  type StockValuationAutofillFields,
  type StockValuationAutofillResult,
  type ValuationField,
  type ValuationSource,
} from "@/lib/stock-valuation";

type MacrotrendsRow = Record<string, string>;

type AlphaOverview = Record<string, unknown>;

type SecFactUnit = {
  end?: string;
  fy?: number;
  fp?: string;
  form?: string;
  val?: number;
};

type SecCompanyFacts = {
  cik?: number;
  entityName?: string;
  facts?: {
    "us-gaap"?: Record<string, { units?: Record<string, SecFactUnit[]> }>;
  };
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
    .filter((key) => /^\d{4}$/.test(key))
    .sort((first, second) => Number(second) - Number(first))
    .find((key) => parseNumber(row[key]) !== null);
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

  return field(value === null ? null : value * 1_000_000, "Macrotrends", `${latestYear}-12-31`);
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

export function mapMacrotrendsCashFlow(rows: MacrotrendsRow[]): StockValuationAutofillFields {
  const operatingCashFlow = macroRowMillions(
    findMacroRow(rows, ["cash flow from operating activities"]),
  );
  const capitalExpenditures = macroRowMillions(
    findMacroRow(rows, ["net change in property, plant, and equipment"]) ??
      findMacroRow(rows, ["capital expenditures"]),
  );
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

function latestSecFact(fact: { units?: Record<string, SecFactUnit[]> } | undefined) {
  const values = Object.values(fact?.units ?? {})
    .flat()
    .filter((item) => typeof item.val === "number" && Number.isFinite(item.val));

  if (values.length === 0) {
    return null;
  }

  return [...values].sort((first, second) => {
    const firstDate = first.end ?? String(first.fy ?? "");
    const secondDate = second.end ?? String(second.fy ?? "");

    return secondDate.localeCompare(firstDate);
  })[0];
}

function secNumber(
  facts: SecCompanyFacts,
  conceptNames: string[],
): ValuationField | undefined {
  const usGaap = facts.facts?.["us-gaap"] ?? {};

  for (const conceptName of conceptNames) {
    const fact = latestSecFact(usGaap[conceptName]);
    if (fact?.val !== undefined) {
      return field(fact.val, "SEC", fact.end);
    }
  }

  return undefined;
}

export function mapSecCompanyFacts(facts: SecCompanyFacts): StockValuationAutofillFields {
  const operatingCashFlow = secNumber(facts, [
    "NetCashProvidedByUsedInOperatingActivities",
    "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
  ]);
  const capitalExpenditures = secNumber(facts, [
    "PaymentsToAcquirePropertyPlantAndEquipment",
    "PaymentsToAcquireProductiveAssets",
  ]);
  const freeCashFlow =
    operatingCashFlow?.value !== null &&
    operatingCashFlow?.value !== undefined &&
    capitalExpenditures?.value !== null &&
    capitalExpenditures?.value !== undefined
      ? field(
          capitalExpenditures.value < 0
            ? operatingCashFlow.value + capitalExpenditures.value
            : operatingCashFlow.value - capitalExpenditures.value,
          "SEC",
          operatingCashFlow.asOf,
        )
      : undefined;

  return {
    companyName: field(facts.entityName, "SEC"),
    operatingCashFlow,
    capitalExpenditures,
    freeCashFlow,
    eps: secNumber(facts, ["EarningsPerShareDiluted", "EarningsPerShareBasic"]),
    sharesOutstanding: secNumber(facts, ["EntityCommonStockSharesOutstanding"]),
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

async function fetchJson(url: string) {
  const response = await fetch(url, { headers: requestHeaders, next: { revalidate: 60 * 60 } });
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

async function fetchAlphaOverview(ticker: string) {
  if (!env.ALPHA_VANTAGE_API_KEY) {
    return {};
  }

  const payload = (await fetchJson(
    `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(
      ticker,
    )}&apikey=${encodeURIComponent(env.ALPHA_VANTAGE_API_KEY)}`,
  )) as AlphaOverview;

  if (typeof payload.Information === "string" || typeof payload.Note === "string") {
    return {};
  }

  return mapAlphaVantageOverview(payload);
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
  )) as SecCompanyFacts;

  return mergeFields({ companyName: field(match.title, "SEC") }, mapSecCompanyFacts(companyFacts));
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

  const [yahooResult, alphaResult, secResult] = await Promise.allSettled([
    fetchYahooQuote(ticker),
    fetchAlphaOverview(ticker),
    fetchSecCompanyFacts(ticker),
  ]);
  const yahooFields = yahooResult.status === "fulfilled" ? yahooResult.value : {};
  const alphaFields = alphaResult.status === "fulfilled" ? alphaResult.value : {};
  const secFields = secResult.status === "fulfilled" ? secResult.value : {};

  if (yahooResult.status === "rejected") {
    warnings.push(`Yahoo quote unavailable: ${yahooResult.reason instanceof Error ? yahooResult.reason.message : "unknown error"}`);
  }
  if (alphaResult.status === "rejected") {
    warnings.push(`Alpha Vantage unavailable: ${alphaResult.reason instanceof Error ? alphaResult.reason.message : "unknown error"}`);
  }
  if (secResult.status === "rejected") {
    warnings.push(`SEC CompanyFacts unavailable: ${secResult.reason instanceof Error ? secResult.reason.message : "unknown error"}`);
  }

  const companyName =
    secFields.companyName?.value ??
    alphaFields.companyName?.value ??
    yahooFields.companyName?.value ??
    ticker;
  const macroResult = await Promise.allSettled([
    fetchMacrotrendsFallback(ticker, typeof companyName === "string" ? companyName : ticker),
  ]);
  const macroFields = macroResult[0].status === "fulfilled" ? macroResult[0].value : {};

  if (macroResult[0].status === "rejected") {
    warnings.push(
      `Macrotrends fallback unavailable: ${
        macroResult[0].reason instanceof Error ? macroResult[0].reason.message : "unknown error"
      }`,
    );
  }

  const fields = mergeFields(secFields, alphaFields, macroFields, yahooFields);
  const input = buildDefaultStockValuationInput({
    ticker,
    companyName: typeof companyName === "string" ? companyName : ticker,
    currentPrice: fields.currentPrice?.value ?? null,
    sharesOutstanding: fields.sharesOutstanding?.value ?? null,
    currency: fields.currency?.value ?? "USD",
    fields,
  });

  return {
    ok: true,
    input,
    fields,
    warnings,
  };
}
