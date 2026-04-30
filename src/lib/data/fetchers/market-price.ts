import { parse } from "csv-parse/sync";

import type { GoldPriceSnapshot, PricePoint } from "@/lib/types";
import { clamp } from "@/lib/utils";

const STOOQ_XAUUSD_URL = "https://stooq.com/q/l/?s=xauusd&f=sd2t2ohlcv&h&e=csv";
const YAHOO_GOLD_FUTURES_URL = "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1mo&interval=1d";

type StooqQuoteRow = {
  Symbol?: string;
  Date?: string;
  Time?: string;
  Open?: string;
  High?: string;
  Low?: string;
  Close?: string;
  Volume?: string;
};

type StooqQuote = {
  date: string;
  time: string;
  close: number;
};

type YahooChartPayload = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
};

export function parseStooqXauUsdQuote(csvText: string) {
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as StooqQuoteRow[];

  const row = rows[0];
  const close = Number(row?.Close);

  if (!row?.Date || !row.Time || !Number.isFinite(close) || close <= 0) {
    throw new Error("Stooq XAU/USD quote did not include a valid close price.");
  }

  return {
    date: row.Date,
    time: row.Time,
    close,
  } satisfies StooqQuote;
}

export function mapYahooGoldHistory(payload: YahooChartPayload) {
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];

  return timestamps
    .map((timestamp, index) => {
      const value = closes[index];

      if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
      }

      return {
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        value: Number(value.toFixed(2)),
      } satisfies PricePoint;
    })
    .filter((entry): entry is PricePoint => Boolean(entry));
}

function mergeLatestSpot(history: PricePoint[], quote: StooqQuote) {
  const withoutQuoteDate = history.filter((point) => point.date !== quote.date);

  return [...withoutQuoteDate, { date: quote.date, value: Number(quote.close.toFixed(2)) }]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-30);
}

function derivePriceSnapshot(history: PricePoint[], quote: StooqQuote) {
  const points = mergeLatestSpot(history, quote);
  const latest = quote.close;
  const previous = points.at(-2)?.value ?? latest;
  const weekly = points.at(-6)?.value ?? latest;
  const monthly = points[0]?.value ?? latest;
  const monthlyChangePct = monthly ? ((latest - monthly) / monthly) * 100 : 0;
  const weeklyChangePct = weekly ? ((latest - weekly) / weekly) * 100 : 0;
  const dailyChangePct = previous ? ((latest - previous) / previous) * 100 : 0;
  const regimeScore = clamp((weeklyChangePct * 0.06 + monthlyChangePct * 0.03) / 2, -1, 1);
  const regime =
    regimeScore > 0.3 ? "trend-up" : regimeScore < -0.3 ? "trend-down" : dailyChangePct < 0 ? "pullback" : "range";

  return {
    id: `xauusd-${quote.date}-${quote.time}`,
    asOf: new Date(`${quote.date}T${quote.time}Z`).toISOString(),
    symbol: "GOLD",
    priceUsd: Number(latest.toFixed(2)),
    dailyChangePct: Number(dailyChangePct.toFixed(2)),
    weeklyChangePct: Number(weeklyChangePct.toFixed(2)),
    monthlyChangePct: Number(monthlyChangePct.toFixed(2)),
    regime,
    regimeScore: Number(regimeScore.toFixed(3)),
    source: "Stooq XAU/USD spot + Yahoo GC=F history",
    history: points,
  } satisfies GoldPriceSnapshot;
}

async function fetchStooqQuote() {
  const response = await fetch(STOOQ_XAUUSD_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`Stooq XAU/USD quote request failed: ${response.status}`);
  }

  return parseStooqXauUsdQuote(await response.text());
}

async function fetchYahooHistory() {
  const response = await fetch(YAHOO_GOLD_FUTURES_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    return [];
  }

  return mapYahooGoldHistory((await response.json()) as YahooChartPayload);
}

export async function fetchGoldPriceSnapshot() {
  const quote = await fetchStooqQuote();
  const history = await fetchYahooHistory();

  return derivePriceSnapshot(history, quote);
}
