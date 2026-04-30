import type { MacroSeries, MacroSnapshot } from "@/lib/types";
import { env } from "@/lib/env";
import { clamp, mean, stdDev } from "@/lib/utils";

type FredObservation = {
  date: string;
  value: string;
};

type FredResponse = {
  observations: FredObservation[];
};

const FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations";

const seriesCatalog = [
  {
    seriesId: "DTWEXBGS",
    label: "Широк доларов индекс",
    unit: "индекс",
    influence: "По-слаб долар обикновено подпомага златото.",
    weight: -1,
  },
  {
    seriesId: "DFII10",
    label: "10г. реална доходност",
    unit: "%",
    influence: "Понижаващи се реални доходности са класически плюс за златото.",
    weight: -1.2,
  },
  {
    seriesId: "DGS10",
    label: "10г. номинална доходност",
    unit: "%",
    influence: "Ръстът в номиналните доходности често ограничава импулса.",
    weight: -0.8,
  },
  {
    seriesId: "FEDFUNDS",
    label: "Fed funds",
    unit: "%",
    influence: "По-мек Fed режим подпомага търсенето на злато.",
    weight: -0.55,
  },
  {
    seriesId: "CPIAUCSL",
    label: "CPI инфлация",
    unit: "индекс",
    influence: "Ускоряваща се инфлация повишава интереса към защита от обезценка.",
    weight: 0.5,
  },
] as const;

function toNumeric(observations: FredObservation[]) {
  return observations
    .filter((observation) => observation.value !== ".")
    .map((observation) => ({
      date: observation.date,
      value: Number(observation.value),
    }));
}

function zScore(values: number[], value: number) {
  const sigma = stdDev(values);
  if (!sigma) {
    return 0;
  }

  return (value - mean(values)) / sigma;
}

function interpretSeries(seriesId: string, delta: number) {
  switch (seriesId) {
    case "DTWEXBGS":
      return delta < 0
        ? "Доларът отслабва и освобождава пространство за покачване при златото."
        : "Доларът се засилва и създава насрещен вятър за златото.";
    case "DFII10":
      return delta < 0
        ? "Реалните доходности слизат, което е конструктивно за златото."
        : "Реалните доходности се покачват и ограничават апетита към злато.";
    case "DGS10":
      return delta < 0
        ? "Номиналните доходности спадат и облекчават натиска върху златото."
        : "Номиналните доходности растат и правят алтернативата на златото по-конкурентна.";
    case "FEDFUNDS":
      return delta <= 0
        ? "Fed режимът не добавя допълнителен натиск върху златото."
        : "По-висока лихвена база подсилва рестриктивния фон.";
    case "CPIAUCSL":
      return delta > 0
        ? "Инфлационният импулс остава жив, което подхранва защитния аргумент за злато."
        : "По-спокойната инфлация отслабва част от защитната теза.";
    default:
      return "Серията добавя контекст към дневната картина.";
  }
}

export function mapFredSeries(seriesId: string, observations: FredObservation[]) {
  const descriptor = seriesCatalog.find((entry) => entry.seriesId === seriesId);
  if (!descriptor) {
    throw new Error(`Unsupported FRED series: ${seriesId}`);
  }

  const numeric = toNumeric(observations).slice(-24).reverse();
  const historyValues = numeric.map((entry) => entry.value);

  const snapshots: MacroSnapshot[] = numeric.map((entry, index) => {
    const previousValue = numeric[index + 1]?.value ?? null;
    const delta = previousValue === null ? 0 : Number((entry.value - previousValue).toFixed(3));
    const score = zScore(historyValues, entry.value);
    const directionalBias = clamp((delta / Math.max(Math.abs(previousValue ?? 1), 1)) * 100, -2.5, 2.5);

    return {
      id: `${seriesId}-${entry.date}`,
      seriesId,
      label: descriptor.label,
      date: entry.date,
      value: entry.value,
      previousValue,
      delta,
      zScore: Number(score.toFixed(2)),
      interpretation: interpretSeries(seriesId, delta),
      directionalBias: Number(directionalBias.toFixed(3)),
      unit: descriptor.unit,
    };
  });

  return {
    seriesId,
    label: descriptor.label,
    unit: descriptor.unit,
    influence: descriptor.influence,
    snapshots,
  } satisfies MacroSeries;
}

export async function fetchFredSeries(seriesId: (typeof seriesCatalog)[number]["seriesId"]) {
  if (!env.FRED_API_KEY) {
    throw new Error("Missing FRED_API_KEY");
  }

  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: env.FRED_API_KEY,
    file_type: "json",
    limit: "60",
    sort_order: "asc",
  });

  const response = await fetch(`${FRED_BASE_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch FRED series ${seriesId}`);
  }

  const data = (await response.json()) as FredResponse;
  return mapFredSeries(seriesId, data.observations);
}

export async function fetchMacroSeries() {
  return Promise.all(seriesCatalog.map((series) => fetchFredSeries(series.seriesId)));
}
