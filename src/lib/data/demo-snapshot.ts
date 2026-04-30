import { addDays, subDays, subWeeks } from "date-fns";

import { buildSignalRun } from "@/lib/scoring";
import type {
  AnalyzedNewsItem,
  CotSeries,
  DashboardSnapshot,
  EconomicCalendarEvent,
  GoldPriceSnapshot,
  MacroSeries,
  PricePoint,
  SignalRun,
} from "@/lib/types";
import { hashText } from "@/lib/utils";

function makePriceHistory() {
  return Array.from({ length: 30 }, (_, index) => {
    const date = addDays(new Date("2026-03-27T00:00:00Z"), index);
    const value = 3146 + index * 6.7 + Math.sin(index / 2.6) * 14;
    return {
      date: date.toISOString().slice(0, 10),
      value: Number(value.toFixed(2)),
    } satisfies PricePoint;
  });
}

function makePriceSnapshot() {
  const history = makePriceHistory();
  const latest = history.at(-1)!.value;
  const previous = history.at(-2)!.value;
  const weekly = history.at(-6)!.value;
  const monthly = history[0].value;

  return {
    id: "demo-price",
    asOf: "2026-04-25T07:30:00.000Z",
    symbol: "GOLD",
    priceUsd: latest,
    dailyChangePct: Number((((latest - previous) / previous) * 100).toFixed(2)),
    weeklyChangePct: Number((((latest - weekly) / weekly) * 100).toFixed(2)),
    monthlyChangePct: Number((((latest - monthly) / monthly) * 100).toFixed(2)),
    regime: "trend-up",
    regimeScore: 0.69,
    source: "Demo seed",
    history,
  } satisfies GoldPriceSnapshot;
}

function makeNews(): AnalyzedNewsItem[] {
  const seed = [
    {
      title: "Fed officials signal patience as real yields soften into week-end",
      source: "Market Pulse",
      summary:
        "Treasury real yields eased and traders trimmed expectations for an additional hawkish surprise, helping bullion hold the upper part of the range.",
      publishedAt: "2026-04-25T06:40:00.000Z",
      direction: "bullish",
      score: 0.62,
      drivers: ["fed", "real_yields", "nominal_yields"],
      why: "По-ниските реални доходности директно намаляват алтернативната цена на държане на злато.",
    },
    {
      title: "Dollar eases after softer macro prints while gold buyers defend dip",
      source: "Macro Ledger",
      summary:
        "A softer broad dollar index and lower front-end yields encouraged renewed buying in gold after an early session pullback.",
      publishedAt: "2026-04-24T18:10:00.000Z",
      direction: "bullish",
      score: 0.56,
      drivers: ["usd", "real_yields", "technical"],
      why: "По-слабият долар подкрепя търсенето на злато от недоларови инвеститори.",
    },
    {
      title: "COMEX gold positioning cools but managed money stays decisively net long",
      source: "Positioning Weekly",
      summary:
        "Managed money trimmed part of the stretched long book, but the broader structure still points to constructive speculative support.",
      publishedAt: "2026-04-24T13:00:00.000Z",
      direction: "bullish",
      score: 0.41,
      drivers: ["positioning", "technical"],
      why: "Лекото охлаждане не отменя силното нетно дълго позициониране.",
    },
    {
      title: "Physical bullion demand from central banks remains firm in Q2",
      source: "Metals Briefing",
      summary:
        "Reserve managers continue to add bullion at a steady pace, offsetting some of the short-term volatility from macro data.",
      publishedAt: "2026-04-23T09:20:00.000Z",
      direction: "bullish",
      score: 0.48,
      drivers: ["physical_demand", "risk"],
      why: "Физическото и резервно търсене дава по-стабилна подложка под цената.",
    },
    {
      title: "Geopolitical nerves keep safe-haven flows active across metals",
      source: "Global Risk Wire",
      summary:
        "Fresh geopolitical headlines kept defensive flows alive, with gold remaining the preferred macro hedge across the complex.",
      publishedAt: "2026-04-22T20:15:00.000Z",
      direction: "bullish",
      score: 0.53,
      drivers: ["geopolitics", "risk"],
      why: "При повишен риск защитните потоци обичайно се насочват към злато.",
    },
    {
      title: "Treasury yields rebound modestly after stronger services data",
      source: "Rates Monitor",
      summary:
        "A late-session rebound in nominal yields capped the pace of gains in gold and left intraday momentum less one-sided.",
      publishedAt: "2026-04-22T16:30:00.000Z",
      direction: "bearish",
      score: -0.36,
      drivers: ["nominal_yields", "real_yields"],
      why: "По-високите доходности временно ограничават upside при златото.",
    },
    {
      title: "ETF inflows stabilise after two sessions of outflows",
      source: "Flow Tracker",
      summary:
        "Gold-backed ETF flows were neutral to slightly positive, suggesting demand is no longer deteriorating at the margin.",
      publishedAt: "2026-04-21T17:00:00.000Z",
      direction: "neutral",
      score: 0.08,
      drivers: ["physical_demand", "technical"],
      why: "Потоците спират да се влошават, но още не дават силен самостоятелен импулс.",
    },
    {
      title: "Inflation expectations edge higher without a matching real-yield spike",
      source: "Macro Scope",
      summary:
        "The market is pricing a slightly firmer inflation path while real yields stay contained, a combination that tends to suit bullion.",
      publishedAt: "2026-04-21T09:45:00.000Z",
      direction: "bullish",
      score: 0.44,
      drivers: ["inflation", "real_yields"],
      why: "Инфлационното очакване расте без силен ръст на реалните доходности, което е подкрепящо.",
    },
  ] as const;

  return seed.map((entry, index) => {
    const dedupeHash = hashText(`${entry.title}|${entry.publishedAt}`);

    return {
      item: {
        id: dedupeHash.slice(0, 16),
        source: entry.source,
        title: entry.title,
        url: `https://example.com/news/${index + 1}`,
        publishedAt: entry.publishedAt,
        rawSummary: entry.summary,
        dedupeHash,
        overallSentiment: entry.score,
        topics: [...entry.drivers],
      },
      analysis: {
        newsItemId: dedupeHash.slice(0, 16),
        summaryBg: entry.summary,
        impactDirection: entry.direction,
        timeHorizon: index < 3 ? "1-3 days" : "1-2 weeks",
        confidence: index < 2 ? 0.81 : 0.7,
        affectedDrivers: [...entry.drivers],
        whyItMatters: entry.why,
        explanation: entry.why,
        directionalScore: entry.score,
      },
    } satisfies AnalyzedNewsItem;
  });
}

function makeCotSeries(): CotSeries[] {
  const dates = Array.from({ length: 8 }, (_, index) =>
    subWeeks(new Date("2026-04-21T00:00:00Z"), index).toISOString().slice(0, 10),
  );

  const combinedNet = [95498, 98850, 92113, 87560, 84210, 78842, 77950, 74410];
  const futuresOnlyNet = [92976, 95141, 90032, 85311, 82014, 77086, 76002, 71892];
  const openInterestCombined = [556894, 565169, 550487, 592184, 618402, 648918, 709862, 699876];
  const openInterestFutures = [365842, 362274, 354877, 382115, 401884, 414552, 413956, 409789];

  const makeSnapshots = (
    reportType: "combined" | "futures_only",
    label: string,
    openInterest: number[],
    net: number[],
  ) => ({
    reportType,
    label,
    snapshots: dates.map((date, index) => ({
      id: `${reportType}-${date}`,
      reportDate: date,
      reportType,
      marketName: "GOLD - COMMODITY EXCHANGE INC.",
      openInterest: openInterest[index],
      managedMoneyLong: net[index] + 30410 + index * 210,
      managedMoneyShort: 30410 + index * 210,
      managedMoneyNet: net[index],
      swapDealerNet: -177547 - index * 1820,
      producerNet: -23696 - index * 1300,
      otherReportablesNet: 64699 - index * 950,
      weeklyDelta: index === dates.length - 1 ? 0 : net[index] - net[index + 1],
      sourceUrl: "https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm",
    })),
  });

  return [
    makeSnapshots("combined", "Futures + Options", openInterestCombined, combinedNet),
    makeSnapshots("futures_only", "Futures only", openInterestFutures, futuresOnlyNet),
  ];
}

function makeMacroSeries(): MacroSeries[] {
  const dailyDates = Array.from({ length: 8 }, (_, index) =>
    subDays(new Date("2026-04-25T00:00:00Z"), index).toISOString().slice(0, 10),
  );

  const monthlyDates = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 3 - index, 1));
    return date.toISOString().slice(0, 10);
  });

  const descriptors = [
    {
      seriesId: "DTWEXBGS",
      label: "Широк доларов индекс",
      unit: "индекс",
      influence: "По-слаб долар обикновено подпомага златото.",
      dates: dailyDates,
      values: [118.7, 119.0, 119.2, 119.4, 119.8, 120.1, 120.6, 121.0],
      interpretations: [
        "Доларът отслабва и освобождава място за ръст при златото.",
        "Доларът остава под локален натиск.",
      ],
      direction: 1,
    },
    {
      seriesId: "DFII10",
      label: "10г. реална доходност",
      unit: "%",
      influence: "Понижаващи се реални доходности са класически плюс за златото.",
      dates: dailyDates,
      values: [1.9, 1.93, 1.92, 1.95, 1.98, 2.01, 2.04, 2.08],
      interpretations: [
        "Реалните доходности слизат, което подпомага златото.",
        "Реалните доходности все още са по-ниски от пика от предишната седмица.",
      ],
      direction: 1,
    },
    {
      seriesId: "DGS10",
      label: "10г. номинална доходност",
      unit: "%",
      influence: "Ръстът в номиналните доходности често ограничава импулса.",
      dates: dailyDates,
      values: [4.26, 4.28, 4.31, 4.33, 4.29, 4.35, 4.38, 4.42],
      interpretations: [
        "Номиналните доходности се охлаждат след последния пик.",
        "Натискът от rates не е изчезнал напълно, но отслабва.",
      ],
      direction: 0.35,
    },
    {
      seriesId: "FEDFUNDS",
      label: "Fed funds",
      unit: "%",
      influence: "По-мек Fed режим подпомага търсенето на злато.",
      dates: monthlyDates,
      values: [4.25, 4.33, 4.42, 4.58, 4.73, 4.91, 5.08, 5.21],
      interpretations: [
        "Лихвената база остава висока, но трендът е към постепенно омекване.",
        "Fed фонът вече не се затяга в същата степен.",
      ],
      direction: 0.18,
    },
    {
      seriesId: "CPIAUCSL",
      label: "CPI инфлация",
      unit: "индекс",
      influence: "Ускоряваща се инфлация повишава интереса към защита от обезценка.",
      dates: monthlyDates,
      values: [324.8, 324.1, 323.4, 322.7, 321.8, 320.5, 319.7, 318.8],
      interpretations: [
        "Инфлацията остава достатъчно жива, за да поддържа защитния аргумент за злато.",
        "Инфлационният фон не е изчезнал и пази търсенето на hedge.",
      ],
      direction: 0.28,
    },
  ] as const;

  return descriptors.map((descriptor) => ({
    seriesId: descriptor.seriesId,
    label: descriptor.label,
    unit: descriptor.unit,
    influence: descriptor.influence,
    snapshots: descriptor.values.map((value, index) => {
      const previousValue = descriptor.values[index + 1] ?? null;
      const delta = previousValue === null ? 0 : Number((value - previousValue).toFixed(2));

      return {
        id: `${descriptor.seriesId}-${descriptor.dates[index]}`,
        seriesId: descriptor.seriesId,
        label: descriptor.label,
        date: descriptor.dates[index],
        value,
        previousValue,
        delta,
        zScore: Number((descriptor.direction * (2.2 - index * 0.2)).toFixed(2)),
        interpretation: descriptor.interpretations[index === 0 ? 0 : 1],
        directionalBias: Number((descriptor.direction * (1.1 - index * 0.05)).toFixed(3)),
        unit: descriptor.unit,
      };
    }),
  }));
}

function makeCalendarEvents(): EconomicCalendarEvent[] {
  return [
    {
      id: "calendar-us-consumer-confidence-2026-04-28",
      startsAt: "2026-04-28T14:00:00.000Z",
      country: "САЩ",
      currency: "USD",
      title: "CB Consumer Confidence",
      impact: "medium",
      eventType: "consumer_surveys",
      relevance: "strong",
      previous: "101.4",
      forecast: "100.8",
      source: "Demo economic calendar",
      sourceUrl: "https://tradingeconomics.com/calendar",
      affectedDrivers: ["usd", "risk", "fed"],
      expectedGoldImpact: "mixed",
      scenarioBullish:
        "По-слаб резултат може да натисне долара и доходностите надолу, което е подкрепящо за златото.",
      scenarioBearish:
        "По-силен резултат може да върне апетит към риск и да подкрепи долара, което ограничава златото.",
      explanationBg:
        "Потребителското доверие показва колко устойчива е икономиката. За златото ефектът минава през USD, очакванията за Fed и risk sentiment.",
    },
    {
      id: "calendar-us-gdp-advance-2026-04-30",
      startsAt: "2026-04-30T12:30:00.000Z",
      country: "САЩ",
      currency: "USD",
      title: "Advance GDP q/q",
      impact: "high",
      eventType: "growth",
      relevance: "strong",
      previous: "2.4%",
      forecast: "2.1%",
      source: "Demo economic calendar",
      sourceUrl: "https://tradingeconomics.com/calendar",
      affectedDrivers: ["usd", "nominal_yields", "risk"],
      expectedGoldImpact: "mixed",
      scenarioBullish:
        "По-слаб растеж може да намали доходностите и да засили защитното търсене към злато.",
      scenarioBearish:
        "По-силен растеж може да повиши доходностите и да подкрепи USD, което е натиск за златото.",
      explanationBg:
        "GDP задава тона за икономическия цикъл. Златото реагира най-силно, когато данните променят очакванията за лихвите и долара.",
    },
    {
      id: "calendar-us-core-pce-2026-05-01",
      startsAt: "2026-05-01T12:30:00.000Z",
      country: "САЩ",
      currency: "USD",
      title: "Core PCE Price Index m/m",
      impact: "high",
      eventType: "inflation",
      relevance: "direct",
      previous: "0.3%",
      forecast: "0.2%",
      source: "Demo economic calendar",
      sourceUrl: "https://tradingeconomics.com/calendar",
      affectedDrivers: ["inflation", "fed", "real_yields", "usd"],
      expectedGoldImpact: "bullish",
      scenarioBullish:
        "По-нисък PCE от прогнозата може да свали реалните доходности и да повиши шанса за по-мек Fed, което е плюс за златото.",
      scenarioBearish:
        "По-горещ PCE може да върне hawkish Fed сценарий, по-високи реални доходности и натиск върху златото.",
      explanationBg:
        "Core PCE е любимият инфлационен индикатор на Fed. Затова е директен драйвер за реални доходности, долар и злато.",
    },
    {
      id: "calendar-us-ism-services-2026-05-05",
      startsAt: "2026-05-05T14:00:00.000Z",
      country: "САЩ",
      currency: "USD",
      title: "ISM Services PMI",
      impact: "medium",
      eventType: "business_surveys",
      relevance: "strong",
      previous: "52.6",
      forecast: "52.1",
      source: "Demo economic calendar",
      sourceUrl: "https://tradingeconomics.com/calendar",
      affectedDrivers: ["usd", "nominal_yields", "risk"],
      expectedGoldImpact: "neutral",
      scenarioBullish:
        "Слаб PMI може да охлади доходностите и да подпомогне златото, ако пазарът го чете като забавяне.",
      scenarioBearish:
        "Силен PMI може да повиши доходностите и да намали защитния интерес към злато.",
      explanationBg:
        "Услугите са голям дял от американската икономика. Индексът влияе върху rates, USD и краткосрочния risk режим.",
    },
    {
      id: "calendar-fomc-rate-decision-2026-05-06",
      startsAt: "2026-05-06T18:00:00.000Z",
      country: "САЩ",
      currency: "USD",
      title: "FOMC Rate Decision",
      impact: "high",
      eventType: "central_bank",
      relevance: "direct",
      previous: "4.25%",
      forecast: "4.25%",
      source: "Demo economic calendar",
      sourceUrl: "https://tradingeconomics.com/calendar",
      affectedDrivers: ["fed", "real_yields", "nominal_yields", "usd"],
      expectedGoldImpact: "bullish",
      scenarioBullish:
        "По-мек тон от Fed може да свали реалните доходности и долара, което е силно подкрепящо за златото.",
      scenarioBearish:
        "По-твърд тон за инфлацията може да вдигне доходностите и да натисне златото надолу.",
      explanationBg:
        "Решенията и пресконференциите на Fed са сред най-силните директни събития за златото, защото движат реалните доходности и USD.",
    },
    {
      id: "calendar-nfp-2026-05-08",
      startsAt: "2026-05-08T12:30:00.000Z",
      country: "САЩ",
      currency: "USD",
      title: "Nonfarm Payrolls",
      impact: "high",
      eventType: "employment",
      relevance: "direct",
      previous: "216K",
      forecast: "190K",
      source: "Demo economic calendar",
      sourceUrl: "https://tradingeconomics.com/calendar",
      affectedDrivers: ["fed", "usd", "nominal_yields", "risk"],
      expectedGoldImpact: "mixed",
      scenarioBullish:
        "По-слаб NFP може да понижи доходностите и да подкрепи тезата за по-мек Fed, което помага на златото.",
      scenarioBearish:
        "По-силен NFP може да вдигне долара и доходностите, особено ако заплатите също са горещи.",
      explanationBg:
        "Трудовият пазар променя очакванията за Fed. Златото обикновено реагира през USD и доходностите в първите минути след данните.",
    },
    {
      id: "calendar-cot-gold-2026-05-08",
      startsAt: "2026-05-08T19:30:00.000Z",
      country: "САЩ",
      currency: "XAU",
      title: "CFTC COT Gold Positioning",
      impact: "medium",
      eventType: "misc",
      relevance: "direct",
      previous: "+95.5K net long",
      source: "Demo economic calendar",
      sourceUrl: "https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm",
      affectedDrivers: ["positioning", "technical"],
      expectedGoldImpact: "bullish",
      scenarioBullish:
        "Умерено увеличение на net long позицията подкрепя тренда, ако не изглежда прекалено crowded.",
      scenarioBearish:
        "Рязко намаляване на net long или прекалено разтегнато позициониране може да предупреди за корекция.",
      explanationBg:
        "COT не е intraday новина, но показва дали големите спекулативни пари добавят или намаляват експозиция към злато.",
    },
  ];
}

function makeSignalHistory(
  news: AnalyzedNewsItem[],
  cotSeries: CotSeries[],
  macroSeries: MacroSeries[],
  price: GoldPriceSnapshot,
) {
  const history: SignalRun[] = [];

  for (let index = 0; index < 8; index += 1) {
    const asOf = subWeeks(new Date(price.asOf), index).toISOString();
    const localPrice = {
      ...price,
      asOf,
      dailyChangePct: price.dailyChangePct - index * 0.18,
      weeklyChangePct: price.weeklyChangePct - index * 0.44,
      monthlyChangePct: price.monthlyChangePct - index * 0.63,
      regimeScore: Number((price.regimeScore - index * 0.045).toFixed(3)),
    };

    history.push(
      buildSignalRun({
        news: news.slice(index % 2, news.length - (index > 4 ? 1 : 0)),
        cotSeries: cotSeries.map((series) => ({
          ...series,
          snapshots: series.snapshots.slice(index, index + 6),
        })),
        macroSeries: macroSeries.map((series) => ({
          ...series,
          snapshots: series.snapshots.slice(index % 2),
        })),
        price: localPrice,
        asOf,
      }),
    );
  }

  return history;
}

export function buildDemoSnapshot(): DashboardSnapshot {
  const price = makePriceSnapshot();
  const news = makeNews();
  const cotSeries = makeCotSeries();
  const macroSeries = makeMacroSeries();
  const calendarEvents = makeCalendarEvents();
  const signalHistory = makeSignalHistory(news, cotSeries, macroSeries, price);

  return {
    generatedAt: price.asOf,
    price,
    news,
    calendarEvents,
    cotSeries,
    macroSeries,
    signal: signalHistory[0],
    signalHistory,
    syncRuns: [
      {
        id: "sync-demo-alpha",
        source: "alpha-vantage",
        status: "success",
        startedAt: "2026-04-25T07:02:00.000Z",
        finishedAt: "2026-04-25T07:02:09.000Z",
        detail: { mode: "seed" },
      },
      {
        id: "sync-demo-fred",
        source: "fred",
        status: "success",
        startedAt: "2026-04-25T07:02:10.000Z",
        finishedAt: "2026-04-25T07:02:14.000Z",
        detail: { mode: "seed" },
      },
      {
        id: "sync-demo-cftc",
        source: "cftc",
        status: "success",
        startedAt: "2026-04-25T07:02:15.000Z",
        finishedAt: "2026-04-25T07:02:18.000Z",
        detail: { mode: "seed" },
      },
    ],
    staleFlags: {
      alphaVantage: "fallback",
      gdelt: "fallback",
      fred: "fallback",
      cftc: "fresh",
      openai: "fallback",
    },
  };
}
