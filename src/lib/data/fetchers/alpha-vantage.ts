import { env } from "@/lib/env";
import { fetchGoldPriceSnapshot } from "@/lib/data/fetchers/market-price";
import type {
  AlphaVantageNewsFeedItem,
  GoldPriceSnapshot,
  NewsItem,
} from "@/lib/types";
import { hashText } from "@/lib/utils";

const AV_BASE_URL = "https://www.alphavantage.co/query";

function buildAlphaUrl(params: Record<string, string>) {
  const search = new URLSearchParams({
    apikey: env.ALPHA_VANTAGE_API_KEY ?? "",
    ...params,
  });

  return `${AV_BASE_URL}?${search.toString()}`;
}

function normalizeNewsTopics(value: AlphaVantageNewsFeedItem["topics"]) {
  return value?.map((entry) => entry.topic) ?? [];
}

function normalizePublishedAt(value?: string) {
  if (!value) {
    return new Date().toISOString();
  }

  const normalized = value.replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/,
    "$1-$2-$3T$4:$5:$6Z",
  );

  return normalized;
}

function relevanceScore(item: AlphaVantageNewsFeedItem) {
  const text = `${item.title} ${item.summary ?? ""}`.toLowerCase();
  let score = 0;

  for (const term of [
    "gold",
    "gld",
    "spdr",
    "bullion",
    "xau",
    "comex",
    "treasury",
    "yield",
    "inflation",
    "fed",
    "rate",
    "dollar",
    "central bank",
    "safe haven",
    "geopolitical",
    "etf",
  ]) {
    if (text.includes(term)) {
      score += 1;
    }
  }

  return score;
}

export function normalizeNewsFeed(feed: AlphaVantageNewsFeedItem[]) {
  return feed
    .filter((item) => item.title && item.url)
    .map((item) => {
      const dedupeHash = hashText(`${item.title}|${item.url}`);
      const normalized: NewsItem = {
        id: dedupeHash.slice(0, 16),
        source: item.source ?? "Alpha Vantage",
        title: item.title,
        url: item.url,
        publishedAt: normalizePublishedAt(item.time_published),
        rawSummary: item.summary ?? "",
        dedupeHash,
        overallSentiment: item.overall_sentiment_score,
        topics: normalizeNewsTopics(item.topics),
      };

      return { item: normalized, score: relevanceScore(item) };
    })
    .filter((entry) => entry.score >= 2)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.item)
    .slice(0, 12);
}

function buildFallbackPriceSnapshot() {
  return {
    id: "missing-live-price",
    asOf: new Date().toISOString(),
    symbol: "GOLD",
    priceUsd: 0,
    dailyChangePct: 0,
    weeklyChangePct: 0,
    monthlyChangePct: 0,
    regime: "range",
    regimeScore: 0,
    source: "No live price",
    history: [],
  } satisfies GoldPriceSnapshot;
}

export async function fetchAlphaVantageBundle() {
  const priceResult = await Promise.allSettled([fetchGoldPriceSnapshot()]);
  const price = priceResult[0].status === "fulfilled" ? priceResult[0].value : buildFallbackPriceSnapshot();
  const priceHealth = priceResult[0].status === "fulfilled" ? ("fresh" as const) : ("fallback" as const);

  if (!env.ALPHA_VANTAGE_API_KEY) {
    return {
      price,
      news: [] as NewsItem[],
      health: priceHealth,
    };
  }

  const newsResponse = await fetch(
    buildAlphaUrl({
      function: "NEWS_SENTIMENT",
      tickers: "GLD",
      sort: "LATEST",
      limit: "50",
    }),
  );

  if (!newsResponse.ok) {
    return {
      price,
      news: [],
      health: priceHealth,
    };
  }

  const newsPayload = (await newsResponse.json()) as Record<string, unknown>;
  const news = normalizeNewsFeed((newsPayload.feed as AlphaVantageNewsFeedItem[]) ?? []);

  return {
    price,
    news,
    health: priceHealth,
  };
}
