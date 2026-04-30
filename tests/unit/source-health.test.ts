import { describe, expect, test } from "vitest";

import {
  hasLiveGdeltNews,
  hasUsableLivePrice,
  sourceHealthFromAttempt,
} from "@/lib/source-health";
import type { AnalyzedNewsItem, GoldPriceSnapshot } from "@/lib/types";

function priceSnapshot(overrides: Partial<GoldPriceSnapshot> = {}) {
  return {
    id: "xau-live",
    asOf: "2026-04-30T06:07:02.000Z",
    symbol: "GOLD",
    priceUsd: 4565.3,
    dailyChangePct: 0.1,
    weeklyChangePct: 1.2,
    monthlyChangePct: 4.2,
    regime: "trend-up",
    regimeScore: 0.4,
    source: "Gold API XAU/USD spot",
    history: [{ date: "2026-04-30", value: 4565.3 }],
    ...overrides,
  } satisfies GoldPriceSnapshot;
}

describe("source health helpers", () => {
  test("attempt health distinguishes live, stale, and unavailable sources", () => {
    expect(sourceHealthFromAttempt(true, false)).toBe("fresh");
    expect(sourceHealthFromAttempt(false, true)).toBe("stale");
    expect(sourceHealthFromAttempt(false, false)).toBe("fallback");
  });

  test("usable live price excludes missing and demo prices", () => {
    expect(hasUsableLivePrice(priceSnapshot())).toBe(true);
    expect(hasUsableLivePrice(priceSnapshot({ priceUsd: 0, source: "No live price" }))).toBe(false);
    expect(hasUsableLivePrice(priceSnapshot({ source: "Demo seed" }))).toBe(false);
  });

  test("GDELT detection only accepts live GDELT news", () => {
    const news = [
      {
        item: {
          id: "gdelt-1",
          source: "GDELT / reuters.com",
          title: "Gold rises as yields fall",
          url: "https://reuters.com/markets/gold",
          publishedAt: "2026-04-30T06:00:00.000Z",
          rawSummary: "Gold rises as yields fall",
          dedupeHash: "gdelt-1",
          topics: ["gold"],
        },
        analysis: {
          newsItemId: "gdelt-1",
          summaryBg: "Златото поскъпва.",
          impactDirection: "bullish",
          timeHorizon: "intraday",
          confidence: 0.7,
          affectedDrivers: ["real_yields"],
          whyItMatters: "Доходностите са важни за XAU.",
          explanation: "По-ниски доходности помагат на златото.",
          directionalScore: 0.5,
        },
      },
    ] satisfies AnalyzedNewsItem[];

    expect(hasLiveGdeltNews(news)).toBe(true);
    expect(
      hasLiveGdeltNews([
        {
          ...news[0],
          item: { ...news[0].item, url: "https://example.com/demo", source: "GDELT / example.com" },
        },
      ]),
    ).toBe(false);
  });
});
