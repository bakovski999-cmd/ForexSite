import type { AnalyzedNewsItem, EconomicCalendarEvent, NewsItem } from "@/lib/types";

function hasDemoSource(value: string | undefined) {
  return value?.toLowerCase().includes("demo") ?? false;
}

export function isDemoNewsItem(item: NewsItem) {
  let hostname = "";

  try {
    hostname = new URL(item.url).hostname;
  } catch {
    return true;
  }

  return (
    hostname === "example.com" ||
    hostname.endsWith(".example.com") ||
    item.id.startsWith("demo-") ||
    hasDemoSource(item.source)
  );
}

export function isLiveNewsItem(item: NewsItem) {
  return !isDemoNewsItem(item) && /^https?:\/\//.test(item.url);
}

export function isLiveAnalyzedNewsItem(entry: AnalyzedNewsItem) {
  return isLiveNewsItem(entry.item);
}

export function isDemoCalendarEvent(event: EconomicCalendarEvent) {
  return event.id.startsWith("demo-") || hasDemoSource(event.source);
}

export function isLiveCalendarEvent(event: EconomicCalendarEvent) {
  return !isDemoCalendarEvent(event) && Number.isFinite(new Date(event.startsAt).getTime());
}
