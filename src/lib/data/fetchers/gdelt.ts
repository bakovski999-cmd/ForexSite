import type { GdeltArticle, NewsItem } from "@/lib/types";
import { hashText } from "@/lib/utils";

const GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

type GdeltResponse = {
  articles?: GdeltArticle[];
};

const relevanceTerms = [
  "gold",
  "bullion",
  "xau",
  "comex",
  "fed",
  "fomc",
  "dollar",
  "usd",
  "treasury",
  "yield",
  "real yield",
  "inflation",
  "cpi",
  "pce",
  "central bank",
  "safe haven",
  "geopolitical",
  "etf",
];

function normalizeGdeltDate(value?: string) {
  if (!value) {
    return new Date().toISOString();
  }

  const compactMatch = value.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/);
  if (compactMatch) {
    return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}T${compactMatch[4]}:${compactMatch[5]}:${compactMatch[6]}.000Z`;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function relevanceScore(article: GdeltArticle) {
  const text = `${article.title ?? ""} ${article.domain ?? ""}`.toLowerCase();
  return relevanceTerms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

function topicTags(article: GdeltArticle) {
  const text = `${article.title ?? ""} ${article.domain ?? ""}`.toLowerCase();
  const topics = new Set<string>();

  if (/(dollar|usd)/.test(text)) {
    topics.add("usd");
  }

  if (/(yield|treasury|rates|bond)/.test(text)) {
    topics.add("real_yields");
    topics.add("nominal_yields");
  }

  if (/(inflation|cpi|pce|ppi|prices)/.test(text)) {
    topics.add("inflation");
  }

  if (/(fed|fomc|rate cut|rate decision)/.test(text)) {
    topics.add("fed");
  }

  if (/(geopolitical|war|sanction|safe haven|risk)/.test(text)) {
    topics.add("geopolitics");
    topics.add("risk");
  }

  if (/(central bank|reserve|physical|etf)/.test(text)) {
    topics.add("physical_demand");
  }

  return [...topics];
}

export function normalizeGdeltArticles(articles: GdeltArticle[]) {
  return articles
    .filter((article) => article.title && article.url)
    .map((article) => {
      const dedupeHash = hashText(`${article.title}|${article.url}`);
      const item: NewsItem = {
        id: dedupeHash.slice(0, 16),
        source: article.domain ? `GDELT / ${article.domain}` : "GDELT",
        title: article.title!,
        url: article.url!,
        publishedAt: normalizeGdeltDate(article.seendate),
        rawSummary: article.title!,
        dedupeHash,
        topics: topicTags(article),
      };

      return {
        item,
        score: relevanceScore(article),
      };
    })
    .filter((entry) => entry.score >= 2)
    .sort((left, right) => {
      const dateOrder = new Date(right.item.publishedAt).getTime() - new Date(left.item.publishedAt).getTime();
      return dateOrder || right.score - left.score;
    })
    .map((entry) => entry.item)
    .slice(0, 18);
}

export async function fetchGdeltGoldNews() {
  const url = new URL(GDELT_DOC_URL);
  url.searchParams.set(
    "query",
    '(gold OR bullion OR XAU OR "COMEX gold") (fed OR dollar OR yields OR inflation OR "central bank" OR ETF OR "safe haven" OR geopolitics)',
  );
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("timespan", "3d");
  url.searchParams.set("maxrecords", "75");
  url.searchParams.set("sort", "HybridRel");

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`GDELT news request failed: ${response.status}`);
  }

  const payload = (await response.json()) as GdeltResponse;
  return normalizeGdeltArticles(payload.articles ?? []);
}
