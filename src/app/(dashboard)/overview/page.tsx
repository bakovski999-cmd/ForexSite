import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { MetricCard } from "@/components/metric-card";
import { PageIntro } from "@/components/page-intro";
import { SectionCard } from "@/components/section-card";
import { SourceHealthBadge } from "@/components/source-health-badge";
import { formatCompactNumber, formatDateTimeLabel, formatPrice } from "@/lib/format";
import { loadDashboardSnapshot } from "@/lib/data/dashboard";
import { cn, formatPercent } from "@/lib/utils";

const biasLabels = {
  bullish: "Възходящо",
  bearish: "Низходящо",
  neutral: "Неутрално",
} as const;

const regimeLabels = {
  "trend-up": "Възходящ тренд",
  range: "Рейндж",
  pullback: "Корекция",
  "trend-down": "Низходящ тренд",
} as const;

const sourceLabels: Record<string, string> = {
  alphaVantage: "XAU/USD цена",
  gdelt: "GDELT",
  fred: "FRED",
  cftc: "CFTC",
  openai: "OpenAI анализ",
};

function buildPriceOption(dates: string[], values: number[]): EChartsOption {
  return {
    tooltip: {
      trigger: "axis",
      backgroundColor: "#0f1729",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#f8fafc" },
    },
    grid: { left: 10, right: 10, top: 20, bottom: 10, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: dates,
      axisLabel: { color: "#94a3b8" },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8" },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
    },
    series: [
      {
        data: values,
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { color: "#f9ce67", width: 3 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(249,206,103,0.36)" },
              { offset: 1, color: "rgba(249,206,103,0.02)" },
            ],
          },
        },
      },
    ],
  };
}

function buildContributionOption(
  labels: string[],
  values: number[],
  colors: string[],
): EChartsOption {
  return {
    grid: { left: 10, right: 20, top: 20, bottom: 10, containLabel: true },
    xAxis: {
      type: "value",
      min: -0.4,
      max: 0.4,
      axisLabel: { color: "#94a3b8" },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
    },
    yAxis: {
      type: "category",
      data: labels,
      axisLabel: { color: "#e2e8f0" },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: values.map((value, index) => ({
          value,
          itemStyle: { color: colors[index] },
        })),
        barWidth: 16,
        label: {
          show: true,
          position: "right",
          color: "#e2e8f0",
          formatter: "{c}",
        },
      },
    ],
  };
}

export default async function OverviewPage() {
  const snapshot = await loadDashboardSnapshot();
  const { price, signal } = snapshot;

  return (
    <div className="space-y-6">
      <PageIntro
        kicker="Общ преглед"
        title="Контекстът за златото в един кадър."
        lead="Комбиниран сигнал от новини, COT, макро и самото ценово действие. Това е работният екран за бърз сутрешен read и за проверка какво реално движи актива."
      />

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <SectionCard title="Текуща посока за златото" eyebrow="Вероятностен индекс">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p
                className={cn(
                  "inline-flex rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-[0.14em]",
                  signal.bias === "bullish" && "bg-emerald-400/14 text-emerald-200",
                  signal.bias === "bearish" && "bg-rose-400/14 text-rose-200",
                  signal.bias === "neutral" && "bg-slate-400/12 text-slate-200",
                )}
              >
                {biasLabels[signal.bias]}
              </p>
              <div className="mt-5 flex flex-wrap items-end gap-4">
                <p className="text-6xl font-semibold text-white">{signal.bullishProbability}%</p>
                <p className="pb-2 text-base text-slate-300">
                  шанс за възходящ сценарий
                  <br />
                  низходящ сценарий {signal.bearishProbability}%
                </p>
              </div>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">
                {signal.rationale.join(" ")}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <SourceHealthBadge health={snapshot.staleFlags.alphaVantage} />
                <SourceHealthBadge health={snapshot.staleFlags.fred} />
                <SourceHealthBadge health={snapshot.staleFlags.cftc} />
              </div>
            </div>

            <div className="grid gap-4">
              <MetricCard
                label="Спот злато"
                value={formatPrice(price.priceUsd)}
                hint={`XAU/USD • 1 ден ${formatPercent(price.dailyChangePct)} • 1 седм. ${formatPercent(price.weeklyChangePct)}`}
                accent="gold"
              />
              <MetricCard
                label="Ценови режим"
                value={regimeLabels[price.regime]}
                hint={`Месечен импулс ${formatPercent(price.monthlyChangePct)}`}
                accent="green"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Свежест на данните" eyebrow="Статус на източниците">
          <div className="grid gap-4">
            {Object.entries(snapshot.staleFlags).map(([source, health]) => (
              <div
                key={source}
                className="flex items-center justify-between rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4"
              >
                <div>
                  <p className="text-sm font-medium text-white">{sourceLabels[source] ?? source}</p>
                  <p className="text-xs text-slate-400">
                    Последно обновяване {formatDateTimeLabel(snapshot.generatedAt)}
                  </p>
                </div>
                <SourceHealthBadge health={health} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Цена на златото" eyebrow="Визуален контекст">
          <BaseChart
            height={310}
            option={buildPriceOption(
              price.history.map((point) => point.date.slice(5)),
              price.history.map((point) => point.value),
            )}
          />
        </SectionCard>

        <SectionCard title="Принос на факторите" eyebrow="Защо индексът е такъв">
          <BaseChart
            height={310}
            option={buildContributionOption(
              signal.contributions.map((entry) => entry.label),
              signal.contributions.map((entry) => Number(entry.contribution.toFixed(3))),
              signal.contributions.map((entry) =>
                entry.contribution >= 0 ? "#34d399" : "#fb7185",
              ),
            )}
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard
          label="Последна COT нетна позиция"
          value={formatCompactNumber(snapshot.cotSeries[0].snapshots[0].managedMoneyNet)}
          hint="Нетно позициониране на спекулативните участници"
          accent="green"
        />
        <MetricCard
          label="Водещ фактор"
          value={signal.contributions[0].label}
          hint={signal.contributions[0].narrative}
          accent="slate"
        />
        <MetricCard
          label="Последен sync"
          value={formatDateTimeLabel(snapshot.generatedAt)}
          hint="Ръчно обновяване е налично от горната лента."
          accent="gold"
        />
      </div>
    </div>
  );
}
