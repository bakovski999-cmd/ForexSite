import { env } from "@/lib/env";

export type ValuationQuoteSnapshot = {
  ticker: string;
  currentPrice: number | null;
  currency: string | null;
  source: "Yahoo";
  error: string | null;
};

const requestHeaders = {
  "User-Agent": `ForexSite valuation quotes (${env.NEXT_PUBLIC_APP_URL})`,
  Accept: "application/json,*/*;q=0.8",
};

function cleanTicker(ticker: string) {
  return ticker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function parseFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapYahooChartQuote(ticker: string, payload: unknown): ValuationQuoteSnapshot {
  const result = (payload as { chart?: { result?: Array<{ meta?: Record<string, unknown> }> } })
    ?.chart?.result?.[0];
  const meta = result?.meta ?? {};
  const currentPrice = parseFiniteNumber(meta.regularMarketPrice);
  const currency = typeof meta.currency === "string" ? meta.currency : null;

  return {
    ticker,
    currentPrice,
    currency,
    source: "Yahoo",
    error: currentPrice === null ? "Yahoo quote did not include a current price." : null,
  };
}

export async function fetchValuationQuote(ticker: string): Promise<ValuationQuoteSnapshot> {
  const cleanedTicker = cleanTicker(ticker);

  if (!cleanedTicker) {
    return {
      ticker: "",
      currentPrice: null,
      currency: null,
      source: "Yahoo",
      error: "Missing ticker.",
    };
  }

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanedTicker)}?range=1d&interval=1d`,
      {
        headers: requestHeaders,
        next: { revalidate: 60 },
      },
    );

    if (!response.ok) {
      throw new Error(`Yahoo quote failed with HTTP ${response.status}.`);
    }

    return mapYahooChartQuote(cleanedTicker, await response.json());
  } catch (error) {
    return {
      ticker: cleanedTicker,
      currentPrice: null,
      currency: null,
      source: "Yahoo",
      error: error instanceof Error ? error.message : "Yahoo quote failed.",
    };
  }
}

export async function fetchValuationQuotes(tickers: string[]) {
  const cleanedTickers = Array.from(new Set(tickers.map(cleanTicker).filter(Boolean))).slice(0, 30);

  return Promise.all(cleanedTickers.map((ticker) => fetchValuationQuote(ticker)));
}
