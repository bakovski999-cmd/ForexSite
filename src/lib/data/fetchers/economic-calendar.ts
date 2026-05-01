import { env } from "@/lib/env";
import { buildCalendarEventKey, getCalendarActualStatus } from "@/lib/calendar-history";
import { inferCalendarEventType } from "@/lib/calendar-filters";
import type {
  CalendarImpact,
  CalendarRelevance,
  DriverTag,
  EconomicCalendarEvent,
  SignalDirection,
} from "@/lib/types";
import { hashText } from "@/lib/utils";

type TradingEconomicsCalendarItem = {
  CalendarId?: string | number;
  Date?: string;
  Country?: string;
  Category?: string;
  Event?: string;
  Source?: string;
  SourceURL?: string;
  Actual?: string;
  Previous?: string;
  Forecast?: string;
  TEForecast?: string;
  URL?: string;
  Importance?: number;
  Currency?: string;
};

type ForexFactoryCalendarItem = {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
  actual?: string;
};

type FredReleaseDate = {
  release_id: number;
  release_name: string;
  date: string;
};

type FredReleaseDatesResponse = {
  release_dates?: FredReleaseDate[];
};

type FredObservation = {
  date: string;
  value: string;
};

type FredObservationsResponse = {
  observations?: FredObservation[];
};

type EurostatDatasetResponse = {
  value?: Record<string, number>;
  id?: string[];
  size?: number[];
  dimension?: {
    time?: {
      category?: {
        index?: Record<string, number>;
        label?: Record<string, string>;
      };
    };
  };
};

type EcbJsonDataResponse = {
  dataSets?: Array<{
    series?: Record<string, {
      observations?: Record<string, [number, ...unknown[]]>;
    }>;
  }>;
  structure?: {
    dimensions?: {
      observation?: Array<{
        id?: string;
        role?: string;
        values?: Array<{
          id?: string;
          name?: string;
        }>;
      }>;
    };
  };
};

type BlsSeriesDataPoint = {
  year: string;
  period: string;
  periodName: string;
  value: string;
  latest?: string;
};

type BlsSeries = {
  seriesID: string;
  data?: BlsSeriesDataPoint[];
};

type BlsResponse = {
  status?: string;
  Results?: Array<{
    series?: BlsSeries[];
  }>;
};

type BlsFact = {
  actual?: string;
  observationDate?: string;
  period?: string;
  previous?: string;
  sourceUrl: string;
};

type BlsFactKey = "cpi" | "coreCpi" | "ppi" | "unemployment" | "jolts";

type ReleaseRule = {
  pattern: RegExp;
  title: string;
  impact: CalendarImpact;
  relevance: CalendarRelevance;
  affectedDrivers: DriverTag[];
  expectedGoldImpact: SignalDirection;
  blsFactKey?: BlsFactKey;
  sourceUrl?: string;
  timeUtc: string;
};

type OfficialActualCadence = "daily" | "monthly" | "quarterly" | "weekly";

type OfficialActualMetric = "valuePercent" | "percentChange" | "thousandsK";

type BaseOfficialActualRule = {
  pattern: RegExp;
  cadence: OfficialActualCadence;
  decimals?: number;
  source: string;
  sourceUrl: string;
};

type FredOfficialActualRule = BaseOfficialActualRule & {
  provider: "fred";
  seriesId: string;
  metric: OfficialActualMetric;
};

type EurostatOfficialActualRule = BaseOfficialActualRule & {
  provider: "eurostat";
  dataset: string;
  params: Record<string, string>;
  metric: "valuePercent";
};

type EcbOfficialActualRule = BaseOfficialActualRule & {
  provider: "ecb";
  dataPath: string;
  metric: "valuePercent";
};

type OfficialActualRule =
  | FredOfficialActualRule
  | EurostatOfficialActualRule
  | EcbOfficialActualRule;

type OfficialActualFact = {
  actual: string;
  period: string;
  observationDate: string;
  source: string;
  sourceUrl: string;
};

const goldRelevantKeywords = [
  "average hourly earnings",
  "consumer confidence",
  "core cpi",
  "core pce",
  "cpi",
  "fed",
  "fomc",
  "gdp",
  "inflation",
  "initial jobless",
  "interest rate",
  "ism",
  "jobless claims",
  "jolts",
  "non farm",
  "nonfarm",
  "payroll",
  "pce",
  "pmi",
  "ppi",
  "retail sales",
  "treasury",
  "unemployment",
  "yield",
];

const fredCalendarRules: ReleaseRule[] = [
  {
    pattern: /consumer price index/i,
    title: "Consumer Price Index (CPI)",
    impact: "high",
    relevance: "direct",
    affectedDrivers: ["inflation", "fed", "real_yields", "usd"],
    expectedGoldImpact: "mixed",
    blsFactKey: "cpi",
    sourceUrl: "https://www.bls.gov/cpi/",
    timeUtc: "12:30",
  },
  {
    pattern: /producer price index/i,
    title: "Producer Price Index (PPI)",
    impact: "high",
    relevance: "direct",
    affectedDrivers: ["inflation", "fed", "real_yields", "usd"],
    expectedGoldImpact: "mixed",
    blsFactKey: "ppi",
    sourceUrl: "https://www.bls.gov/ppi/",
    timeUtc: "12:30",
  },
  {
    pattern: /employment situation/i,
    title: "Employment Situation / Unemployment Rate",
    impact: "high",
    relevance: "direct",
    affectedDrivers: ["fed", "usd", "nominal_yields", "risk"],
    expectedGoldImpact: "mixed",
    blsFactKey: "unemployment",
    sourceUrl: "https://www.bls.gov/news.release/empsit.htm",
    timeUtc: "12:30",
  },
  {
    pattern: /job openings and labor turnover/i,
    title: "JOLTS Job Openings",
    impact: "medium",
    relevance: "strong",
    affectedDrivers: ["fed", "usd", "nominal_yields", "risk"],
    expectedGoldImpact: "mixed",
    blsFactKey: "jolts",
    sourceUrl: "https://www.bls.gov/jlt/",
    timeUtc: "14:00",
  },
  {
    pattern: /gross domestic product/i,
    title: "Gross Domestic Product (GDP)",
    impact: "high",
    relevance: "strong",
    affectedDrivers: ["usd", "nominal_yields", "risk"],
    expectedGoldImpact: "mixed",
    sourceUrl: "https://fred.stlouisfed.org/release?rid=53",
    timeUtc: "12:30",
  },
  {
    pattern: /personal income and outlays/i,
    title: "PCE Inflation / Personal Income and Outlays",
    impact: "high",
    relevance: "direct",
    affectedDrivers: ["inflation", "fed", "real_yields", "usd"],
    expectedGoldImpact: "mixed",
    sourceUrl: "https://fred.stlouisfed.org/release?rid=54",
    timeUtc: "12:30",
  },
  {
    pattern: /advance monthly sales/i,
    title: "Retail Sales",
    impact: "medium",
    relevance: "strong",
    affectedDrivers: ["usd", "nominal_yields", "risk"],
    expectedGoldImpact: "mixed",
    sourceUrl: "https://fred.stlouisfed.org/release?rid=9",
    timeUtc: "12:30",
  },
  {
    pattern: /industrial production/i,
    title: "Industrial Production",
    impact: "medium",
    relevance: "context",
    affectedDrivers: ["usd", "risk"],
    expectedGoldImpact: "neutral",
    sourceUrl: "https://fred.stlouisfed.org/release?rid=13",
    timeUtc: "13:15",
  },
];

const officialActualRules: OfficialActualRule[] = [
  {
    provider: "fred",
    pattern: /^federal funds rate$/i,
    seriesId: "DFEDTARU",
    cadence: "daily",
    metric: "valuePercent",
    decimals: 2,
    source: "FRED / Federal Reserve target rate",
    sourceUrl: "https://fred.stlouisfed.org/series/DFEDTARU",
  },
  {
    provider: "fred",
    pattern: /^advance gdp q\/q$/i,
    seriesId: "A191RL1Q225SBEA",
    cadence: "quarterly",
    metric: "valuePercent",
    decimals: 1,
    source: "FRED / BEA official GDP",
    sourceUrl: "https://fred.stlouisfed.org/series/A191RL1Q225SBEA",
  },
  {
    provider: "fred",
    pattern: /gdp price index q\/q/i,
    seriesId: "A191RI1Q225SBEA",
    cadence: "quarterly",
    metric: "valuePercent",
    decimals: 1,
    source: "FRED / BEA official GDP price index",
    sourceUrl: "https://fred.stlouisfed.org/series/A191RI1Q225SBEA",
  },
  {
    provider: "fred",
    pattern: /^core pce price index m\/m$/i,
    seriesId: "PCEPILFE",
    cadence: "monthly",
    metric: "percentChange",
    decimals: 1,
    source: "FRED / BEA official Core PCE",
    sourceUrl: "https://fred.stlouisfed.org/series/PCEPILFE",
  },
  {
    provider: "fred",
    pattern: /^employment cost index q\/q$/i,
    seriesId: "ECIALLCIV",
    cadence: "quarterly",
    metric: "percentChange",
    decimals: 1,
    source: "FRED / BLS official Employment Cost Index",
    sourceUrl: "https://fred.stlouisfed.org/series/ECIALLCIV",
  },
  {
    provider: "fred",
    pattern: /^(unemployment claims|initial jobless claims|jobless claims)$/i,
    seriesId: "ICSA",
    cadence: "weekly",
    metric: "thousandsK",
    source: "FRED / DOL official initial claims",
    sourceUrl: "https://fred.stlouisfed.org/series/ICSA",
  },
  {
    provider: "eurostat",
    pattern: /^german prelim gdp q\/q$/i,
    dataset: "namq_10_gdp",
    params: {
      freq: "Q",
      unit: "CLV_PCH_PRE",
      s_adj: "SCA",
      na_item: "B1GQ",
      geo: "DE",
    },
    cadence: "quarterly",
    metric: "valuePercent",
    decimals: 1,
    source: "Eurostat / German GDP",
    sourceUrl: "https://ec.europa.eu/eurostat/databrowser/view/namq_10_gdp/default/table",
  },
  {
    provider: "eurostat",
    pattern: /^core cpi flash estimate y\/y$/i,
    dataset: "ei_cphi_m",
    params: {
      freq: "M",
      unit: "RT12",
      indic: "CP-HI00XEF",
      geo: "EA20",
    },
    cadence: "monthly",
    metric: "valuePercent",
    decimals: 1,
    source: "Eurostat / HICP flash core inflation",
    sourceUrl: "https://ec.europa.eu/eurostat/databrowser/view/ei_cphi_m/default/table",
  },
  {
    provider: "eurostat",
    pattern: /^cpi flash estimate y\/y$/i,
    dataset: "ei_cphi_m",
    params: {
      freq: "M",
      unit: "RT12",
      indic: "TOTAL",
      geo: "EA20",
    },
    cadence: "monthly",
    metric: "valuePercent",
    decimals: 1,
    source: "Eurostat / HICP flash inflation",
    sourceUrl: "https://ec.europa.eu/eurostat/databrowser/view/ei_cphi_m/default/table",
  },
  {
    provider: "ecb",
    pattern: /^main refinancing rate$/i,
    dataPath: "FM/D.U2.EUR.4F.KR.MRR_FR.LEV",
    cadence: "daily",
    metric: "valuePercent",
    decimals: 2,
    source: "ECB Data Portal / Main refinancing rate",
    sourceUrl: "https://data.ecb.europa.eu/data/datasets/FM/FM.D.U2.EUR.4F.KR.MRR_FR.LEV",
  },
];

const blsSeriesCatalog: Record<BlsFactKey, { seriesId: string; sourceUrl: string }> = {
  cpi: { seriesId: "CUUR0000SA0", sourceUrl: "https://www.bls.gov/cpi/" },
  coreCpi: { seriesId: "CUUR0000SA0L1E", sourceUrl: "https://www.bls.gov/cpi/" },
  ppi: { seriesId: "WPUFD4", sourceUrl: "https://www.bls.gov/ppi/" },
  unemployment: { seriesId: "LNS14000000", sourceUrl: "https://www.bls.gov/news.release/empsit.htm" },
  jolts: { seriesId: "JTSJOL", sourceUrl: "https://www.bls.gov/jlt/" },
};

const bgMonthNames = [
  "януари",
  "февруари",
  "март",
  "април",
  "май",
  "юни",
  "юли",
  "август",
  "септември",
  "октомври",
  "ноември",
  "декември",
];

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateTimeUtc(date: string, time: string) {
  return `${date}T${time}:00.000Z`;
}

function formatBlsPeriod(point: BlsSeriesDataPoint) {
  const month = Number(point.period.replace("M", ""));

  if (Number.isInteger(month) && month >= 1 && month <= 12) {
    return `${bgMonthNames[month - 1]} ${point.year}`;
  }

  return point.periodName ? `${point.periodName} ${point.year}` : point.year;
}

function formatOfficialPeriod(date: string, cadence: OfficialActualCadence) {
  const [year, month, day] = date.split("-").map(Number);

  if (cadence === "daily") {
    const labelDate = new Date(Date.UTC(year, month - 1, day));
    const dayLabel = String(labelDate.getUTCDate()).padStart(2, "0");
    const monthLabel = String(labelDate.getUTCMonth() + 1).padStart(2, "0");

    return `${dayLabel}.${monthLabel}.${labelDate.getUTCFullYear()}`;
  }

  if (cadence === "weekly") {
    const labelDate = new Date(Date.UTC(year, month - 1, day));
    const dayLabel = String(labelDate.getUTCDate()).padStart(2, "0");
    const monthLabel = String(labelDate.getUTCMonth() + 1).padStart(2, "0");

    return `седмица до ${dayLabel}.${monthLabel}.${labelDate.getUTCFullYear()}`;
  }

  if (cadence === "quarterly") {
    const quarter = Math.floor((month - 1) / 3) + 1;

    return `Q${quarter} ${year}`;
  }

  return `${bgMonthNames[month - 1] ?? month} ${year}`;
}

function formatEurostatPeriod(time: string, cadence: OfficialActualCadence) {
  const quarterMatch = time.match(/^(\d{4})-Q([1-4])$/);

  if (quarterMatch) {
    return `Q${quarterMatch[2]} ${quarterMatch[1]}`;
  }

  const monthMatch = time.match(/^(\d{4})-(\d{2})$/);

  if (monthMatch && cadence === "monthly") {
    const month = Number(monthMatch[2]);
    return `${bgMonthNames[month - 1] ?? month} ${monthMatch[1]}`;
  }

  return formatOfficialPeriod(time, cadence);
}

function eurostatTimeToObservationDate(time: string) {
  const quarterMatch = time.match(/^(\d{4})-Q([1-4])$/);

  if (quarterMatch) {
    const year = Number(quarterMatch[1]);
    const quarter = Number(quarterMatch[2]);
    const month = quarter * 3;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }

  if (/^\d{4}-\d{2}$/.test(time)) {
    return `${time}-01`;
  }

  return time;
}

function formatPercent(value: number, decimals = 1) {
  return `${value.toFixed(decimals)}%`;
}

function normalizeImpact(value: number | undefined): CalendarImpact {
  if (value === 3) {
    return "high";
  }

  if (value === 2) {
    return "medium";
  }

  return "low";
}

function normalizeForexFactoryImpact(value: string | undefined): CalendarImpact | null {
  const normalized = value?.toLowerCase();

  if (normalized === "high") {
    return "high";
  }

  if (normalized === "medium") {
    return "medium";
  }

  if (normalized === "low") {
    return "low";
  }

  return null;
}

function isGoldRelevant(item: TradingEconomicsCalendarItem) {
  const text = `${item.Category ?? ""} ${item.Event ?? ""}`.toLowerCase();
  return goldRelevantKeywords.some((keyword) => text.includes(keyword));
}

function isForexFactoryEconomicEvent(item: ForexFactoryCalendarItem) {
  return Boolean(normalizeForexFactoryImpact(item.impact) && item.title && item.date);
}

function inferDrivers(item: TradingEconomicsCalendarItem): DriverTag[] {
  const text = `${item.Category ?? ""} ${item.Event ?? ""}`.toLowerCase();
  const drivers = new Set<DriverTag>();

  if (/(cpi|pce|ppi|inflation|earnings|prices|employment cost|labor cost|labour cost|wage|compensation)/.test(text)) {
    drivers.add("inflation");
    drivers.add("fed");
    drivers.add("real_yields");
    drivers.add("usd");
  }

  if (/(fed|fomc|ecb|central bank|monetary policy|interest rate|rate decision|refinancing rate)/.test(text)) {
    drivers.add("fed");
    drivers.add("real_yields");
    drivers.add("nominal_yields");
    drivers.add("usd");
  }

  if (/(payroll|non farm|nonfarm|unemployment|jobless|jolts|employment)/.test(text)) {
    drivers.add("fed");
    drivers.add("usd");
    drivers.add("nominal_yields");
    drivers.add("risk");
  }

  if (/(gdp|pmi|ism|retail|confidence|sentiment|orders)/.test(text)) {
    drivers.add("usd");
    drivers.add("nominal_yields");
    drivers.add("risk");
  }

  if (/(treasury|yield|auction|bond)/.test(text)) {
    drivers.add("nominal_yields");
    drivers.add("real_yields");
    drivers.add("usd");
  }

  if (!drivers.size) {
    drivers.add("usd");
    drivers.add("risk");
  }

  return [...drivers];
}

function inferRelevance(drivers: DriverTag[], impact: CalendarImpact): CalendarRelevance {
  if (
    drivers.includes("fed") ||
    drivers.includes("inflation") ||
    drivers.includes("real_yields")
  ) {
    return "direct";
  }

  if (impact !== "low") {
    return "strong";
  }

  return "context";
}

function numeric(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/[$,%KMkBb\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function inferDirection(item: TradingEconomicsCalendarItem): SignalDirection {
  const actual = numeric(item.Actual);
  const forecast = numeric(item.Forecast || item.TEForecast);
  const text = `${item.Category ?? ""} ${item.Event ?? ""}`.toLowerCase();

  if (actual === null || forecast === null) {
    return normalizeImpact(item.Importance) === "high" ? "mixed" : "neutral";
  }

  if (actual === forecast) {
    return "neutral";
  }

  const hotterOrStronger = actual > forecast;

  if (/(unemployment|jobless claims)/.test(text)) {
    return hotterOrStronger ? "bullish" : "bearish";
  }

  if (/(cpi|pce|ppi|inflation|earnings|prices|employment cost|labor cost|labour cost|wage|compensation|payroll|non farm|nonfarm|gdp|pmi|ism|retail|confidence|jolts)/.test(text)) {
    return hotterOrStronger ? "bearish" : "bullish";
  }

  if (/(treasury|yield|auction|interest rate|fed|fomc|ecb|refinancing rate)/.test(text)) {
    return hotterOrStronger ? "bearish" : "bullish";
  }

  return "mixed";
}

function explanationFor(item: TradingEconomicsCalendarItem, drivers: DriverTag[]) {
  const text = `${item.Category ?? ""} ${item.Event ?? ""}`.toLowerCase();

  if (drivers.includes("inflation")) {
    return "Инфлационните данни променят очакванията за Fed. За златото ключът е дали пазарът ще види по-ниски или по-високи реални доходности след публикуването.";
  }

  if (/(payroll|non farm|nonfarm|unemployment|jobless|jolts|employment)/.test(text)) {
    return "Трудовият пазар влияе върху долара и доходностите, защото променя очакванията дали Fed може да омекне или трябва да остане твърд.";
  }

  if (/(fed|fomc|ecb|central bank|monetary policy|interest rate|rate decision|refinancing rate)/.test(text)) {
    return "Събитията на централните банки са директен драйвер за златото, защото движат реалните доходности, валутите и очакванията за бъдещата цена на парите.";
  }

  if (/(gdp|pmi|ism|retail|confidence|sentiment)/.test(text)) {
    return "Данните за растеж и активност дават сигнал колко силна е икономиката. Златото реагира през USD, доходностите и търсенето на защита.";
  }

  return "Събитието е включено, защото може да промени макро фона около долара, доходностите или risk sentiment, които са основни драйвери за златото.";
}

function scenarioFor(item: TradingEconomicsCalendarItem) {
  const text = `${item.Category ?? ""} ${item.Event ?? ""}`.toLowerCase();

  if (/(unemployment|jobless claims)/.test(text)) {
    return {
      bullish:
        "По-слаб трудов пазар от прогнозата може да свали доходностите и да подкрепи златото.",
      bearish:
        "По-силен трудов пазар от прогнозата може да вдигне USD и доходностите, което натиска златото.",
    };
  }

  if (/(cpi|pce|ppi|inflation|earnings|prices|employment cost|labor cost|labour cost|wage|compensation)/.test(text)) {
    return {
      bullish:
        "По-мек инфлационен резултат може да намали real-yield натиска и да подкрепи златото.",
      bearish:
        "По-горещ инфлационен резултат може да върне hawkish Fed сценарий и да натисне златото.",
    };
  }

  if (/(fed|fomc|ecb|central bank|monetary policy|interest rate|rate decision|refinancing rate)/.test(text)) {
    return {
      bullish:
        "По-мек тон от Fed може да отслаби долара и реалните доходности, което е позитивно за злато.",
      bearish:
        "По-твърд тон от Fed може да вдигне доходностите и да ограничи купувачите в злато.",
    };
  }

  return {
    bullish:
      "По-слаб резултат от прогнозата може да охлади USD и доходностите, което обикновено помага на златото.",
    bearish:
      "По-силен резултат от прогнозата може да подкрепи USD и доходностите, което често ограничава златото.",
  };
}

function officialScenarioFor(rule: ReleaseRule) {
  const fakeItem = {
    Category: rule.title,
    Event: rule.title,
  } satisfies TradingEconomicsCalendarItem;

  return scenarioFor(fakeItem);
}

function officialExplanationFor(rule: ReleaseRule) {
  const fakeItem = {
    Category: rule.title,
    Event: rule.title,
  } satisfies TradingEconomicsCalendarItem;

  return explanationFor(fakeItem, rule.affectedDrivers);
}

function sourceUrlFor(item: TradingEconomicsCalendarItem) {
  if (item.SourceURL) {
    return item.SourceURL;
  }

  if (item.URL) {
    return new URL(item.URL, "https://tradingeconomics.com").toString();
  }

  return "https://tradingeconomics.com/calendar";
}

function normalizeCalendarItem(item: TradingEconomicsCalendarItem): EconomicCalendarEvent {
  const impact = normalizeImpact(item.Importance);
  const drivers = inferDrivers(item);
  const scenarios = scenarioFor(item);
  const title = item.Event || item.Category || "Economic calendar event";
  const id = String(item.CalendarId ?? hashText(`${title}|${item.Date ?? ""}`)).slice(0, 32);
  const startsAt = item.Date ? new Date(item.Date).toISOString() : new Date().toISOString();
  const event = {
    country: item.Country === "United States" ? "САЩ" : item.Country || "Глобално",
    currency: item.Currency || (item.Country === "United States" ? "USD" : ""),
    startsAt,
    title,
  };
  const calendarKey = buildCalendarEventKey(event);

  return {
    id: `te-${id}`,
    calendarKey,
    startsAt,
    country: event.country,
    currency: event.currency,
    title,
    impact,
    eventType: inferCalendarEventType(title),
    relevance: inferRelevance(drivers, impact),
    previous: item.Previous || undefined,
    forecast: item.Forecast || item.TEForecast || undefined,
    forecastStatus: item.Forecast || item.TEForecast ? "provided" : "not_applicable",
    actual: item.Actual || undefined,
    actualSource: item.Actual ? item.Source || "Trading Economics" : undefined,
    actualUpdatedAt: item.Actual ? new Date().toISOString() : undefined,
    actualStatus: getCalendarActualStatus({ actual: item.Actual || undefined, startsAt }),
    source: item.Source || "Trading Economics",
    sourceUrl: sourceUrlFor(item),
    affectedDrivers: drivers,
    expectedGoldImpact: inferDirection(item),
    scenarioBullish: scenarios.bullish,
    scenarioBearish: scenarios.bearish,
    explanationBg: explanationFor(item, drivers),
  };
}

function normalizeForexFactoryItem(item: ForexFactoryCalendarItem): EconomicCalendarEvent | null {
  const impact = normalizeForexFactoryImpact(item.impact);

  if (!impact || !item.title || !item.date) {
    return null;
  }

  const normalizedItem = {
    Category: item.title,
    Event: item.title,
    Actual: item.actual,
    Previous: item.previous,
    Forecast: item.forecast,
    Importance: impact === "high" ? 3 : impact === "medium" ? 2 : 1,
    Country: item.country === "USD" ? "United States" : item.country,
    Currency: item.country,
  } satisfies TradingEconomicsCalendarItem;
  const drivers = inferDrivers(normalizedItem);
  const scenarios = scenarioFor(normalizedItem);
  const startsAt = new Date(item.date);

  if (!Number.isFinite(startsAt.getTime())) {
    return null;
  }
  const startsAtIso = startsAt.toISOString();
  const country = item.country === "USD" ? "САЩ" : item.country ?? "Глобално";
  const currency = item.country ?? "";
  const calendarKey = buildCalendarEventKey({
    country,
    currency,
    startsAt: startsAtIso,
    title: item.title,
  });

  return {
    id: `ff-${hashText(calendarKey).slice(0, 32)}`,
    calendarKey,
    startsAt: startsAtIso,
    country,
    currency,
    title: item.title,
    impact,
    eventType: inferCalendarEventType(item.title),
    relevance: inferRelevance(drivers, impact),
    previous: item.previous || undefined,
    forecast: item.forecast || undefined,
    forecastStatus: item.forecast ? "provided" : "not_applicable",
    actual: item.actual || undefined,
    actualSource: item.actual ? "ForexFactory weekly export" : undefined,
    actualUpdatedAt: item.actual ? new Date().toISOString() : undefined,
    actualStatus: getCalendarActualStatus({ actual: item.actual || undefined, startsAt: startsAtIso }),
    latestActual: item.previous || undefined,
    source: "ForexFactory weekly export",
    sourceUrl: "https://www.forexfactory.com/calendar",
    affectedDrivers: drivers,
    expectedGoldImpact: inferDirection(normalizedItem),
    scenarioBullish: scenarios.bullish,
    scenarioBearish: scenarios.bearish,
    explanationBg: explanationFor(normalizedItem, drivers),
  };
}

function getOfficialActualFactForEvent(
  event: EconomicCalendarEvent,
  facts: Map<string, OfficialActualFact[]>,
) {
  const rule = findOfficialActualRule(event.title);

  if (!rule) {
    return null;
  }

  const ruleFacts = facts.get(rule.pattern.source) ?? [];
  const fact = ruleFacts.find((candidate) => isOfficialFactFreshForEvent(rule, candidate, event.startsAt));

  if (!fact) {
    return null;
  }

  return fact;
}

function isReleaseOnlyFedEvent(event: Pick<EconomicCalendarEvent, "title" | "eventType">) {
  return (
    event.eventType === "central_bank" &&
    /(fomc statement|fomc press conference|monetary policy statement|ecb press conference)/i.test(event.title)
  );
}

function releaseOnlySourceFor(event: EconomicCalendarEvent) {
  if (event.currency === "EUR" || /ecb|monetary policy/i.test(event.title)) {
    return {
      source: "European Central Bank",
      sourceUrl: "https://www.ecb.europa.eu/press/pr/date/html/index.en.html",
    };
  }

  return {
    source: event.source || "Federal Reserve",
    sourceUrl: event.sourceUrl ?? "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  };
}

function enrichEventWithOfficialActual(
  event: EconomicCalendarEvent,
  facts: Map<string, OfficialActualFact[]>,
  now = new Date(),
): EconomicCalendarEvent {
  if (event.actual) {
    return {
      ...event,
      actualStatus: "published",
    };
  }

  const fact = getOfficialActualFactForEvent(event, facts);
  const startsAtMs = new Date(event.startsAt).getTime();
  const isReleased = Number.isFinite(startsAtMs) && startsAtMs <= now.getTime();

  if (!fact && isReleased && isReleaseOnlyFedEvent(event)) {
    const releaseSource = releaseOnlySourceFor(event);

    return {
      ...event,
      actual: "Публикувано",
      actualSource: releaseSource.source,
      actualUpdatedAt: now.toISOString(),
      actualStatus: "published",
      source: event.source || releaseSource.source,
      sourceUrl: event.sourceUrl ?? releaseSource.sourceUrl,
      expectedGoldImpact: "mixed",
    };
  }

  if (!fact || !isReleased) {
    return {
      ...event,
      actualStatus: getCalendarActualStatus(event, now),
    };
  }

  const normalizedItem = {
    Category: event.title,
    Event: event.title,
    Actual: fact.actual,
    Previous: event.previous,
    Forecast: event.forecast,
    Importance: event.impact === "high" ? 3 : event.impact === "medium" ? 2 : 1,
    Country: event.country === "САЩ" ? "United States" : event.country,
    Currency: event.currency,
  } satisfies TradingEconomicsCalendarItem;

  return {
    ...event,
    actual: fact.actual,
    actualSource: fact.source,
    actualUpdatedAt: now.toISOString(),
    actualStatus: "published",
    latestActual: event.latestActual ?? event.previous,
    latestActualPeriod: event.latestActualPeriod,
    source: event.source,
    sourceUrl: event.sourceUrl ?? fact.sourceUrl,
    expectedGoldImpact: inferDirection(normalizedItem),
  };
}

export function enrichCalendarEventsWithOfficialActuals(
  events: EconomicCalendarEvent[],
  facts: Map<string, OfficialActualFact[]>,
  now = new Date(),
) {
  return events.map((event) => enrichEventWithOfficialActual(event, facts, now));
}

export function mapForexFactoryCalendarItemsToEvents(items: ForexFactoryCalendarItem[]) {
  return items
    .filter(isForexFactoryEconomicEvent)
    .map(normalizeForexFactoryItem)
    .filter((event): event is EconomicCalendarEvent => Boolean(event));
}

async function fetchForexFactoryWeeklyCalendarEvents() {
  const response = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`ForexFactory weekly calendar request failed: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;

  if (!Array.isArray(payload)) {
    throw new Error("ForexFactory weekly calendar response is not an array");
  }

  return mapForexFactoryCalendarItemsToEvents(
    payload.filter((item): item is ForexFactoryCalendarItem => Boolean(item && typeof item === "object")),
  );
}

export async function fetchTradingEconomicsCalendarEvents(): Promise<EconomicCalendarEvent[]> {
  if (!env.TRADING_ECONOMICS_API_KEY) {
    return [];
  }

  const now = new Date();
  const start = dateOnly(addDays(now, -1));
  const end = dateOnly(addDays(now, 14));
  const url = new URL(
    `https://api.tradingeconomics.com/calendar/country/united%20states/${start}/${end}`,
  );
  url.searchParams.set("c", env.TRADING_ECONOMICS_API_KEY);
  url.searchParams.set("f", "json");

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Trading Economics calendar request failed: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;

  if (!Array.isArray(payload)) {
    throw new Error("Trading Economics calendar response is not an array");
  }

  return payload
    .filter((item): item is TradingEconomicsCalendarItem => Boolean(item && typeof item === "object"))
    .filter((item) => normalizeImpact(item.Importance) !== "low" || isGoldRelevant(item))
    .filter(isGoldRelevant)
    .map(normalizeCalendarItem)
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
    .slice(0, 24);
}

function findReleaseRule(name: string) {
  return fredCalendarRules.find((rule) => rule.pattern.test(name));
}

function formatBlsValue(key: BlsFactKey, value: string) {
  const numericValue = Number(value);

  if (key === "unemployment" && Number.isFinite(numericValue)) {
    return `${numericValue.toFixed(1)}%`;
  }

  if (key === "jolts" && Number.isFinite(numericValue)) {
    return `${(numericValue / 1000).toFixed(1)}M`;
  }

  if (Number.isFinite(numericValue)) {
    return `индекс ${numericValue.toFixed(2)}`;
  }

  return value;
}

async function fetchBlsLatestFacts(): Promise<Map<BlsFactKey, BlsFact>> {
  const now = new Date();
  const keys = Object.keys(blsSeriesCatalog) as BlsFactKey[];
  const response = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      seriesid: keys.map((key) => blsSeriesCatalog[key].seriesId),
      startyear: String(now.getUTCFullYear() - 1),
      endyear: String(now.getUTCFullYear()),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`BLS latest data request failed: ${response.status}`);
  }

  const payload = (await response.json()) as BlsResponse;
  const series = payload.Results?.[0]?.series ?? [];
  const facts = new Map<BlsFactKey, BlsFact>();

  for (const key of keys) {
    const descriptor = blsSeriesCatalog[key];
    const match = series.find((entry) => entry.seriesID === descriptor.seriesId);
    const data = match?.data?.filter((entry) => /^M\d{2}$/.test(entry.period)) ?? [];
    const latest = data[0];
    const previous = data[1];

    if (!latest) {
      continue;
    }

    facts.set(key, {
      actual: formatBlsValue(key, latest.value),
      observationDate: `${latest.year}-${latest.period.replace("M", "").padStart(2, "0")}-01`,
      period: formatBlsPeriod(latest),
      previous: previous ? formatBlsValue(key, previous.value) : undefined,
      sourceUrl: descriptor.sourceUrl,
    });
  }

  return facts;
}

function findOfficialActualRule(title: string) {
  return officialActualRules.find((rule) => rule.pattern.test(title.trim()));
}

function parseFredNumber(value: string | undefined) {
  if (!value || value === ".") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatOfficialActual(rule: OfficialActualRule, latest: FredObservation, previous?: FredObservation) {
  const latestValue = parseFredNumber(latest.value);

  if (latestValue === null) {
    return null;
  }

  if (rule.metric === "valuePercent") {
    return formatPercent(latestValue, rule.decimals ?? 1);
  }

  if (rule.metric === "thousandsK") {
    return `${Math.round(latestValue / 1000)}K`;
  }

  const previousValue = parseFredNumber(previous?.value);

  if (previousValue === null || previousValue === 0) {
    return null;
  }

  return formatPercent((latestValue / previousValue - 1) * 100, rule.decimals ?? 1);
}

function flatIndexToCoordinates(index: number, sizes: number[]) {
  return sizes.map((size, dimensionIndex) => {
    const stride = sizes.slice(dimensionIndex + 1).reduce((product, current) => product * current, 1);
    return Math.floor(index / stride) % size;
  });
}

export function mapEurostatDatasetToOfficialFacts(
  rule: EurostatOfficialActualRule,
  payload: EurostatDatasetResponse,
): OfficialActualFact[] {
  const ids = payload.id ?? [];
  const sizes = payload.size ?? [];
  const timeDimensionIndex = ids.indexOf("time");
  const timeIndex = payload.dimension?.time?.category?.index ?? {};

  if (timeDimensionIndex === -1 || !sizes.length || !payload.value) {
    return [];
  }

  const timeByPosition = new Map<number, string>(
    Object.entries(timeIndex).map(([time, index]) => [index, time]),
  );

  return Object.entries(payload.value)
    .map(([flatIndex, value]) => {
      const index = Number(flatIndex);
      if (!Number.isFinite(index) || !Number.isFinite(value)) {
        return null;
      }

      const coordinates = flatIndexToCoordinates(index, sizes);
      const time = timeByPosition.get(coordinates[timeDimensionIndex]);

      if (!time) {
        return null;
      }

      return {
        actual: formatPercent(value, rule.decimals ?? 1),
        period: formatEurostatPeriod(time, rule.cadence),
        observationDate: eurostatTimeToObservationDate(time),
        source: rule.source,
        sourceUrl: rule.sourceUrl,
      } satisfies OfficialActualFact;
    })
    .filter((fact): fact is OfficialActualFact => Boolean(fact))
    .sort((left, right) => right.observationDate.localeCompare(left.observationDate));
}

export function mapEcbJsonDataToOfficialFacts(
  rule: EcbOfficialActualRule,
  payload: EcbJsonDataResponse,
): OfficialActualFact[] {
  const timeDimension = payload.structure?.dimensions?.observation?.find(
    (dimension) => dimension.id === "TIME_PERIOD" || dimension.role === "time",
  );
  const observations = Object.values(payload.dataSets?.[0]?.series ?? {})
    .flatMap((series) => Object.entries(series.observations ?? {}));

  if (!timeDimension?.values?.length || !observations.length) {
    return [];
  }

  return observations
    .map(([timeIndex, observation]) => {
      const time = timeDimension.values?.[Number(timeIndex)]?.id;
      const value = observation[0];

      if (!time || !Number.isFinite(value)) {
        return null;
      }

      return {
        actual: formatPercent(value, rule.decimals ?? 2),
        period: formatOfficialPeriod(time, rule.cadence),
        observationDate: time,
        source: rule.source,
        sourceUrl: rule.sourceUrl,
      } satisfies OfficialActualFact;
    })
    .filter((fact): fact is OfficialActualFact => Boolean(fact))
    .sort((left, right) => right.observationDate.localeCompare(left.observationDate));
}

function isOfficialFactFreshForEvent(
  rule: OfficialActualRule,
  fact: OfficialActualFact,
  startsAt: string,
) {
  const eventTime = new Date(startsAt).getTime();
  const observationTime = new Date(`${fact.observationDate}T00:00:00.000Z`).getTime();

  if (!Number.isFinite(eventTime) || !Number.isFinite(observationTime) || observationTime > eventTime) {
    return false;
  }

  const maxAgeDays = {
    daily: 3,
    monthly: 70,
    quarterly: 140,
    weekly: 14,
  } satisfies Record<OfficialActualCadence, number>;

  return eventTime - observationTime <= maxAgeDays[rule.cadence] * 24 * 60 * 60 * 1000;
}

async function fetchFredObservations(seriesId: string): Promise<FredObservation[]> {
  if (!env.FRED_API_KEY) {
    return [];
  }

  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", env.FRED_API_KEY);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "8");

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`FRED observations request failed for ${seriesId}: ${response.status}`);
  }

  const payload = (await response.json()) as FredObservationsResponse;
  return (payload.observations ?? []).filter((observation) => parseFredNumber(observation.value) !== null);
}

async function fetchEurostatOfficialFacts(rule: EurostatOfficialActualRule) {
  const url = new URL(
    `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${rule.dataset}`,
  );
  url.searchParams.set("format", "JSON");
  url.searchParams.set("lang", "en");
  url.searchParams.set("lastTimePeriod", "8");

  for (const [key, value] of Object.entries(rule.params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Eurostat request failed for ${rule.dataset}: ${response.status}`);
  }

  return mapEurostatDatasetToOfficialFacts(rule, await response.json() as EurostatDatasetResponse);
}

async function fetchEcbOfficialFacts(rule: EcbOfficialActualRule) {
  const url = new URL(`https://data-api.ecb.europa.eu/service/data/${rule.dataPath}`);
  url.searchParams.set("lastNObservations", "8");
  url.searchParams.set("format", "jsondata");

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`ECB Data Portal request failed for ${rule.dataPath}: ${response.status}`);
  }

  return mapEcbJsonDataToOfficialFacts(rule, await response.json() as EcbJsonDataResponse);
}

function setOfficialFacts(
  facts: Map<string, OfficialActualFact[]>,
  rule: OfficialActualRule,
  ruleFacts: OfficialActualFact[],
) {
  if (ruleFacts.length) {
    facts.set(rule.pattern.source, ruleFacts);
  }
}

async function fetchOfficialActualFacts() {
  const facts = new Map<string, OfficialActualFact[]>();
  const fredRules = officialActualRules.filter(
    (rule): rule is FredOfficialActualRule => rule.provider === "fred",
  );
  const eurostatRules = officialActualRules.filter(
    (rule): rule is EurostatOfficialActualRule => rule.provider === "eurostat",
  );
  const ecbRules = officialActualRules.filter(
    (rule): rule is EcbOfficialActualRule => rule.provider === "ecb",
  );

  if (env.FRED_API_KEY) {
    const uniqueSeriesIds = [...new Set(fredRules.map((rule) => rule.seriesId))];
    const results = await Promise.allSettled(
      uniqueSeriesIds.map(async (seriesId) => [seriesId, await fetchFredObservations(seriesId)] as const),
    );
    const observationsBySeriesId = new Map<string, FredObservation[]>();

    for (const result of results) {
      if (result.status === "fulfilled") {
        observationsBySeriesId.set(result.value[0], result.value[1]);
      }
    }

    for (const rule of fredRules) {
      const observations = observationsBySeriesId.get(rule.seriesId) ?? [];
      const ruleFacts: OfficialActualFact[] = [];

      observations.forEach((observation, index) => {
        const actual = formatOfficialActual(rule, observation, observations[index + 1]);

        if (!actual) {
          return;
        }

        ruleFacts.push({
          actual,
          period: formatOfficialPeriod(observation.date, rule.cadence),
          observationDate: observation.date,
          source: rule.source,
          sourceUrl: rule.sourceUrl,
        });
      });

      setOfficialFacts(facts, rule, ruleFacts);
    }
  }

  const eurostatResults = await Promise.allSettled(
    eurostatRules.map(async (rule) => [rule, await fetchEurostatOfficialFacts(rule)] as const),
  );
  const ecbResults = await Promise.allSettled(
    ecbRules.map(async (rule) => [rule, await fetchEcbOfficialFacts(rule)] as const),
  );

  for (const result of [...eurostatResults, ...ecbResults]) {
    if (result.status === "fulfilled") {
      setOfficialFacts(facts, result.value[0], result.value[1]);
    }
  }

  return facts;
}

async function fetchFredReleaseDates(): Promise<FredReleaseDate[]> {
  if (!env.FRED_API_KEY) {
    return [];
  }

  const now = new Date();
  const url = new URL("https://api.stlouisfed.org/fred/releases/dates");
  url.searchParams.set("api_key", env.FRED_API_KEY);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("realtime_start", dateOnly(addDays(now, -7)));
  url.searchParams.set("realtime_end", dateOnly(addDays(now, 60)));
  url.searchParams.set("include_release_dates_with_no_data", "true");
  url.searchParams.set("sort_order", "asc");
  url.searchParams.set("limit", "1000");

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`FRED release calendar request failed: ${response.status}`);
  }

  const payload = (await response.json()) as FredReleaseDatesResponse;
  return payload.release_dates ?? [];
}

function normalizeFredReleaseDate(
  release: FredReleaseDate,
  blsFacts: Map<BlsFactKey, BlsFact>,
): EconomicCalendarEvent | null {
  const rule = findReleaseRule(release.release_name);

  if (!rule) {
    return null;
  }

  const fact = rule.blsFactKey ? blsFacts.get(rule.blsFactKey) : undefined;
  const scenarios = officialScenarioFor(rule);
  const startsAt = dateTimeUtc(release.date, rule.timeUtc);
  const isFutureRelease = new Date(startsAt).getTime() > Date.now();
  const isReleasePackage = !rule.blsFactKey;
  const title = rule.title;
  const event = {
    country: "САЩ",
    currency: "USD",
    startsAt,
    title,
  };
  const actual = isFutureRelease ? undefined : fact?.actual ?? (isReleasePackage ? "Публикувано" : undefined);
  const actualSource = actual
    ? fact
      ? "FRED + BLS official data"
      : "FRED release calendar"
    : undefined;

  return {
    id: `fred-release-${release.release_id}-${release.date}`,
    calendarKey: buildCalendarEventKey(event),
    startsAt,
    country: event.country,
    currency: event.currency,
    title,
    impact: rule.impact,
    eventType: inferCalendarEventType(rule.title),
    relevance: rule.relevance,
    previous: fact?.previous,
    forecastStatus: isReleasePackage ? "not_applicable" : "unavailable_free",
    actual,
    actualSource,
    actualUpdatedAt: actual ? new Date().toISOString() : undefined,
    actualStatus: getCalendarActualStatus({ actual, startsAt }),
    latestActual: fact?.actual,
    latestActualPeriod: fact?.period,
    source: fact ? "FRED + BLS official data" : "FRED release calendar",
    sourceUrl: fact?.sourceUrl ?? rule.sourceUrl ?? `https://fred.stlouisfed.org/release?rid=${release.release_id}`,
    affectedDrivers: rule.affectedDrivers,
    expectedGoldImpact: rule.expectedGoldImpact,
    scenarioBullish: scenarios.bullish,
    scenarioBearish: scenarios.bearish,
    explanationBg: officialExplanationFor(rule),
  };
}

const monthIndexByName: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseFomcMeetings(html: string) {
  const meetings: EconomicCalendarEvent[] = [];
  const sectionPattern =
    /<h4><a id="[^"]+">(\d{4}) FOMC Meetings<\/a><\/h4><\/div>([\s\S]*?)(?=<div class="panel-footer">)/g;

  for (const sectionMatch of html.matchAll(sectionPattern)) {
    const year = Number(sectionMatch[1]);
    const sectionHtml = sectionMatch[2];
    const rowPattern =
      /<div class="[^"]*fomc-meeting[^"]*"[^>]*>[\s\S]*?<strong>([^<]+)<\/strong>[\s\S]*?fomc-meeting__date[^>]*>([^<]+)<\/div>/g;

    for (const rowMatch of sectionHtml.matchAll(rowPattern)) {
      const rawMonth = stripHtml(rowMatch[1]).split("/").at(-1)?.toLowerCase() ?? "";
      const rawDate = stripHtml(rowMatch[2]);

      if (/notation/i.test(rawDate)) {
        continue;
      }

      const monthIndex = monthIndexByName[rawMonth];
      const dateNumbers = rawDate.match(/\d+/g)?.map(Number) ?? [];
      const day = dateNumbers.at(-1);

      if (monthIndex === undefined || !day) {
        continue;
      }

      const date = new Date(Date.UTC(year, monthIndex, day, 18, 0, 0));
      const startsAt = date.toISOString();
      const scenarios = officialScenarioFor({
        pattern: /fomc/i,
        title: "FOMC Rate Decision",
        impact: "high",
        relevance: "direct",
        affectedDrivers: ["fed", "real_yields", "nominal_yields", "usd"],
        expectedGoldImpact: "mixed",
        timeUtc: "18:00",
      });

      meetings.push({
        id: `fed-fomc-${startsAt.slice(0, 10)}`,
        calendarKey: buildCalendarEventKey({
          country: "САЩ",
          currency: "USD",
          startsAt,
          title: "FOMC Rate Decision",
        }),
        startsAt,
        country: "САЩ",
        currency: "USD",
        title: "FOMC Rate Decision",
        impact: "high",
        eventType: "central_bank",
        relevance: "direct",
        forecastStatus: "unavailable_free",
        actualStatus: getCalendarActualStatus({ startsAt }),
        source: "Federal Reserve",
        sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
        affectedDrivers: ["fed", "real_yields", "nominal_yields", "usd"],
        expectedGoldImpact: "mixed",
        scenarioBullish: scenarios.bullish,
        scenarioBearish: scenarios.bearish,
        explanationBg:
          "FOMC решенията са директен драйвер за златото, защото променят очакванията за лихвите, реалните доходности и долара.",
      });
    }
  }

  return meetings;
}

async function fetchFomcCalendarEvents() {
  const response = await fetch("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Federal Reserve FOMC calendar request failed: ${response.status}`);
  }

  return parseFomcMeetings(await response.text());
}

export function mapFredReleaseDatesToCalendarEvents(
  releases: FredReleaseDate[],
  blsFacts = new Map<BlsFactKey, BlsFact>(),
) {
  return releases
    .map((release) => normalizeFredReleaseDate(release, blsFacts))
    .filter((event): event is EconomicCalendarEvent => Boolean(event));
}

export async function fetchFreeOfficialCalendarEvents(
  retainedEvents: EconomicCalendarEvent[] = [],
): Promise<EconomicCalendarEvent[]> {
  const [fredResult, blsResult, fomcResult, forexFactoryResult, officialActualResult] = await Promise.allSettled([
    fetchFredReleaseDates(),
    fetchBlsLatestFacts(),
    fetchFomcCalendarEvents(),
    fetchForexFactoryWeeklyCalendarEvents(),
    fetchOfficialActualFacts(),
  ]);

  const blsFacts = blsResult.status === "fulfilled" ? blsResult.value : new Map<BlsFactKey, BlsFact>();
  const officialActualFacts =
    officialActualResult.status === "fulfilled"
      ? officialActualResult.value
      : new Map<string, OfficialActualFact[]>();
  const fredEvents =
    fredResult.status === "fulfilled" ? mapFredReleaseDatesToCalendarEvents(fredResult.value, blsFacts) : [];
  const fomcEvents = fomcResult.status === "fulfilled" ? fomcResult.value : [];
  const forexFactoryEvents =
    forexFactoryResult.status === "fulfilled"
      ? enrichCalendarEventsWithOfficialActuals(forexFactoryResult.value, officialActualFacts)
      : [];
  const retainedEventsWithOfficialActuals =
    forexFactoryResult.status === "fulfilled"
      ? []
      : enrichCalendarEventsWithOfficialActuals(retainedEvents, officialActualFacts);
  const now = new Date();
  const lowWatermark = addDays(now, -14).getTime();
  const highWatermark = addDays(now, 90).getTime();

  return [...retainedEventsWithOfficialActuals, ...forexFactoryEvents, ...fredEvents, ...fomcEvents]
    .filter((event) => {
      const time = new Date(event.startsAt).getTime();
      return time >= lowWatermark && time <= highWatermark;
    })
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
    .slice(0, 200);
}
