import { describe, expect, test } from "vitest";

import { normalizeNewsFeed } from "@/lib/data/fetchers/alpha-vantage";
import { parseCotCsv } from "@/lib/data/fetchers/cftc";
import {
  calendarActualResolvers,
  enrichCalendarEventsWithOfficialActuals,
  mapEcbJsonDataToOfficialFacts,
  mapEstatJsonToOfficialFacts,
  mapEurostatDatasetToOfficialFacts,
  mapForexFactoryCalendarItemsToEvents,
  mapFredReleaseDatesToCalendarEvents,
  parseInvestingCalendarActual,
  parseIsmManufacturingReportActuals,
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

  test("FRED package releases become published instead of source-pending after release time", () => {
    const events = mapFredReleaseDatesToCalendarEvents([
      {
        release_id: 53,
        release_name: "Gross Domestic Product",
        date: "2020-04-30",
      },
    ]);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: "Gross Domestic Product (GDP)",
      forecastStatus: "not_applicable",
      actual: "Публикувано",
      actualSource: "FRED release calendar",
      actualStatus: "published",
    });
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

  test("ISM report parser reads manufacturing PMI and prices values", () => {
    const actuals = parseIsmManufacturingReportActuals(`
      <p>The Manufacturing PMI<sup>®</sup>&nbsp;registered 52.7 percent in April,
      the same reading as March.</p>
      <p>The Prices Index remained in expansion, registering 84.6 percent,
      a 6.3-percentage point jump from March's reading of 78.3 percent.</p>
    `);

    expect(actuals.pmi).toBe("52.7");
    expect(actuals.prices).toBe("84.6");
  });

  test("Investing fallback parser reads latest actual and release date", () => {
    const actual = parseInvestingCalendarActual(`
      <span>Latest Release</span><span>May 01, 2026</span>
      <span>Actual</span><span>52.7</span>
      <span>Forecast</span><span>53.1</span>
    `);

    expect(actual).toEqual({
      actual: "52.7",
      observationDate: "2026-05-01",
    });
  });

  test("ForexFactory ISM event without actual is enriched from fallback facts", () => {
    const [event] = mapForexFactoryCalendarItemsToEvents([
      {
        title: "ISM Manufacturing PMI",
        country: "USD",
        date: "2026-05-01T10:00:00-04:00",
        impact: "Medium",
        forecast: "53.1",
        previous: "52.7",
      },
    ]);
    const [enriched] = enrichCalendarEventsWithOfficialActuals(
      [event],
      new Map([
        [
          "^ism manufacturing pmi$",
          [{
            actual: "52.7",
            period: "release 01.05.2026",
            observationDate: "2026-05-01",
            source: "Investing.com economic calendar fallback",
            sourceUrl: "https://www.investing.com/economic-calendar/ism-manufacturing-pmi-173",
          }],
        ],
      ]),
      new Date("2026-05-01T15:00:00.000Z"),
    );

    expect(enriched).toMatchObject({
      actual: "52.7",
      actualSource: "Investing.com economic calendar fallback",
      actualStatus: "published",
      expectedGoldImpact: "bullish",
    });
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

  test("Eurostat GDP mapper returns the latest official quarter", () => {
    const rule: Parameters<typeof mapEurostatDatasetToOfficialFacts>[0] = {
      provider: "eurostat",
      pattern: /^german prelim gdp q\/q$/i,
      dataset: "namq_10_gdp",
      params: {},
      cadence: "quarterly",
      metric: "valuePercent",
      decimals: 1,
      source: "Eurostat / German GDP",
      sourceUrl: "https://ec.europa.eu/eurostat/databrowser/view/namq_10_gdp/default/table",
    };
    const facts = mapEurostatDatasetToOfficialFacts(rule, {
      id: ["freq", "unit", "s_adj", "na_item", "geo", "time"],
      size: [1, 1, 1, 1, 1, 2],
      dimension: {
        time: {
          category: {
            index: {
              "2025-Q4": 0,
              "2026-Q1": 1,
            },
          },
        },
      },
      value: {
        "0": 0.2,
        "1": 0.3,
      },
    });

    expect(facts[0]).toMatchObject({
      actual: "0.3%",
      period: "Q1 2026",
      observationDate: "2026-03-31",
      source: "Eurostat / German GDP",
    });
  });

  test("Eurostat CPI mapper returns monthly flash-style values", () => {
    const rule: Parameters<typeof mapEurostatDatasetToOfficialFacts>[0] = {
      provider: "eurostat",
      pattern: /^cpi flash estimate y\/y$/i,
      dataset: "ei_cphi_m",
      params: {},
      cadence: "monthly",
      metric: "valuePercent",
      decimals: 1,
      source: "Eurostat / HICP flash inflation",
      sourceUrl: "https://ec.europa.eu/eurostat/databrowser/view/ei_cphi_m/default/table",
    };
    const facts = mapEurostatDatasetToOfficialFacts(rule, {
      id: ["freq", "unit", "coicop", "geo", "time"],
      size: [1, 1, 1, 1, 2],
      dimension: {
        time: {
          category: {
            index: {
              "2026-03": 0,
              "2026-04": 1,
            },
          },
        },
      },
      value: {
        "0": 2.5,
        "1": 2.6,
      },
    });

    expect(facts[0]).toMatchObject({
      actual: "2.6%",
      period: "април 2026",
      observationDate: "2026-04-01",
      source: "Eurostat / HICP flash inflation",
    });
  });

  test("ECB Data Portal mapper returns the latest policy rate", () => {
    const rule: Parameters<typeof mapEcbJsonDataToOfficialFacts>[0] = {
      provider: "ecb",
      pattern: /^main refinancing rate$/i,
      dataPath: "FM/D.U2.EUR.4F.KR.MRR_FR.LEV",
      cadence: "daily",
      metric: "valuePercent",
      decimals: 2,
      source: "ECB Data Portal / Main refinancing rate",
      sourceUrl: "https://data.ecb.europa.eu/data/datasets/FM/FM.D.U2.EUR.4F.KR.MRR_FR.LEV",
    };
    const facts = mapEcbJsonDataToOfficialFacts(rule, {
      dataSets: [
        {
          series: {
            "0:0:0:0:0:0:0": {
              observations: {
                "0": [2.15],
                "1": [2.15],
              },
            },
          },
        },
      ],
      structure: {
        dimensions: {
          observation: [
            {
              id: "TIME_PERIOD",
              role: "time",
              values: [
                { id: "2026-04-29" },
                { id: "2026-04-30" },
              ],
            },
          ],
        },
      },
    });

    expect(facts[0]).toMatchObject({
      actual: "2.15%",
      period: "30.04.2026",
      observationDate: "2026-04-30",
      source: "ECB Data Portal / Main refinancing rate",
    });
  });

  test("calendar actual resolver registry includes JPY e-Stat coverage", () => {
    expect(
      calendarActualResolvers.some(
        (rule) => rule.provider === "estat" && rule.pattern.test("Tokyo Core CPI y/y"),
      ),
    ).toBe(true);
  });

  test("e-Stat Tokyo CPI mapper returns the latest official monthly value", () => {
    const rule = calendarActualResolvers.find(
      (entry) => entry.provider === "estat" && entry.pattern.test("Tokyo Core CPI y/y"),
    );

    expect(rule?.provider).toBe("estat");

    if (!rule || rule.provider !== "estat") {
      throw new Error("Missing e-Stat Tokyo CPI resolver");
    }

    const facts = mapEstatJsonToOfficialFacts(rule, {
      GET_STATS_DATA: {
        STATISTICAL_DATA: {
          CLASS_INF: {
            CLASS_OBJ: [
              {
                "@id": "tab",
                CLASS: [{ "@code": "2", "@name": "Change over the year" }],
              },
              {
                "@id": "cat01",
                CLASS: [{ "@code": "0001", "@name": "All items, less fresh food" }],
              },
              {
                "@id": "area",
                CLASS: [{ "@code": "13100", "@name": "Ku-area of Tokyo" }],
              },
            ],
          },
          DATA_INF: {
            VALUE: [
              {
                "@tab": "2",
                "@cat01": "0001",
                "@area": "13100",
                "@time": "202603",
                "$": "1.7",
              },
              {
                "@tab": "2",
                "@cat01": "0001",
                "@area": "13100",
                "@time": "202604",
                "$": "1.9",
              },
            ],
          },
        },
      },
    });

    expect(facts[0]).toMatchObject({
      actual: "1.9%",
      period: "април 2026",
      observationDate: "2026-04-01",
      source: "e-Stat / Statistics Bureau Japan Tokyo CPI",
      trustTier: "official",
    });
  });

  test("official actual priority does not overwrite trusted facts with public fallback", () => {
    const [event] = mapForexFactoryCalendarItemsToEvents([
      {
        title: "ISM Manufacturing PMI",
        country: "USD",
        date: "2026-05-01T10:00:00-04:00",
        impact: "Medium",
        forecast: "53.1",
        previous: "52.7",
      },
    ]);
    const [enriched] = enrichCalendarEventsWithOfficialActuals(
      [event],
      new Map([
        [
          "^ism manufacturing pmi$",
          [
            {
              actual: "51.0",
              period: "release 01.05.2026",
              observationDate: "2026-05-01",
              source: "Investing.com economic calendar fallback",
              sourceUrl: "https://www.investing.com/economic-calendar/ism-manufacturing-pmi-173",
              trustTier: "public_fallback",
            },
            {
              actual: "52.7",
              period: "release 01.05.2026",
              observationDate: "2026-05-01",
              source: "ISM official report",
              sourceUrl: "https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/pmi/april/",
              trustTier: "official",
            },
          ],
        ],
      ]),
      new Date("2026-05-01T15:00:00.000Z"),
    );

    expect(enriched).toMatchObject({
      actual: "52.7",
      actualSource: "ISM official report",
      actualTrustTier: "official",
    });
  });

  test("EUR events receive official actuals when ForexFactory actual is missing", () => {
    const [gdpEvent, rateEvent, statementEvent] = mapForexFactoryCalendarItemsToEvents([
      {
        title: "German Prelim GDP q/q",
        country: "EUR",
        date: "2026-04-30T04:00:00-04:00",
        impact: "Medium",
        previous: "0.3%",
        forecast: "0.1%",
      },
      {
        title: "Main Refinancing Rate",
        country: "EUR",
        date: "2026-04-30T08:15:00-04:00",
        impact: "High",
        previous: "2.15%",
        forecast: "2.15%",
      },
      {
        title: "Monetary Policy Statement",
        country: "EUR",
        date: "2026-04-30T08:15:00-04:00",
        impact: "High",
      },
    ]);
    const enriched = enrichCalendarEventsWithOfficialActuals(
      [gdpEvent, rateEvent, statementEvent],
      new Map([
        [
          "^german prelim gdp q\\/q$",
          [
            {
              actual: "0.3%",
              period: "Q1 2026",
              observationDate: "2026-03-31",
              source: "Eurostat / German GDP",
              sourceUrl: "https://ec.europa.eu/eurostat/databrowser/view/namq_10_gdp/default/table",
            },
          ],
        ],
        [
          "^main refinancing rate$",
          [
            {
              actual: "2.15%",
              period: "30.04.2026",
              observationDate: "2026-04-30",
              source: "ECB Data Portal / Main refinancing rate",
              sourceUrl: "https://data.ecb.europa.eu/data/datasets/FM/FM.D.U2.EUR.4F.KR.MRR_FR.LEV",
            },
          ],
        ],
      ]),
      new Date("2026-05-01T04:00:00.000Z"),
    );

    expect(enriched[0]).toMatchObject({
      actual: "0.3%",
      actualStatus: "published",
      actualSource: "Eurostat / German GDP",
    });
    expect(enriched[1]).toMatchObject({
      actual: "2.15%",
      actualStatus: "published",
      actualSource: "ECB Data Portal / Main refinancing rate",
      expectedGoldImpact: "neutral",
    });
    expect(enriched[2]).toMatchObject({
      actual: "Публикувано",
      actualStatus: "published",
      actualSource: "European Central Bank",
      expectedGoldImpact: "mixed",
    });
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
