import { differenceInHours } from "date-fns";

import type {
  AnalyzedNewsItem,
  CotSeries,
  FactorContribution,
  GoldPriceSnapshot,
  MacroSeries,
  SignalRun,
} from "@/lib/types";
import { clamp, mean } from "@/lib/utils";

const factorWeights = {
  news: 0.3,
  cot: 0.25,
  macro: 0.25,
  priceRegime: 0.2,
} as const;

function recencyWeight(publishedAt: string) {
  const hours = Math.max(differenceInHours(new Date(), new Date(publishedAt)), 0);
  return Math.exp(-hours / 48);
}

export function computeNewsScore(news: AnalyzedNewsItem[]) {
  if (!news.length) {
    return 0;
  }

  const weights = news.map(({ item, analysis }) => {
    return recencyWeight(item.publishedAt) * Math.max(analysis.confidence, 0.15);
  });

  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;
  const weightedScore = news.reduce((sum, entry, index) => {
    return sum + entry.analysis.directionalScore * weights[index];
  }, 0);

  return clamp(weightedScore / totalWeight, -1, 1);
}

export function computeCotScore(cotSeries: CotSeries[]) {
  const combined = cotSeries.find((series) => series.reportType === "combined")?.snapshots ?? [];
  const latest = combined[0];
  const previous = combined[1];

  if (!latest) {
    return 0;
  }

  const managedMoneyRatio = latest.managedMoneyNet / latest.openInterest;
  const producerRatio = latest.producerNet / latest.openInterest;
  const swapRatio = latest.swapDealerNet / latest.openInterest;
  const weeklyMomentum = previous
    ? (latest.managedMoneyNet - previous.managedMoneyNet) / latest.openInterest
    : latest.weeklyDelta / latest.openInterest;

  const rawScore =
    managedMoneyRatio * 7.2 - producerRatio * 2.2 - swapRatio * 1.3 + weeklyMomentum * 8.5;

  return clamp(rawScore, -1, 1);
}

const macroSeriesSign: Record<string, number> = {
  DTWEXBGS: -1,
  DFII10: -1,
  DGS10: -0.7,
  FEDFUNDS: -0.5,
  CPIAUCSL: 0.45,
};

export function computeMacroScore(macroSeries: MacroSeries[]) {
  const scores = macroSeries
    .map((series) => {
      const latest = series.snapshots[0];
      if (!latest) {
        return null;
      }

      const sign = macroSeriesSign[series.seriesId] ?? 0;
      return clamp((latest.directionalBias * 0.6 + latest.zScore * 0.25 + latest.delta * 0.05) * sign, -1, 1);
    })
    .filter((value): value is number => typeof value === "number");

  return clamp(mean(scores), -1, 1);
}

export function computePriceRegimeScore(price: GoldPriceSnapshot) {
  const momentum = price.weeklyChangePct * 0.08 + price.monthlyChangePct * 0.04 + price.dailyChangePct * 0.03;
  return clamp((momentum + price.regimeScore * 0.6) / 2.2, -1, 1);
}

function getBias(probability: number, neutralBand: { low: number; high: number }) {
  if (probability > neutralBand.high) {
    return "bullish";
  }

  if (probability < neutralBand.low) {
    return "bearish";
  }

  return "neutral";
}

export function buildSignalRun(input: {
  news: AnalyzedNewsItem[];
  cotSeries: CotSeries[];
  macroSeries: MacroSeries[];
  price: GoldPriceSnapshot;
  asOf?: string;
}) {
  const factorScores = {
    news: computeNewsScore(input.news),
    cot: computeCotScore(input.cotSeries),
    macro: computeMacroScore(input.macroSeries),
    priceRegime: computePriceRegimeScore(input.price),
  };

  const weightedScore =
    factorScores.news * factorWeights.news +
    factorScores.cot * factorWeights.cot +
    factorScores.macro * factorWeights.macro +
    factorScores.priceRegime * factorWeights.priceRegime;

  const bullishProbability = Math.round(((Math.tanh(weightedScore * 1.65) + 1) / 2) * 100);
  const bearishProbability = 100 - bullishProbability;
  const neutralBand = { low: 45, high: 55 };

  const contributions: FactorContribution[] = [
    {
      key: "news",
      label: "Новини",
      weight: factorWeights.news,
      score: factorScores.news,
      contribution: factorScores.news * factorWeights.news,
      narrative:
        factorScores.news === 0
          ? "Няма live новинарски импулс, затова новините са неутрални в текущия сигнал."
          : factorScores.news > 0
          ? "Последните публикации подкрепят апетита към защитни активи."
          : "Последните публикации натежават срещу краткосрочния импулс при златото.",
    },
    {
      key: "cot",
      label: "COT",
      weight: factorWeights.cot,
      score: factorScores.cot,
      contribution: factorScores.cot * factorWeights.cot,
      narrative:
        factorScores.cot > 0
          ? "Позиционирането на managed money подсказва позитивен поток."
          : "Позиционирането изглежда по-скоро изчерпано или защитно.",
    },
    {
      key: "macro",
      label: "Макро",
      weight: factorWeights.macro,
      score: factorScores.macro,
      contribution: factorScores.macro * factorWeights.macro,
      narrative:
        factorScores.macro > 0
          ? "Макро фонът облекчава натиска от долара и реалните доходности."
          : "Макро фонът държи натиск през долара и доходностите.",
    },
    {
      key: "priceRegime",
      label: "Ценови режим",
      weight: factorWeights.priceRegime,
      score: factorScores.priceRegime,
      contribution: factorScores.priceRegime * factorWeights.priceRegime,
      narrative:
        factorScores.priceRegime > 0
          ? "Самата цена продължава да потвърждава положителния тренд."
          : "Ценовото действие отслабва и не потвърждава пълно възстановяване.",
    },
  ];

  const bias = getBias(bullishProbability, neutralBand);
  const rationale = contributions
    .sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution))
    .slice(0, 3)
    .map((entry) => entry.narrative);

  const signal: SignalRun = {
    id: `signal-${input.asOf ?? new Date().toISOString()}`,
    asOf: input.asOf ?? new Date().toISOString(),
    factorScores,
    weightedScore,
    bullishProbability,
    bearishProbability,
    bias,
    neutralBand,
    rationale,
    contributions,
  };

  return signal;
}
