import { isLiveAnalyzedNewsItem } from "@/lib/live-data";
import type { AnalyzedNewsItem, CotSeries, GoldPriceSnapshot, MacroSeries, SourceHealth } from "@/lib/types";

export function sourceHealthFromAttempt(succeeded: boolean, hasLastValidData: boolean): SourceHealth {
  if (succeeded) {
    return "fresh";
  }

  return hasLastValidData ? "stale" : "fallback";
}

export function hasUsableLivePrice(price: GoldPriceSnapshot) {
  const source = price.source.toLowerCase();

  return (
    price.priceUsd > 0 &&
    Number.isFinite(new Date(price.asOf).getTime()) &&
    source !== "no live price" &&
    !source.includes("demo")
  );
}

export function hasLiveGdeltNews(news: AnalyzedNewsItem[]) {
  return news.some(
    (entry) => isLiveAnalyzedNewsItem(entry) && entry.item.source.toLowerCase().startsWith("gdelt"),
  );
}

export function hasMacroData(series: MacroSeries[]) {
  return series.some((entry) => entry.snapshots.length > 0);
}

export function hasCotData(series: CotSeries[]) {
  return series.some((entry) => entry.snapshots.length > 0);
}
