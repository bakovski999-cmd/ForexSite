import {
  type HistoricalMultipleBenchmark,
  type HistoricalMultipleKey,
  type HistoricalMultiplePeriodAverage,
  type HistoricalMultiplePeriodKey,
  type HistoricalMultipleSeriesPoint,
} from "@/lib/stock-valuation";

type FinanceChartsMetricConfig = {
  benchmarkPath: string;
  label: string;
};

type FetchHtml = (url: string) => Promise<string>;

const metricConfigs: Record<HistoricalMultipleKey, FinanceChartsMetricConfig> = {
  priceToFreeCashFlow: {
    benchmarkPath: "price-to-free-cash-flow",
    label: "Price to Free Cash Flow",
  },
  peRatio: {
    benchmarkPath: "pe-ratio",
    label: "P/E Ratio",
  },
  evToEbitda: {
    benchmarkPath: "ev-to-ebitda",
    label: "EV to EBITDA Ratio",
  },
};

const periodConfig: Array<{ key: HistoricalMultiplePeriodKey; years: number }> = [
  { key: "TTM", years: 1 },
  { key: "3Y", years: 3 },
  { key: "5Y", years: 5 },
  { key: "10Y", years: 10 },
  { key: "15Y", years: 15 },
  { key: "20Y", years: 20 },
];

function finiteNumber(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function unavailableBenchmark(message: string): HistoricalMultipleBenchmark {
  return {
    source: "FinanceCharts",
    sourceStatus: "unavailable",
    sourceMessage: message,
    currentMultiple: null,
    low: null,
    average: null,
    high: null,
    periodAverages: [],
    seriesPoints: [],
  };
}

function dedupeSeries(points: HistoricalMultipleSeriesPoint[]) {
  const byDate = new Map<string, HistoricalMultipleSeriesPoint>();

  for (const point of points) {
    if (point.date && point.multiple !== null) {
      byDate.set(point.date, point);
    }
  }

  return [...byDate.values()].sort((first, second) =>
    first.date.localeCompare(second.date),
  );
}

function isoDateFromUtcParts(year: string, monthIndex: string, day: string) {
  const date = new Date(
    Date.UTC(Number(year), Number(monthIndex), Number(day)),
  );

  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

function extractDateUtcSeries(html: string): HistoricalMultipleSeriesPoint[] {
  const points: HistoricalMultipleSeriesPoint[] = [];
  const pattern =
    /Date\.UTC\(\s*(\d{4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*\)\s*,\s*(-?\d+(?:\.\d+)?)/g;

  for (const match of html.matchAll(pattern)) {
    const date = isoDateFromUtcParts(match[1], match[2], match[3]);
    const multiple = finiteNumber(match[4]);

    if (!date || multiple === null || multiple <= 0 || multiple > 500) {
      continue;
    }

    points.push({
      date,
      year: Number(date.slice(0, 4)),
      numerator: null,
      denominator: null,
      multiple,
      source: "FinanceCharts",
      asOf: date,
    });
  }

  return points;
}

function extractIsoDateSeries(html: string): HistoricalMultipleSeriesPoint[] {
  const points: HistoricalMultipleSeriesPoint[] = [];
  const pattern =
    /\[\s*["'](\d{4}-\d{2}-\d{2})["']\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/g;

  for (const match of html.matchAll(pattern)) {
    const multiple = finiteNumber(match[2]);

    if (multiple === null || multiple <= 0 || multiple > 500) {
      continue;
    }

    points.push({
      date: match[1],
      year: Number(match[1].slice(0, 4)),
      numerator: null,
      denominator: null,
      multiple,
      source: "FinanceCharts",
      asOf: match[1],
    });
  }

  return points;
}

function extractPeriodValues(html: string) {
  const values = new Map<string, number>();
  const arrayPairPattern =
    /\[\s*["'](Today|TTM|3Y|5Y|10Y|15Y|20Y)["']\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/g;

  for (const match of html.matchAll(arrayPairPattern)) {
    const value = finiteNumber(match[2]);

    if (value !== null && value > 0 && value < 500) {
      values.set(match[1], value);
    }
  }

  if (values.size > 0) {
    return values;
  }

  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

  for (const label of ["Today", "TTM", "3Y", "5Y", "10Y", "15Y", "20Y"]) {
    const match = stripped.match(
      new RegExp(`\\b${label}\\b[^\\d-]{0,80}(-?\\d+(?:\\.\\d+)?)`, "i"),
    );
    const value = match ? finiteNumber(match[1]) : null;

    if (value !== null && value > 0 && value < 500) {
      values.set(label, value);
    }
  }

  return values;
}

function periodAveragesFromValues(
  values: Map<string, number>,
): HistoricalMultiplePeriodAverage[] {
  return periodConfig
    .map((period) => ({
      key: period.key,
      label: period.key,
      years: period.years,
      average: values.get(period.key) ?? null,
      count: values.has(period.key) ? 1 : 0,
    }))
    .filter((period) => period.average !== null);
}

export function financeChartsBenchmarkUrl(
  ticker: string,
  key: HistoricalMultipleKey,
) {
  const clean = ticker.trim().toUpperCase();

  if (!clean) {
    return "https://www.financecharts.com";
  }

  return `https://www.financecharts.com/stocks/${encodeURIComponent(clean)}/value/${metricConfigs[key].benchmarkPath}`;
}

export function parseFinanceChartsHistoricalMultiplePage(
  html: string,
  key: HistoricalMultipleKey,
): HistoricalMultipleBenchmark {
  if (/captcha challenge|captcha/i.test(html)) {
    return unavailableBenchmark("FinanceCharts data unavailable; captcha page returned.");
  }

  const periodValues = extractPeriodValues(html);
  const seriesPoints = dedupeSeries([
    ...extractDateUtcSeries(html),
    ...extractIsoDateSeries(html),
  ]);
  const multiples = seriesPoints
    .map((point) => point.multiple)
    .filter((value): value is number => typeof value === "number" && value > 0);

  if (periodValues.size === 0 && seriesPoints.length === 0) {
    return unavailableBenchmark(
      `FinanceCharts data unavailable; ${metricConfigs[key].label} chart data was not found.`,
    );
  }

  const currentMultiple =
    periodValues.get("Today") ??
    (seriesPoints.length ? seriesPoints.at(-1)?.multiple ?? null : null);

  return {
    source: "FinanceCharts",
    sourceStatus: "available",
    currentMultiple,
    low: multiples.length ? Math.min(...multiples) : null,
    average: average(multiples),
    high: multiples.length ? Math.max(...multiples) : null,
    periodAverages: periodAveragesFromValues(periodValues),
    seriesPoints,
  };
}

async function defaultFetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchFinanceChartsHistoricalMultipleBenchmark(
  ticker: string,
  key: HistoricalMultipleKey,
  fetchHtml: FetchHtml = defaultFetchHtml,
) {
  const url = financeChartsBenchmarkUrl(ticker, key);

  try {
    return parseFinanceChartsHistoricalMultiplePage(await fetchHtml(url), key);
  } catch (error) {
    return unavailableBenchmark(
      `FinanceCharts data unavailable; ${
        error instanceof Error ? error.message : "unknown fetch error"
      }.`,
    );
  }
}

export async function fetchFinanceChartsHistoricalMultipleBenchmarks(
  ticker: string,
  fetchHtml?: FetchHtml,
) {
  const entries = await Promise.all(
    (Object.keys(metricConfigs) as HistoricalMultipleKey[]).map(async (key) => [
      key,
      await fetchFinanceChartsHistoricalMultipleBenchmark(ticker, key, fetchHtml),
    ]),
  );

  return Object.fromEntries(entries) as Partial<
    Record<HistoricalMultipleKey, HistoricalMultipleBenchmark>
  >;
}
