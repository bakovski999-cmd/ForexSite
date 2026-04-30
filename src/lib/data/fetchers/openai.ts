import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { env, hasOpenAI } from "@/lib/env";
import type { DriverTag, NewsAnalysis, NewsItem, SignalDirection, TimeHorizon } from "@/lib/types";
import { clamp } from "@/lib/utils";

const analysisSchema = z.object({
  summary_bg: z.string(),
  impact_direction: z.enum(["bullish", "bearish", "neutral", "mixed"]),
  time_horizon: z.enum(["intraday", "1-3 days", "1-2 weeks", "multi-week"]),
  confidence: z.number().min(0).max(1),
  affected_drivers: z.array(
    z.enum([
      "usd",
      "real_yields",
      "nominal_yields",
      "inflation",
      "fed",
      "geopolitics",
      "risk",
      "physical_demand",
      "positioning",
      "technical",
    ]),
  ),
  why_it_matters: z.string(),
  explanation: z.string(),
  directional_score: z.number().min(-1).max(1),
});

const keywordBias: Array<{
  terms: string[];
  direction: SignalDirection;
  score: number;
  drivers: DriverTag[];
  explanation: string;
}> = [
  {
    terms: ["rate cut", "cuts", "dovish", "easing", "geopolitical", "safe haven", "reserve demand"],
    direction: "bullish",
    score: 0.55,
    drivers: ["fed", "risk", "geopolitics", "physical_demand"],
    explanation: "Сюжетът е типично положителен за златото заради по-ниски реални доходности или защитно търсене.",
  },
  {
    terms: ["higher yields", "hawkish", "strong dollar", "usd strength", "treasury rise"],
    direction: "bearish",
    score: -0.55,
    drivers: ["usd", "real_yields", "nominal_yields", "fed"],
    explanation: "Сюжетът е по-скоро отрицателен за златото, защото повишава алтернативната доходност и доларовия натиск.",
  },
];

function fallbackDirection(text: string) {
  const lower = text.toLowerCase();

  for (const entry of keywordBias) {
    if (entry.terms.some((term) => lower.includes(term))) {
      return entry;
    }
  }

  return {
    direction: "neutral" as const,
    score: 0,
    drivers: ["technical"] as DriverTag[],
    explanation: "Новината е по-скоро контекстуална и не дава ясен самостоятелен импулс.",
  };
}

function buildFallbackAnalysis(item: NewsItem, reason?: string): NewsAnalysis {
  const fallback = fallbackDirection(`${item.title} ${item.rawSummary}`);

  return {
    newsItemId: item.id,
    summaryBg: item.rawSummary || item.title,
    impactDirection: fallback.direction,
    timeHorizon: "1-3 days",
    confidence: reason ? 0.44 : 0.54,
    affectedDrivers: fallback.drivers,
    whyItMatters: fallback.explanation,
    explanation: reason
      ? `${fallback.explanation} AI анализът временно не беше наличен, затова е използвана резервна rule-based оценка.`
      : fallback.explanation,
    directionalScore: fallback.score,
  };
}

export async function analyzeNewsItem(item: NewsItem): Promise<NewsAnalysis> {
  if (!hasOpenAI) {
    return buildFallbackAnalysis(item);
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  let response;

  try {
    response = await openai.responses.parse({
      model: env.OPENAI_MODEL,
      input: [
        {
          role: "system",
          content:
            "You are a macro commodities analyst. Explain gold-related news in Bulgarian. Be concise, factual, and non-promotional. Treat the output as an analytical interpretation, not financial advice.",
        },
        {
          role: "user",
          content: `Заглавие: ${item.title}\nИзточник: ${item.source}\nПубликувано: ${item.publishedAt}\nРезюме: ${item.rawSummary}\n\nИзведи как новината влияе на златото.`,
        },
      ],
      text: {
        format: zodTextFormat(analysisSchema, "gold_news_analysis"),
      },
    });
  } catch (error) {
    return buildFallbackAnalysis(item, error instanceof Error ? error.message : "OpenAI error");
  }

  const parsed = response.output_parsed;
  if (!parsed) {
    return buildFallbackAnalysis(item, "OpenAI analysis did not return a structured payload.");
  }

  return {
    newsItemId: item.id,
    summaryBg: parsed.summary_bg,
    impactDirection: parsed.impact_direction,
    timeHorizon: parsed.time_horizon as TimeHorizon,
    confidence: clamp(parsed.confidence, 0, 1),
    affectedDrivers: parsed.affected_drivers as DriverTag[],
    whyItMatters: parsed.why_it_matters,
    explanation: parsed.explanation,
    directionalScore: clamp(parsed.directional_score, -1, 1),
  };
}
