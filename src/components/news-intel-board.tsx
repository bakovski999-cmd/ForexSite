"use client";

import { Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { getGoldNewsImpactScore, isStrongGoldNews } from "@/lib/calendar-presentation";
import { formatSofiaDateTime } from "@/lib/format";
import { isLiveAnalyzedNewsItem } from "@/lib/live-data";
import type { AnalyzedNewsItem, DriverTag, SignalDirection } from "@/lib/types";
import { cn } from "@/lib/utils";

const directionFilters: Array<{ key: SignalDirection | "all"; label: string }> = [
  { key: "all", label: "Всички" },
  { key: "bullish", label: "Възходящи" },
  { key: "bearish", label: "Низходящи" },
  { key: "neutral", label: "Неутрални" },
];

const driverLabels: Record<DriverTag, string> = {
  usd: "USD",
  real_yields: "Реални доходности",
  nominal_yields: "Номинални доходности",
  inflation: "Инфлация",
  fed: "Fed",
  geopolitics: "Геополитика",
  risk: "Риск",
  physical_demand: "Физическо търсене",
  positioning: "Позициониране",
  technical: "Техническа картина",
};

const directionLabels: Record<SignalDirection, string> = {
  bullish: "Възходящо",
  bearish: "Низходящо",
  neutral: "Неутрално",
  mixed: "Смесено",
};

const driverOrder: DriverTag[] = [
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
];

export function NewsIntelBoard({ news }: { news: AnalyzedNewsItem[] }) {
  const [direction, setDirection] = useState<SignalDirection | "all">("all");
  const [driver, setDriver] = useState<DriverTag | "all">("all");
  const liveNews = useMemo(() => news.filter(isLiveAnalyzedNewsItem), [news]);
  const strongestNewsIds = useMemo(() => {
    return new Set(
      [...liveNews]
        .sort((left, right) => getGoldNewsImpactScore(right.analysis) - getGoldNewsImpactScore(left.analysis))
        .filter((entry) => getGoldNewsImpactScore(entry.analysis) >= 0.12)
        .slice(0, 3)
        .map((entry) => entry.item.id),
    );
  }, [liveNews]);

  const filtered = useMemo(() => {
    return liveNews.filter((entry) => {
      const directionMatch =
        direction === "all" || entry.analysis.impactDirection === direction;
      const driverMatch =
        driver === "all" || entry.analysis.affectedDrivers.includes(driver);
      return directionMatch && driverMatch;
    });
  }, [direction, driver, liveNews]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {directionFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setDirection(filter.key)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                direction === filter.key
                  ? "border-amber-300/35 bg-amber-300/12 text-amber-100"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDriver("all")}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              driver === "all"
                ? "border-amber-300/35 bg-amber-300/12 text-amber-100"
                : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]",
            )}
          >
            Всички драйвери
          </button>
          {driverOrder.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setDriver(item)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                driver === item
                  ? "border-amber-300/35 bg-amber-300/12 text-amber-100"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]",
              )}
            >
              {driverLabels[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        {!filtered.length ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
            <p className="text-base font-semibold text-white">Няма live новини за показване в момента.</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Demo и fallback новините са скрити. Натисни „Обнови“, за да се заредят само реални
              публикации от активните news източници.
            </p>
          </div>
        ) : null}

        {filtered.map(({ item, analysis }) => (
          <article key={item.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-amber-200/80">
                    {item.source}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatSofiaDateTime(item.publishedAt, { seconds: false })}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em]",
                      analysis.impactDirection === "bullish" && "bg-emerald-500/14 text-emerald-200",
                      analysis.impactDirection === "bearish" && "bg-rose-500/14 text-rose-200",
                      analysis.impactDirection === "neutral" && "bg-slate-500/14 text-slate-200",
                    )}
                  >
                    {directionLabels[analysis.impactDirection]}
                  </span>
                  {isStrongGoldNews(analysis) || strongestNewsIds.has(item.id) ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-300/14 px-2.5 py-1 text-xs font-semibold text-amber-100">
                      <Zap className="size-3.5" />
                      Силен XAU драйвер
                    </span>
                  ) : null}
                </div>
                <h3 className="text-xl font-semibold leading-8 text-white">
                  {item.title}
                </h3>
                <p className="text-sm leading-6 text-slate-300">{analysis.summaryBg}</p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center rounded-full border border-amber-300/20 bg-amber-300/10 px-4 text-sm font-medium text-amber-100 transition hover:bg-amber-300/16"
                  >
                    Отвори източника
                  </a>
                </div>
              </div>

              <div className="w-full max-w-sm rounded-[22px] border border-white/8 bg-[#0d1527] p-4">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Увереност</span>
                  <span>{Math.round(analysis.confidence * 100)}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-amber-300"
                    style={{ width: `${Math.round(analysis.confidence * 100)}%` }}
                  />
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-200">{analysis.explanation}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {analysis.affectedDrivers.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-300"
                    >
                      {driverLabels[tag]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
