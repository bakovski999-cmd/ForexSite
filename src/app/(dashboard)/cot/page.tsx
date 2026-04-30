import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { CotDeltaChart } from "@/components/charts/cot-delta-chart";
import { CotPositionTable } from "@/components/cot-position-table";
import { MetricCard } from "@/components/metric-card";
import { PageIntro } from "@/components/page-intro";
import { SectionCard } from "@/components/section-card";
import { buildCotPositionRows } from "@/lib/cot";
import { loadDashboardSnapshot } from "@/lib/data/dashboard";
import { formatCompactNumber } from "@/lib/format";

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
  const cotRows = buildCotPositionRows(combined.snapshots);
  const latestCotRow = cotRows[0];
  const visibleTableRows = cotRows.slice(0, 16);
  const visibleChartRows = visibleTableRows.slice().reverse();

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
          value={formatCompactNumber(latestCotRow.net)}
          hint={`Отворен интерес ${formatCompactNumber(latestCotRow.openInterest)}`}
          accent="gold"
        />
        <MetricCard
          label="Седмична промяна"
          value={formatCompactNumber(latestCotRow.changeNet)}
          hint="Промяна в нетната позиция спрямо предишната седмица"
          accent={latestCotRow.changeNet >= 0 ? "green" : "red"}
        />
        <MetricCard
          label="Нетно само фючърси"
          value={formatCompactNumber(futuresOnly.snapshots[0].managedMoneyNet)}
          hint="Сравнение без включени опции"
          accent="slate"
        />
      </div>

      <SectionCard title="Спекуланти срещу хеджъри" eyebrow="Комбиниран COT отчет">
        <BaseChart
          height={330}
          option={buildCotLineOption(
            combined.snapshots.map((entry) => entry.reportDate.slice(5)).reverse(),
            combined.snapshots.map((entry) => entry.managedMoneyNet).reverse(),
            combined.snapshots.map((entry) => entry.producerNet).reverse(),
          )}
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[22px] border border-amber-300/15 bg-amber-300/8 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">
              Спекулативна нетна позиция
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-200">
              Това е позицията на managed money участниците: фондове, CTA стратегии и други големи
              спекулативни играчи. Сметката е Long минус Short. Когато линията е положителна и се
              качва, спекулантите добавят повече bullish експозиция към златото. Когато пада, те
              намаляват long натиска или добавят short позиции.
            </p>
          </div>
          <div className="rounded-[22px] border border-sky-300/15 bg-sky-400/8 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-200">
              Производители / хеджъри
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-200">
              Това са участници, които често използват фючърсите за защита на реален бизнес риск:
              производители, търговци и хеджиращи структури. При златото тази линия често е
              отрицателна, защото хеджърите продават фючърси, за да заключат цена. Това не е директна
              прогноза, а показва колко агресивно реалният сектор се застрахова.
            </p>
          </div>
          <div className="rounded-[22px] border border-emerald-300/12 bg-emerald-400/8 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
              Как се чете bullish
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-200">
              Най-чистият bullish прочит е когато спекулативната net позиция расте, long позициите се
              увеличават, short позициите не растат силно, а open interest също се разширява. Това
              подсказва, че в движението влиза нов капитал, а не само че стари позиции се затварят.
            </p>
          </div>
          <div className="rounded-[22px] border border-rose-300/12 bg-rose-400/8 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-200">
              Как се чете охлаждане
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-200">
              Ако спекулативната net позиция остава положителна, но започне да пада, това е охлаждане,
              не задължително bearish сигнал. По-сериозно предупреждение има, когато long позициите
              падат, short позициите растат и open interest не подкрепя нов възходящ поток.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Седмична промяна в позиционирането" eyebrow="Импулс в нетната позиция">
        <CotDeltaChart height={390} rows={visibleChartRows} />
        <div className="mt-5 grid gap-3 text-sm leading-7 text-slate-300 lg:grid-cols-3">
          <div className="rounded-[18px] border border-emerald-300/10 bg-emerald-400/8 p-4">
            <span className="font-semibold text-emerald-200">Зелен бар</span> означава, че нетната дълга
            позиция на managed money участниците се увеличава.
          </div>
          <div className="rounded-[18px] border border-rose-300/10 bg-rose-400/8 p-4">
            <span className="font-semibold text-rose-200">Червен бар</span> означава, че нетната дълга
            позиция намалява или short страната натежава.
          </div>
          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
            Точните числа за long, short и open interest се виждат при hover или click върху всеки бар.
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Седмична COT таблица" eyebrow="Официални CFTC данни за злато">
        <CotPositionTable rows={visibleTableRows} />
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5 text-sm leading-7 text-slate-300">
            Таблицата сравнява всяка отчетна седмица с предишната. `Long` и `Short` са отчетените
            спекулативни позиции, `Net позиция` е Long минус Short, а `% OI` показва какъв дял от
            общия open interest държи съответната страна.
          </div>
          <div className="rounded-[22px] border border-amber-300/15 bg-amber-300/8 p-5 text-sm leading-7 text-amber-50/90">
            CFTC не публикува директно колко сделки са “новоотворени” или “затворени”. Затова тук
            показваме коректната седмична промяна в отчетените позиции, обновена при нов COT release.
            <a
              href={combined.snapshots[0].sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block font-semibold text-amber-200 hover:text-amber-100"
            >
              Официален CFTC източник
            </a>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Как да се чете" eyebrow="Интерпретация">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm font-medium text-white">Спекулативни участници</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Положителна net позиция означава, че спекулантите държат повече long, отколкото short.
              Това е подкрепящ фон за златото, но най-важна е промяната: дали net позицията расте или
              отслабва спрямо предишната седмица.
            </p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm font-medium text-white">Производители / хеджъри</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Отрицателна позиция при хеджърите е нормална за златото и често означава защита срещу
              ценови риск. Ако хеджиращата отрицателна позиция се задълбочава при силна цена, това
              показва повече застраховане, не задължително директен сигнал за спад.
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
