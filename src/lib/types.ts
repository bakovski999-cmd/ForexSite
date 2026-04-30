export type SignalDirection = "bullish" | "bearish" | "neutral" | "mixed";

export type DriverTag =
  | "usd"
  | "real_yields"
  | "nominal_yields"
  | "inflation"
  | "fed"
  | "geopolitics"
  | "risk"
  | "physical_demand"
  | "positioning"
  | "technical";

export type TimeHorizon = "intraday" | "1-3 days" | "1-2 weeks" | "multi-week";

export type SourceHealth = "fresh" | "stale" | "fallback";

export type CalendarImpact = "low" | "medium" | "high";

export type CalendarRelevance = "direct" | "strong" | "context";

export type CalendarForecastStatus = "provided" | "unavailable_free" | "not_applicable";

export type CalendarEventType =
  | "growth"
  | "inflation"
  | "employment"
  | "central_bank"
  | "bonds"
  | "housing"
  | "consumer_surveys"
  | "business_surveys"
  | "speeches"
  | "misc";

export interface UserSession {
  email: string;
  mode: "demo" | "firebase" | "supabase";
}

export interface NewsItem {
  id: string;
  source: string;
  title: string;
  url: string;
  publishedAt: string;
  rawSummary: string;
  dedupeHash: string;
  overallSentiment?: number;
  topics: string[];
}

export interface NewsAnalysis {
  newsItemId: string;
  summaryBg: string;
  impactDirection: SignalDirection;
  timeHorizon: TimeHorizon;
  confidence: number;
  affectedDrivers: DriverTag[];
  whyItMatters: string;
  explanation: string;
  directionalScore: number;
}

export interface AnalyzedNewsItem {
  item: NewsItem;
  analysis: NewsAnalysis;
}

export interface CotSnapshot {
  id: string;
  reportDate: string;
  reportType: "combined" | "futures_only";
  marketName: string;
  openInterest: number;
  managedMoneyLong: number;
  managedMoneyShort: number;
  managedMoneyNet: number;
  managedMoneyLongDelta?: number;
  managedMoneyShortDelta?: number;
  openInterestDelta?: number;
  swapDealerNet: number;
  producerNet: number;
  otherReportablesNet: number;
  weeklyDelta: number;
  sourceUrl: string;
}

export interface CotSeries {
  reportType: "combined" | "futures_only";
  label: string;
  snapshots: CotSnapshot[];
}

export interface MacroSnapshot {
  id: string;
  seriesId: string;
  label: string;
  date: string;
  value: number;
  previousValue: number | null;
  delta: number;
  zScore: number;
  interpretation: string;
  directionalBias: number;
  unit: string;
}

export interface MacroSeries {
  seriesId: string;
  label: string;
  unit: string;
  influence: string;
  snapshots: MacroSnapshot[];
}

export interface PricePoint {
  date: string;
  value: number;
}

export interface GoldPriceSnapshot {
  id: string;
  asOf: string;
  symbol: "GOLD";
  priceUsd: number;
  dailyChangePct: number;
  weeklyChangePct: number;
  monthlyChangePct: number;
  regime: "trend-up" | "range" | "pullback" | "trend-down";
  regimeScore: number;
  source: string;
  history: PricePoint[];
}

export interface FactorContribution {
  key: "news" | "cot" | "macro" | "priceRegime";
  label: string;
  weight: number;
  score: number;
  contribution: number;
  narrative: string;
}

export interface SignalRun {
  id: string;
  asOf: string;
  factorScores: Record<FactorContribution["key"], number>;
  weightedScore: number;
  bullishProbability: number;
  bearishProbability: number;
  bias: Exclude<SignalDirection, "mixed">;
  neutralBand: {
    low: number;
    high: number;
  };
  rationale: string[];
  contributions: FactorContribution[];
}

export interface SyncRun {
  id: string;
  source: string;
  status: "success" | "warning" | "failed";
  startedAt: string;
  finishedAt: string;
  errorMessage?: string;
  detail?: Record<string, unknown>;
}

export interface DashboardSnapshot {
  generatedAt: string;
  price: GoldPriceSnapshot;
  news: AnalyzedNewsItem[];
  calendarEvents: EconomicCalendarEvent[];
  cotSeries: CotSeries[];
  macroSeries: MacroSeries[];
  signal: SignalRun;
  signalHistory: SignalRun[];
  syncRuns: SyncRun[];
  staleFlags: Record<string, SourceHealth>;
}

export interface AlphaVantageNewsFeedItem {
  title: string;
  url: string;
  summary?: string;
  source?: string;
  time_published?: string;
  overall_sentiment_score?: number;
  topics?: Array<{ topic: string }>;
}

export interface GdeltArticle {
  title?: string;
  url?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourceCountry?: string;
}

export interface EconomicCalendarEvent {
  id: string;
  startsAt: string;
  country: string;
  currency: string;
  title: string;
  impact: CalendarImpact;
  eventType: CalendarEventType;
  relevance: CalendarRelevance;
  previous?: string;
  forecast?: string;
  forecastStatus?: CalendarForecastStatus;
  actual?: string;
  latestActual?: string;
  latestActualPeriod?: string;
  source: string;
  sourceUrl?: string;
  affectedDrivers: DriverTag[];
  expectedGoldImpact: SignalDirection;
  scenarioBullish: string;
  scenarioBearish: string;
  explanationBg: string;
}
