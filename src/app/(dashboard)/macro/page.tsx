import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { PageIntro } from "@/components/page-intro";
import { SectionCard } from "@/components/section-card";
import { formatCompactNumber } from "@/lib/format";
import { loadDashboardSnapshot } from "@/lib/data/dashboard";
import { formatSigned } from "@/lib/utils";

function buildSeriesOption(labels: string[], values: number[], color: string): EChartsOption {
  return {
    grid: { left: 10, right: 10, top: 10, bottom: 10, containLabel: true },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
    },
    series: [
      {
        type: "line",
        data: values,
        smooth: true,
        showSymbol: false,
        lineStyle: { color, width: 3 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${color}55` },
              { offset: 1, color: `${color}00` },
            ],
          },
        },
      },
    ],
  };
}

export default async function MacroPage() {
  const snapshot = await loadDashboardSnapshot();

  return (
    <div className="space-y-6">
      <PageIntro
        kicker="Macro Drivers"
        title="Фонът зад движението: долар, доходности, инфлация и Fed."
        lead="Тези серии са подбрани, защото най-често обясняват дали златото има пространство да разгърне тенденцията си или трябва да се бори срещу макро насрещен вятър."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {snapshot.macroSeries.map((series, index) => {
          const latest = series.snapshots[0];
          const color = ["#f9ce67", "#38bdf8", "#34d399", "#a78bfa", "#fb7185"][index % 5];

          return (
            <SectionCard
              key={series.seriesId}
              title={series.label}
              eyebrow={series.seriesId}
              className="overflow-hidden"
            >
              <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
                <div className="space-y-4">
                  <div>
                    <p className="text-4xl font-semibold text-white">
                      {formatCompactNumber(latest.value)} {series.unit}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      Delta {formatSigned(latest.delta, 2)} • z-score {latest.zScore.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-sm leading-7 text-slate-300">{latest.interpretation}</p>
                  <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">
                    {series.influence}
                  </div>
                </div>

                <BaseChart
                  height={240}
                  option={buildSeriesOption(
                    [...series.snapshots].reverse().map((entry) => entry.date.slice(5)),
                    [...series.snapshots].reverse().map((entry) => entry.value),
                    color,
                  )}
                />
              </div>
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}
