import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { MetricCard } from "@/components/metric-card";
import { PageIntro } from "@/components/page-intro";
import { SectionCard } from "@/components/section-card";
import { loadDashboardSnapshot } from "@/lib/data/dashboard";

function buildProbabilityOption(bullish: number, bearish: number): EChartsOption {
  return {
    series: [
      {
        type: "pie",
        radius: ["68%", "86%"],
        avoidLabelOverlap: false,
        label: { show: false },
        data: [
          { value: bullish, name: "Bullish", itemStyle: { color: "#34d399" } },
          { value: bearish, name: "Bearish", itemStyle: { color: "#fb7185" } },
        ],
      },
    ],
    graphic: [
      {
        type: "text",
        left: "center",
        top: "42%",
        style: {
          text: `${bullish}%`,
          fill: "#ffffff",
          fontSize: 34,
          fontWeight: 700,
          align: "center",
        },
      },
      {
        type: "text",
        left: "center",
        top: "58%",
        style: {
          text: "Възходящо",
          fill: "#cbd5e1",
          fontSize: 12,
          align: "center",
        },
      },
    ],
  };
}

function buildHistoryOption(labels: string[], values: number[]): EChartsOption {
  return {
    grid: { left: 10, right: 10, top: 20, bottom: 10, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: labels,
      axisLabel: { color: "#94a3b8" },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      axisLabel: { color: "#94a3b8" },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
    },
    series: [
      {
        type: "line",
        smooth: true,
        showSymbol: false,
        data: values,
        lineStyle: { color: "#f9ce67", width: 3 },
      },
    ],
  };
}

export default async function SignalLabPage() {
  const snapshot = await loadDashboardSnapshot();
  const { signal } = snapshot;

  return (
    <div className="space-y-6">
      <PageIntro
        kicker="Сигнал"
        title="Как е сметната посоката и къде тежат факторите."
        lead="Сигналът не е черна кутия. Това е набор от правила, който нормализира новини, COT, макро и ценови режим в скала [-1, 1], след което превежда резултата до вероятностен индекс."
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <MetricCard
          label="Претеглен резултат"
          value={signal.weightedScore.toFixed(2)}
          hint="Нормализиран сбор преди вероятностното преобразуване"
          accent="gold"
        />
        <MetricCard
          label="Шанс за възход"
          value={`${signal.bullishProbability}%`}
          hint="Основният прочит за посока"
          accent="green"
        />
        <MetricCard
          label="Шанс за спад"
          value={`${signal.bearishProbability}%`}
          hint="Огледалната страна на индекса"
          accent="red"
        />
        <MetricCard
          label="Неутрална зона"
          value={`${signal.neutralBand.low}-${signal.neutralBand.high}`}
          hint="В тази зона посоката не е достатъчно чиста"
          accent="slate"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <SectionCard title="Вероятностен индикатор" eyebrow="Текущо изчисление">
          <BaseChart
            height={320}
            option={buildProbabilityOption(signal.bullishProbability, signal.bearishProbability)}
          />
        </SectionCard>

        <SectionCard title="Разбивка по фактори" eyebrow="Тегла на входовете">
          <div className="grid gap-4 sm:grid-cols-2">
            {signal.contributions.map((entry) => (
              <div
                key={entry.key}
                className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5"
              >
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-amber-200/80">
                  {entry.label}
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">{entry.score.toFixed(2)}</p>
                <p className="mt-2 text-sm text-slate-300">
                  тегло {(entry.weight * 100).toFixed(0)}% • принос {entry.contribution.toFixed(2)}
                </p>
                <p className="mt-4 text-sm leading-7 text-slate-300">{entry.narrative}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="История на сигнала" eyebrow="Последни изчисления">
          <BaseChart
            height={300}
            option={buildHistoryOption(
              [...snapshot.signalHistory].reverse().map((entry) => entry.asOf.slice(5, 10)),
              [...snapshot.signalHistory].reverse().map((entry) => entry.bullishProbability),
            )}
          />
        </SectionCard>

        <SectionCard title="Как се изчислява" eyebrow="Логика на правилата">
          <div className="space-y-4 text-sm leading-7 text-slate-300">
            <p>Новини 30%: усреднява посока, увереност и свежест на последните анализирани публикации.</p>
            <p>COT 25%: гледа нетната позиция на спекулативните участници, седмичната промяна и натиска от producer/swap сегментите.</p>
            <p>Макро 25%: комбинира долар, реални доходности, номинални доходности, Fed и CPI фон.</p>
            <p>Ценови режим 20%: потвърждение дали самото ценово действие подкрепя или опровергава тезата.</p>
            <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
              Вероятностно преобразуване: `probability = ((tanh(score * 1.65) + 1) / 2) * 100`
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
