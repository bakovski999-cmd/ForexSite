import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { CotDeltaChart } from "@/components/charts/cot-delta-chart";
import { MetricCard } from "@/components/metric-card";
import { PageIntro } from "@/components/page-intro";
import { SectionCard } from "@/components/section-card";
import { formatCompactNumber } from "@/lib/format";
import { loadDashboardSnapshot } from "@/lib/data/dashboard";

function buildCotLineOption(labels: string[], longs: number[], shorts: number[]): EChartsOption {
  return {
    tooltip: {
      trigger: "axis",
      backgroundColor: "#0f1729",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#f8fafc" },
    },
    legend: {
      data: ["Спекулативна нетна позиция", "Производители / хеджъри"],
      textStyle: { color: "#cbd5e1" },
      top: 0,
    },
    grid: { left: 10, right: 10, top: 40, bottom: 10, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: labels,
      axisLabel: { color: "#94a3b8" },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8" },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
    },
    series: [
      {
        name: "Спекулативна нетна позиция",
        data: longs,
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { color: "#f9ce67", width: 3 },
      },
      {
        name: "Производители / хеджъри",
        data: shorts,
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { color: "#60a5fa", width: 2.5 },
      },
    ],
  };
}

export default async function CotPage() {
  const snapshot = await loadDashboardSnapshot();
  const combined = snapshot.cotSeries.find((entry) => entry.reportType === "combined")!;
  const futuresOnly = snapshot.cotSeries.find((entry) => entry.reportType === "futures_only")!;

  return (
    <div className="space-y-6">
      <PageIntro
        kicker="COT позициониране"
        title="Къде стоят спекулативните и хеджиращите потоци."
        lead="Седмичните COT данни показват дали спекулативните участници продължават да натискат посоката и дали хеджиращите сегменти абсорбират движението или вече го контрират."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard
          label="Комбинирана нетна позиция"
          value={formatCompactNumber(combined.snapshots[0].managedMoneyNet)}
          hint={`Отворен интерес ${formatCompactNumber(combined.snapshots[0].openInterest)}`}
          accent="gold"
        />
        <MetricCard
          label="Седмична промяна"
          value={formatCompactNumber(combined.snapshots[0].weeklyDelta)}
          hint="Промяна в нетната позиция спрямо предишната седмица"
          accent={combined.snapshots[0].weeklyDelta >= 0 ? "green" : "red"}
        />
        <MetricCard
          label="Нетно само фючърси"
          value={formatCompactNumber(futuresOnly.snapshots[0].managedMoneyNet)}
          hint="Сравнение без включени опции"
          accent="slate"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Спекуланти срещу хеджъри" eyebrow="Комбиниран COT отчет">
          <BaseChart
            height={320}
            option={buildCotLineOption(
              combined.snapshots.map((entry) => entry.reportDate.slice(5)).reverse(),
              combined.snapshots.map((entry) => entry.managedMoneyNet).reverse(),
              combined.snapshots.map((entry) => entry.producerNet).reverse(),
            )}
          />
        </SectionCard>

        <SectionCard title="Седмична промяна в позиционирането" eyebrow="Импулс в нетната позиция">
          <CotDeltaChart
            height={320}
            labels={combined.snapshots.map((entry) => entry.reportDate.slice(5)).reverse()}
            deltas={combined.snapshots.map((entry) => entry.weeklyDelta).reverse()}
          />
          <div className="mt-5 rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-sm leading-7 text-slate-300">
            Графиката показва седмичната промяна в нетната позиция на спекулативните участници.
            Зелен бар означава увеличение на нетната дълга позиция, а червен бар означава намаление.
            Точната стойност се вижда при hover върху бара; това е краен нетен ефект, не разделение по
            нови и затворени long/short позиции.
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Как да се чете" eyebrow="Интерпретация">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm font-medium text-white">Спекулативни участници</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Нетната дълга книга остава положителна. Това подсказва, че спекулативният сегмент още не е
              изпуснал възходящата теза, макар и екстремите да са по-умерени спрямо пика.
            </p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm font-medium text-white">Производители / хеджъри</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Нетната позиция на производители и търговци остава дълбоко отрицателна, което е типично
              за хеджиращата страна при силна цена. Това не е самостоятелен низходящ сигнал, но казва,
              че спот ралито се застрахова.
            </p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm font-medium text-white">Комбиниран срещу само фючърси</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Ако комбинираният отчет и отчетът само за фючърси се държат в синхрон, прочитът е по-чист.
              При рязко разминаване опциите често замъгляват директния сигнал за посока.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
