import { describe, expect, test } from "vitest";

import {
  isLiveCalendarEvent,
  isLiveNewsItem,
} from "@/lib/live-data";
import type { EconomicCalendarEvent, NewsItem } from "@/lib/types";

const liveNews = {
  id: "live-news",
  source: "Reuters",
  title: "Gold rises as yields ease",
  url: "https://www.reuters.com/markets/gold-rises",
  publishedAt: "2026-04-27T08:00:00.000Z",
  rawSummary: "Gold rose as yields eased.",
  dedupeHash: "live-news",
  topics: ["gold"],
} satisfies NewsItem;

const liveCalendar = {
  id: "fred-release-10-2026-05-12",
  startsAt: "2026-05-12T12:30:00.000Z",
  country: "САЩ",
  currency: "USD",
  title: "Consumer Price Index (CPI)",
  impact: "high",
  eventType: "inflation",
  relevance: "direct",
  source: "FRED + BLS official data",
  sourceUrl: "https://www.bls.gov/cpi/",
  affectedDrivers: ["inflation", "fed", "real_yields", "usd"],
  expectedGoldImpact: "mixed",
  scenarioBullish: "По-мек CPI може да подкрепи златото.",
  scenarioBearish: "По-горещ CPI може да натисне златото.",
  explanationBg: "CPI влияе върху Fed, реалните доходности и USD.",
} satisfies EconomicCalendarEvent;

describe("live data guards", () => {
  test("allows real news links and blocks demo/example news", () => {
    expect(isLiveNewsItem(liveNews)).toBe(true);
    expect(isLiveNewsItem({ ...liveNews, id: "demo-news", url: "https://example.com/news/1" })).toBe(false);
    expect(isLiveNewsItem({ ...liveNews, source: "Demo seed" })).toBe(false);
  });

  test("allows official calendar events and blocks demo calendar rows", () => {
    expect(isLiveCalendarEvent(liveCalendar)).toBe(true);
    expect(isLiveCalendarEvent({ ...liveCalendar, source: "Demo economic calendar" })).toBe(false);
  });
});
