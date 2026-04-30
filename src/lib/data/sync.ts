import { differenceInSeconds } from "date-fns";

import { fetchAlphaVantageBundle } from "@/lib/data/fetchers/alpha-vantage";
import { fetchCotSeries } from "@/lib/data/fetchers/cftc";
import {
  fetchFreeOfficialCalendarEvents,
  fetchTradingEconomicsCalendarEvents,
} from "@/lib/data/fetchers/economic-calendar";
import { fetchFredSeries } from "@/lib/data/fetchers/fred";
import { fetchGdeltGoldNews } from "@/lib/data/fetchers/gdelt";
import { analyzeNewsItem } from "@/lib/data/fetchers/openai";
import { getDashboardRepository } from "@/lib/data/repository";
import { env, hasOpenAI } from "@/lib/env";
import { isLiveCalendarEvent, isLiveNewsItem } from "@/lib/live-data";
import { buildSignalRun } from "@/lib/scoring";
import {
  hasCotData,
  hasLiveGdeltNews,
  hasMacroData,
  hasUsableLivePrice,
  sourceHealthFromAttempt,
} from "@/lib/source-health";
import type { DashboardSnapshot, MacroSeries, NewsItem, SourceHealth, SyncRun } from "@/lib/types";

function makeSyncRun(
  source: string,
  status: SyncRun["status"],
  detail?: Record<string, unknown>,
  errorMessage?: string,
): SyncRun {
  const now = new Date().toISOString();
  return {
    id: `${source}-${now}`,
    source,
    status,
    startedAt: now,
    finishedAt: now,
    detail,
    errorMessage,
  } satisfies SyncRun;
}

function mergeSyncRuns(current: DashboardSnapshot, runs: SyncRun[]) {
  return [...runs, ...current.syncRuns].slice(0, 10);
}

function replaceAlphaVantageHealth(current: DashboardSnapshot, health: SourceHealth) {
  return {
    ...current.staleFlags,
    alphaVantage: health,
    openai: (hasOpenAI ? "fresh" : "fallback") as SourceHealth,
  };
}

async function withRetry<T>(label: string, task: () => Promise<T>, attempts = 2) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} request failed.`);
}

function dedupeNewsItems(items: NewsItem[]) {
  const seen = new Set<string>();

  return items
    .filter((item) => {
      const key = item.dedupeHash || item.url || item.title;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime());
}

async function fetchCalendarForSync(current: DashboardSnapshot) {
  const lastLiveEvents = (current.calendarEvents ?? []).filter(isLiveCalendarEvent);

  try {
    const source = env.TRADING_ECONOMICS_API_KEY ? "trading-economics-calendar" : "free-calendar";
    const events = env.TRADING_ECONOMICS_API_KEY
      ? await fetchTradingEconomicsCalendarEvents()
      : await fetchFreeOfficialCalendarEvents();

    if (!events.length) {
      return {
        events: lastLiveEvents,
        run: makeSyncRun(source, "warning", { reason: "no_gold_relevant_events" }),
      };
    }

    return {
      events: events.filter(isLiveCalendarEvent),
      run: makeSyncRun(source, "success", { items: events.length }),
    };
  } catch (error) {
    return {
      events: lastLiveEvents,
      run: makeSyncRun(
        env.TRADING_ECONOMICS_API_KEY ? "trading-economics-calendar" : "free-calendar",
        "warning",
        undefined,
        error instanceof Error ? error.message : "Calendar sync failed",
      ),
    };
  }
}

export async function getDashboardSnapshot() {
  const repo = getDashboardRepository();
  return repo.getSnapshot();
}

export function getRefreshCooldownState(snapshot: DashboardSnapshot) {
  const lastSync = snapshot.syncRuns[0];

  if (!lastSync) {
    return {
      locked: false,
      retryAfterSeconds: 0,
    };
  }

  const cooldownEndsAt = new Date(
    new Date(lastSync.finishedAt).getTime() + env.APP_REFRESH_COOLDOWN_SECONDS * 1000,
  );
  const retryAfterSeconds = differenceInSeconds(cooldownEndsAt, new Date());

  return {
    locked: retryAfterSeconds > 0,
    retryAfterSeconds: Math.max(retryAfterSeconds, 0),
    lastSync,
  };
}

export async function syncDashboardSnapshot(options?: { force?: boolean }) {
  const repo = getDashboardRepository();
  const current = await repo.getSnapshot();

  if (!options?.force) {
    const cooldown = getRefreshCooldownState(current);
    if (cooldown.locked) {
      return current;
    }
  }

  const calendarResult = await fetchCalendarForSync(current);
  const shouldFetchPublicData = env.NODE_ENV !== "test";

  const [alphaResult, gdeltResult, cotCombinedResult, cotFuturesResult, macroResult] = await Promise.allSettled([
    withRetry("alpha-vantage", () => fetchAlphaVantageBundle(), 2),
    shouldFetchPublicData ? withRetry("gdelt", () => fetchGdeltGoldNews(), 2) : Promise.resolve([]),
    shouldFetchPublicData
      ? withRetry("cftc-combined", () => fetchCotSeries("combined"), 2)
      : Promise.reject(new Error("Public CFTC sync skipped in tests")),
    shouldFetchPublicData
      ? withRetry("cftc-futures", () => fetchCotSeries("futures_only"), 2)
      : Promise.reject(new Error("Public CFTC sync skipped in tests")),
    env.FRED_API_KEY
      ? withRetry("fred", () =>
          Promise.all([
            fetchFredSeries("DTWEXBGS"),
            fetchFredSeries("DFII10"),
            fetchFredSeries("DGS10"),
            fetchFredSeries("FEDFUNDS"),
            fetchFredSeries("CPIAUCSL"),
          ]),
        )
      : Promise.reject(new Error("Missing FRED_API_KEY")),
  ]);

  const alphaCandidate = alphaResult.status === "fulfilled" ? alphaResult.value : null;
  const alphaHealth = sourceHealthFromAttempt(
    alphaCandidate?.health === "fresh",
    hasUsableLivePrice(current.price),
  );
  const alpha =
    alphaCandidate?.health === "fresh"
      ? alphaCandidate
      : {
          price: current.price,
          news: alphaCandidate?.news ?? ([] as NewsItem[]),
          health: alphaHealth,
        };
  const gdeltNews = gdeltResult.status === "fulfilled" ? gdeltResult.value : [];
  const cotSeries =
    cotCombinedResult.status === "fulfilled" && cotFuturesResult.status === "fulfilled"
      ? [cotCombinedResult.value, cotFuturesResult.value]
      : current.cotSeries;
  const macroSeries: MacroSeries[] =
    macroResult.status === "fulfilled" ? macroResult.value : current.macroSeries;
  const normalizedNews = dedupeNewsItems([...alpha.news, ...gdeltNews].filter(isLiveNewsItem)).slice(0, 12);
  const analyzedNews = normalizedNews.length
    ? await Promise.all(
        normalizedNews.slice(0, 10).map(async (item) => {
          const analysis = await analyzeNewsItem(item);
          return { item, analysis };
        }),
      )
    : current.news.slice(0, 10);

  const signal = buildSignalRun({
    news: analyzedNews,
    cotSeries,
    macroSeries,
    price: alpha.price,
  });

  const snapshot: DashboardSnapshot = {
    generatedAt: new Date().toISOString(),
    price: alpha.price,
    news: analyzedNews,
    calendarEvents: calendarResult.events,
    cotSeries,
    macroSeries,
    signal,
    signalHistory: [signal, ...current.signalHistory].slice(0, 8),
    staleFlags: {
      ...replaceAlphaVantageHealth(current, alpha.health),
      gdelt: sourceHealthFromAttempt(gdeltResult.status === "fulfilled", hasLiveGdeltNews(current.news)),
      fred: sourceHealthFromAttempt(macroResult.status === "fulfilled", hasMacroData(current.macroSeries)),
      cftc:
        sourceHealthFromAttempt(
          cotCombinedResult.status === "fulfilled" && cotFuturesResult.status === "fulfilled",
          hasCotData(current.cotSeries),
        ),
    },
    syncRuns: mergeSyncRuns(
      current,
      [
        makeSyncRun("alpha-vantage", alphaResult.status === "fulfilled" ? "success" : "warning", {
          items: alpha.news.length,
        }),
        makeSyncRun("gdelt", gdeltResult.status === "fulfilled" ? "success" : "warning", {
          items: gdeltNews.length,
        }),
        makeSyncRun("fred", macroResult.status === "fulfilled" ? "success" : "warning"),
        makeSyncRun(
          "cftc",
          cotCombinedResult.status === "fulfilled" && cotFuturesResult.status === "fulfilled"
            ? "success"
            : "warning",
        ),
        calendarResult.run,
      ].filter((run): run is SyncRun => Boolean(run)),
    ),
  };

  await repo.saveSnapshot(snapshot);
  return snapshot;
}
