import { describe, expect, test } from "vitest";

import { normalizeNewsFeed } from "@/lib/data/fetchers/alpha-vantage";
import { parseCotCsv } from "@/lib/data/fetchers/cftc";
import {
  enrichCalendarEventsWithOfficialActuals,
  mapForexFactoryCalendarItemsToEvents,
  mapFredReleaseDatesToCalendarEvents,
} from "@/lib/data/fetchers/economic-calendar";
import { mapFredSeries } from "@/lib/data/fetchers/fred";
import { normalizeGdeltArticles } from "@/lib/data/fetchers/gdelt";
import {
  mapYahooGoldHistory,
  parseGoldApiXauQuote,
  parseStooqXauUsdQuote,
} from "@/lib/data/fetchers/market-price";
import { analyzeNewsItem } from "@/lib/data/fetchers/openai";
import { syncDashboardSnapshot } from "@/lib/data/sync";

const cotFixture = `"Market_and_Exchange_Names","Report_Date_as_YYYY-MM-DD","Open_Interest_All","Prod_Merc_Positions_Long_All","Prod_Merc_Positions_Short_All","Swap_Positions_Long_All","Swap__Positions_Short_All","M_Money_Positions_Long_All","M_Money_Positions_Short_All","Other_Rept_Positions_Long_All","Other_Rept_Positions_Short_All"
"GOLD - COMMODITY EXCHANGE INC.","2026-04-21","556894","20428","44124","28656","206203","125908","30410","82215","17516"
"GOLD - COMMODITY EXCHANGE INC.","2026-04-14","565169","22048","43817","28767","207687","128638","29788","79525","17257"`;

describe("market data normalization", () => {
  test("COT parser maps gold rows into snapshots", () => {
    const snapshots = parseCotCsv(cotFixture, "combined", "https://example.com/cot");

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].managedMoneyNet).toBe(95498);
    expect(snapshots[0].managedMoneyLongDelta).toBe(-2730);
    expect(snapshots[0].managedMoneyShortDelta).toBe(622);
    expect(snapshots[0].openInterestDelta).toBe(-8275);
    expect(snapshots[0].weeklyDelta).toBe(-3352);
    expect(snapshots[0].producerNet).toBe(-23696);
  });

  test("FRED mapper returns ordered macro snapshots", () => {
    const series = mapFredSeries("DFII10", [
      { date: "2026-04-14", value: "1.89" },
      { date: "2026-04-15", value: "1.90" },
      { date: "2026-04-16", value: "1.93" },
      { date: "2026-04-17", value: "1.90" },
    ]);

    expect(series.snapshots[0].date).toBe("2026-04-17");
    expect(series.snapshots[0].interpretation).toContain("Реалните доходности");
  });

  test("Alpha Vantage news normalization keeps gold-relevant articles", () => {
    const news = normalizeNewsFeed([
      {
        title: "Gold gains as Treasury yields ease and dollar softens",
        url: "https://example.com/1",
        source: "Desk",
        summary: "Gold, yields, and the dollar all feature prominently.",
        time_published: "20260425T064000",
        topics: [{ topic: "economy_monetary" }],
      },
      {
        title: "Unrelated retail earnings story",
        url: "https://example.com/2",
        source: "Desk",
        summary: "No macro context for gold here.",
        time_published: "20260425T074000",
        topics: [{ topic: "retail_wholesale" }],
      },
    ]);

    expect(news).toHaveLength(1);
    expect(news[0].title).toContain("Gold gains");
  });

  test("Stooq XAU/USD quote parser maps the live CSV format", () => {
    const quote = parseStooqXauUsdQuote(
      "Symbol,Date,Time,Open,High,Low,Close,Volume\nXAUUSD,2026-04-27,07:11:52,4693.56,4729.815,4672.585,4719.615,\n",
    );

    expect(quote.date).toBe("2026-04-27");
    expect(quote.close).toBe(4719.615);
  });

  test("Gold API XAU quote parser maps the fallback live format", () => {
    const quote = parseGoldApiXauQuote({
      price: 4565.299805,
      updatedAt: "2026-04-30T06:07:02Z",
    });

    expect(quote.date).toBe("2026-04-30");
    expect(quote.time).toBe("06:07:02");
    expect(quote.close).toBe(4565.299805);
  });

  test("Yahoo GC futures chart maps daily history points", () => {
    const history = mapYahooGoldHistory({
      chart: {
        result: [
          {
            timestamp: [1777075200, 1777161600],
            indicators: {
              quote: [
                {
                  close: [4708.54, null],
                },
              ],
            },
          },
        ],
      },
    });

    expect(history).toEqual([{ date: "2026-04-25", value: 4708.54 }]);
  });

  test("GDELT normalization keeps public gold-relevant articles", () => {
    const news = normalizeGdeltArticles([
      {
        title: "Gold rises as Fed rate-cut hopes pressure dollar and Treasury yields",
        url: "https://news.example/gold",
        domain: "news.example",
        seendate: "20260426T091500Z",
      },
      {
        title: "General lifestyle story with no market relevance",
        url: "https://news.example/lifestyle",
        domain: "news.example",
        seendate: "20260426T101500Z",
      },
    ]);

    expect(news).toHaveLength(1);
    expect(news[0].source).toBe("GDELT / news.example");
    expect(news[0].publishedAt).toBe("2026-04-26T09:15:00.000Z");
  });

  test("FRED release dates map into official gold calendar events", () => {
    const events = mapFredReleaseDatesToCalendarEvents([
      {
        release_id: 10,
        release_name: "Consumer Price Index",
        date: "2026-05-12",
      },
      {
        release_id: 999,
        release_name: "Non-market release",
        date: "2026-05-13",
      },
    ]);

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Consumer Price Index (CPI)");
    expect(events[0].source).toBe("FRED release calendar");
    expect(events[0].impact).toBe("high");
  });

  test("ForexFactory weekly export maps all economic events and excludes holidays", () => {
    const events = mapForexFactoryCalendarItemsToEvents([
      {
        title: "Federal Funds Rate",
        country: "USD",
        date: "2026-04-29T14:00:00-04:00",
        impact: "High",
        forecast: "3.75%",
        previous: "3.75%",
      },
      {
        title: "Low impact unrelated story",
        country: "EUR",
        date: "2026-04-29T14:00:00-04:00",
        impact: "Low",
        forecast: "1.0",
        previous: "0.9",
      },
      {
        title: "Bank Holiday",
        country: "AUD",
        date: "2026-04-29T14:00:00-04:00",
        impact: "Holiday",
      },
    ]);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      title: "Federal Funds Rate",
      source: "ForexFactory weekly export",
      previous: "3.75%",
      latestActual: "3.75%",
      forecast: "3.75%",
      actual: undefined,
      impact: "high",
      eventType: "central_bank",
      relevance: "direct",
    });
    expect(events[1]).toMatchObject({
      title: "Low impact unrelated story",
      impact: "low",
      eventType: "misc",
    });
    expect(events[0].startsAt).toBe("2026-04-29T18:00:00.000Z");
  });

  test("ForexFactory event ids are stable when source order changes", () => {
    const first = mapForexFactoryCalendarItemsToEvents([
      {
        title: "Advance GDP q/q",
        country: "USD",
        date: "2026-04-30T08:30:00-04:00",
        impact: "High",
        forecast: "2.2%",
        previous: "1.4%",
      },
      {
        title: "Core PCE Price Index m/m",
        country: "USD",
        date: "2026-04-30T08:30:00-04:00",
        impact: "High",
      },
    ]);
    const second = mapForexFactoryCalendarItemsToEvents([
      {
        title: "Core PCE Price Index m/m",
        country: "USD",
        date: "2026-04-30T08:30:00-04:00",
        impact: "High",
      },
      {
        title: "Advance GDP q/q",
        country: "USD",
        date: "2026-04-30T08:30:00-04:00",
        impact: "High",
        forecast: "2.2%",
        previous: "1.4%",
      },
    ]);

    expect(first.find((event) => event.title === "Advance GDP q/q")?.id).toBe(
      second.find((event) => event.title === "Advance GDP q/q")?.id,
    );
  });

  test("wage pressure calendar events get directional labels after actuals publish", () => {
    const [event] = mapForexFactoryCalendarItemsToEvents([
      {
        title: "Employment Cost Index q/q",
        country: "USD",
        date: "2026-04-30T08:30:00-04:00",
        impact: "High",
        previous: "0.7%",
        forecast: "0.8%",
        actual: "0.9%",
      },
    ]);

    expect(event.expectedGoldImpact).toBe("bearish");
    expect(event.affectedDrivers).toContain("inflation");
  });

  test("official Fed funds actual uses the observation on or before the event date", () => {
    const [event] = mapForexFactoryCalendarItemsToEvents([
      {
        title: "Federal Funds Rate",
        country: "USD",
        date: "2026-04-29T14:00:00-04:00",
        impact: "High",
        forecast: "3.75%",
        previous: "3.75%",
      },
    ]);
    const [enriched] = enrichCalendarEventsWithOfficialActuals(
      [event],
      new Map([
        [
          "^federal funds rate$",
          [
            {
              actual: "4.00%",
              period: "30.04.2026",
              observationDate: "2026-04-30",
              source: "FRED / Federal Reserve target rate",
              sourceUrl: "https://fred.stlouisfed.org/series/DFEDTARU",
            },
            {
              actual: "3.75%",
              period: "29.04.2026",
              observationDate: "2026-04-29",
              source: "FRED / Federal Reserve target rate",
              sourceUrl: "https://fred.stlouisfed.org/series/DFEDTARU",
            },
          ],
        ],
      ]),
      new Date("2026-05-01T04:00:00.000Z"),
    );

    expect(enriched.actual).toBe("3.75%");
    expect(enriched.actualStatus).toBe("published");
    expect(enriched.expectedGoldImpact).toBe("neutral");
  });

  test("past FOMC statement events are marked as published without numeric actuals", () => {
    const [event] = mapForexFactoryCalendarItemsToEvents([
      {
        title: "FOMC Statement",
        country: "USD",
        date: "2026-04-29T14:00:00-04:00",
        impact: "High",
      },
    ]);
    const [enriched] = enrichCalendarEventsWithOfficialActuals(
      [event],
      new Map(),
      new Date("2026-05-01T04:00:00.000Z"),
    );

    expect(enriched.actual).toBe("Публикувано");
    expect(enriched.actualStatus).toBe("published");
    expect(enriched.expectedGoldImpact).toBe("mixed");
  });

  test("sync remains stable in demo mode across repeated runs", async () => {
    const first = await syncDashboardSnapshot({ force: true });
    const second = await syncDashboardSnapshot({ force: true });

    expect(new Set(first.news.map((entry) => entry.item.id)).size).toBe(first.news.length);
    expect(new Set(second.news.map((entry) => entry.item.id)).size).toBe(second.news.length);
    expect(second.signal.contributions).toHaveLength(4);
  });

  test("news analysis has a rule-based fallback without OpenAI", async () => {
    const analysis = await analyzeNewsItem({
      id: "n1",
      source: "Fixture",
      title: "Gold rises as dollar weakens and real yields fall",
      url: "https://example.com/news",
      publishedAt: "2026-04-25T08:00:00.000Z",
      rawSummary: "The story mentions rate cut hopes and safe haven demand.",
      dedupeHash: "n1",
      topics: ["gold"],
    });

    expect(analysis.impactDirection).toBe("bullish");
    expect(analysis.directionalScore).toBeGreaterThan(0);
  });
});
