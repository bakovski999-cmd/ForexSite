"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";

import {
  buildCotPositionAnalysis,
  getCotChangeTone,
  type CotChangeTone,
  type CotPositionRow,
} from "@/lib/cot";
import { cn } from "@/lib/utils";

type Tone = CotChangeTone | "long" | "short";
type AnalysisStepTone = "context" | "primary" | "long" | "short" | "neutral" | "gold" | "conclusion";
type PatternTone = "cooling" | "bullish" | "bearish" | "neutral";

const numberFormatter = new Intl.NumberFormat("bg-BG");

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}

function formatSignedNumber(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function toneClass(tone: Tone) {
  switch (tone) {
    case "positive":
      return "border-emerald-300/10 bg-emerald-400/12 text-emerald-200";
    case "negative":
      return "border-rose-300/10 bg-rose-400/12 text-rose-200";
    case "long":
      return "border-emerald-300/10 bg-emerald-400/8 text-emerald-100";
    case "short":
      return "border-rose-300/10 bg-rose-400/8 text-rose-100";
    default:
      return "border-white/8 bg-white/[0.035] text-slate-200";
  }
}

function deltaTextClass(tone: CotChangeTone) {
  switch (tone) {
    case "positive":
      return "text-emerald-200";
    case "negative":
      return "text-rose-200";
    default:
      return "text-slate-200";
  }
}

function analysisStepClass(tone: AnalysisStepTone) {
  switch (tone) {
    case "primary":
      return "border-amber-300/24 bg-amber-300/[0.08]";
    case "long":
      return "border-emerald-300/16 bg-emerald-300/[0.045]";
    case "short":
      return "border-rose-300/16 bg-rose-300/[0.045]";
    case "gold":
      return "border-sky-300/18 bg-sky-300/[0.05]";
    case "conclusion":
      return "border-amber-300/28 bg-amber-300/10";
    default:
      return "border-white/8 bg-white/[0.035]";
  }
}

function analysisStepNumberClass(tone: AnalysisStepTone) {
  switch (tone) {
    case "primary":
    case "conclusion":
      return "border-amber-300/30 bg-amber-300/16 text-amber-100";
    case "long":
      return "border-emerald-300/24 bg-emerald-300/12 text-emerald-100";
    case "short":
      return "border-rose-300/24 bg-rose-300/12 text-rose-100";
    case "gold":
      return "border-sky-300/24 bg-sky-300/12 text-sky-100";
    default:
      return "border-white/12 bg-white/[0.05] text-slate-200";
  }
}

function patternCardClass(tone: PatternTone) {
  switch (tone) {
    case "bullish":
      return "border-emerald-300/18 bg-emerald-300/[0.055]";
    case "cooling":
      return "border-amber-300/20 bg-amber-300/[0.055]";
    case "bearish":
      return "border-rose-300/18 bg-rose-300/[0.055]";
    default:
      return "border-sky-300/16 bg-sky-300/[0.045]";
  }
}

function patternLabelClass(tone: PatternTone) {
  switch (tone) {
    case "bullish":
      return "border-emerald-300/18 bg-emerald-300/10 text-emerald-100";
    case "cooling":
      return "border-amber-300/18 bg-amber-300/10 text-amber-100";
    case "bearish":
      return "border-rose-300/18 bg-rose-300/10 text-rose-100";
    default:
      return "border-sky-300/16 bg-sky-300/10 text-sky-100";
  }
}

function movementPhrase(value: number, noun: string) {
  if (value > 0) {
    return `${noun} се увеличават`;
  }

  if (value < 0) {
    return `${noun} намаляват`;
  }

  return `${noun} са без промяна`;
}

function ValueCell({
  children,
  tone = "neutral",
  align = "right",
}: {
  children: ReactNode;
  tone?: Tone;
  align?: "left" | "right";
}) {
  return (
    <td className="px-2 py-2.5">
      <div
        className={cn(
          "rounded-xl border px-3 py-2 text-sm font-semibold tabular-nums",
          align === "right" ? "text-right" : "text-left",
          toneClass(tone),
        )}
      >
        {children}
      </div>
    </td>
  );
}

export function CotPositionTable({ rows }: { rows: CotPositionRow[] }) {
  const [selectedRow, setSelectedRow] = useState<CotPositionRow | null>(null);
  const selectedAnalysis = useMemo(
    () => (selectedRow ? buildCotPositionAnalysis(selectedRow) : null),
    [selectedRow],
  );

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <div className="max-w-3xl space-y-1">
          <p>Натисни върху COT ред, за да видиш подробен анализ спрямо предишната седмица.</p>
          <p>
            Цветът в колоните “Промяна” показва знака на числото: плюс е зелено, минус е червено.
            Пазарният ефект е обяснен в анализа при клик.
          </p>
        </div>
        <span className="rounded-full border border-amber-300/15 bg-amber-300/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
          Click за анализ
        </span>
      </div>
      <div className="overflow-x-auto rounded-[24px] border border-white/8 bg-slate-950/35">
        <table className="min-w-[1080px] border-separate border-spacing-y-1 p-2 text-left">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              <th className="px-3 py-3 font-semibold">Дата</th>
              <th className="px-3 py-3 text-right font-semibold">Long</th>
              <th className="px-3 py-3 text-right font-semibold">Short</th>
              <th className="px-3 py-3 text-right font-semibold">Промяна Long</th>
              <th className="px-3 py-3 text-right font-semibold">Промяна Short</th>
              <th className="px-3 py-3 text-right font-semibold">Net позиция</th>
              <th className="px-3 py-3 text-right font-semibold">Промяна Net</th>
              <th className="px-3 py-3 text-right font-semibold">% OI Long</th>
              <th className="px-3 py-3 text-right font-semibold">% OI Short</th>
              <th className="px-3 py-3 text-right font-semibold">Open Interest</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                role="button"
                tabIndex={0}
                className="group cursor-pointer outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-amber-300/60"
                onClick={() => setSelectedRow(row)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedRow(row);
                  }
                }}
              >
                <ValueCell tone="neutral" align="left">
                  {formatDate(row.reportDate)}
                </ValueCell>
                <ValueCell tone="long">{formatNumber(row.long)}</ValueCell>
                <ValueCell tone="short">{formatNumber(row.short)}</ValueCell>
                <ValueCell tone={getCotChangeTone(row.changeLong)}>
                  {formatSignedNumber(row.changeLong)}
                </ValueCell>
                <ValueCell tone={getCotChangeTone(row.changeShort)}>
                  {formatSignedNumber(row.changeShort)}
                </ValueCell>
                <ValueCell tone={row.net >= 0 ? "positive" : "negative"}>
                  {formatSignedNumber(row.net)}
                </ValueCell>
                <ValueCell tone={getCotChangeTone(row.changeNet)}>
                  {formatSignedNumber(row.changeNet)}
                </ValueCell>
                <ValueCell tone="long">{formatPercent(row.longOpenInterestShare)}</ValueCell>
                <ValueCell tone="short">{formatPercent(row.shortOpenInterestShare)}</ValueCell>
                <ValueCell tone="neutral">{formatNumber(row.openInterest)}</ValueCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRow && selectedAnalysis ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/78 px-4 py-6 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label={selectedAnalysis.headline}
          onClick={() => setSelectedRow(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-[28px] border border-white/12 bg-[#111827] p-5 shadow-2xl shadow-black/40 sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
                  {selectedAnalysis.comparisonLabel}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                  {selectedAnalysis.headline}
                </h2>
                <div className="mt-3 inline-flex rounded-full border border-amber-300/15 bg-amber-300/10 px-3 py-1 text-sm font-semibold text-amber-100">
                  {selectedAnalysis.biasLabel}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="inline-flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
                aria-label="Затвори COT анализа"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricPill
                label="Long"
                value={formatNumber(selectedRow.long)}
                delta={formatSignedNumber(selectedRow.changeLong)}
                tone="long"
                deltaTone={getCotChangeTone(selectedRow.changeLong)}
              />
              <MetricPill
                label="Short"
                value={formatNumber(selectedRow.short)}
                delta={formatSignedNumber(selectedRow.changeShort)}
                tone="short"
                deltaTone={getCotChangeTone(selectedRow.changeShort)}
              />
              <MetricPill
                label="Net"
                value={formatSignedNumber(selectedRow.net)}
                delta={formatSignedNumber(selectedRow.changeNet)}
                tone={selectedRow.changeNet >= 0 ? "positive" : "negative"}
                deltaTone={getCotChangeTone(selectedRow.changeNet)}
              />
              <MetricPill
                label="Open Interest"
                value={formatNumber(selectedRow.openInterest)}
                delta={formatSignedNumber(selectedRow.changeOpenInterest)}
                tone="neutral"
                deltaTone={getCotChangeTone(selectedRow.changeOpenInterest)}
              />
            </div>

            <div className="mt-6 rounded-[24px] border border-white/8 bg-white/[0.025] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                Ред за четене
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                {["Контекст", "Net", "Long", "Short", "Open Interest", "Злато", "Извод"].map((item, index) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1"
                  >
                    {index + 1}. {item}
                  </span>
                ))}
              </div>
            </div>

            <ol className="mt-5 space-y-3">
              <AnalysisStep
                number={1}
                title="Общ обзор"
                subtitle="Първо разбери какво сравнява редът."
                text={selectedAnalysis.overview}
                tone="context"
              />
              <AnalysisStep
                number={2}
                title="Net позиция"
                subtitle="Това е основният COT сигнал: Long минус Short."
                text={selectedAnalysis.netAnalysis}
                tone="primary"
              />
              <AnalysisStep
                number={3}
                title="Long позиции"
                subtitle="Показва дали спекулантите добавят или махат bullish експозиция."
                text={selectedAnalysis.longAnalysis}
                tone="long"
              />
              <AnalysisStep
                number={4}
                title="Short позиции"
                subtitle="Показва дали се добавя натиск срещу златото или се покриват къси позиции."
                text={selectedAnalysis.shortAnalysis}
                tone="short"
              />
              <AnalysisStep
                number={5}
                title="Open interest"
                subtitle="Проверява дали промяната идва с ново участие или със затваряне/редуциране."
                text={selectedAnalysis.openInterestAnalysis}
                tone="neutral"
              />
              <AnalysisStep
                number={6}
                title="Как влияе на златото"
                subtitle="След числата идва пазарният прочит за XAU."
                text={selectedAnalysis.goldImpact}
                tone="gold"
              />
              <AnalysisStep
                number={7}
                title="Финален извод"
                subtitle="Накрая събери всичко в един работен прочит."
                text={selectedAnalysis.conclusion}
                tone="conclusion"
              />
            </ol>

            <CotLearningExample row={selectedRow} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function MetricPill({
  label,
  value,
  delta,
  tone,
  deltaTone,
}: {
  label: string;
  value: string;
  delta: string;
  tone: Tone;
  deltaTone: CotChangeTone;
}) {
  return (
    <div className={cn("rounded-2xl border p-4", toneClass(tone))}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
      <p className={cn("mt-1 text-sm font-semibold tabular-nums", deltaTextClass(deltaTone))}>
        седмично {delta}
      </p>
    </div>
  );
}

function AnalysisStep({
  number,
  title,
  subtitle,
  text,
  tone,
}: {
  number: number;
  title: string;
  subtitle: string;
  text: string;
  tone: AnalysisStepTone;
}) {
  return (
    <li className={cn("rounded-[22px] border p-5", analysisStepClass(tone))}>
      <div className="grid gap-4 sm:grid-cols-[52px_1fr]">
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-2xl border text-sm font-bold tabular-nums",
            analysisStepNumberClass(tone),
          )}
        >
          {number}
        </div>
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-base font-semibold text-white">{title}</p>
            {number === 2 ? (
              <span className="rounded-full border border-amber-300/22 bg-amber-300/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-100">
                най-важно
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{subtitle}</p>
          <p className="mt-3 text-sm leading-7 text-slate-300">{text}</p>
        </div>
      </div>
    </li>
  );
}

function CotLearningExample({ row }: { row: CotPositionRow }) {
  const hasPrevious =
    row.previousLong !== undefined &&
    row.previousShort !== undefined &&
    row.previousNet !== undefined &&
    row.previousOpenInterest !== undefined;

  return (
    <details className="group mt-5 rounded-[24px] border border-amber-300/14 bg-amber-300/[0.035] p-4 open:bg-amber-300/[0.05]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3 text-left transition hover:bg-white/[0.06] [&::-webkit-details-marker]:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
            Пример и визуален прочит
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            Отвори, ако искаш по-просто търговско обяснение на COT реда
          </p>
        </div>
        <ChevronDown className="size-5 shrink-0 text-amber-100 transition group-open:rotate-180" />
      </summary>

      <div className="mt-4 space-y-4">
        <div className="rounded-[22px] border border-white/8 bg-slate-950/28 p-4">
          <p className="text-sm font-semibold text-white">Прост пример с текущата седмица</p>
          <div className="mt-3 space-y-3 text-sm leading-7 text-slate-300">
            {hasPrevious ? (
              <>
                <p>
                  Представи си, че гледаме как големите спекулативни участници променят своите
                  “залози” от една COT седмица към следващата. Миналата седмица те са имали{" "}
                  <span className="font-semibold text-emerald-100">
                    {formatNumber(row.previousLong ?? 0)} long
                  </span>{" "}
                  и{" "}
                  <span className="font-semibold text-rose-100">
                    {formatNumber(row.previousShort ?? 0)} short
                  </span>{" "}
                  контракта. Тази седмица long са{" "}
                  <span className="font-semibold text-emerald-100">{formatNumber(row.long)}</span>, а
                  short са <span className="font-semibold text-rose-100">{formatNumber(row.short)}</span>.
                </p>
                <p>
                  Реалната промяна е:{" "}
                  <span className={cn("font-semibold", deltaTextClass(getCotChangeTone(row.changeLong)))}>
                    {movementPhrase(row.changeLong, "Long")} с {formatSignedNumber(row.changeLong)}
                  </span>
                  , а{" "}
                  <span className={cn("font-semibold", deltaTextClass(getCotChangeTone(row.changeShort)))}>
                    {movementPhrase(row.changeShort, "Short")} с {formatSignedNumber(row.changeShort)}
                  </span>
                  . Net позицията се движи от{" "}
                  <span className="font-semibold text-slate-100">
                    {formatSignedNumber(row.previousNet ?? 0)}
                  </span>{" "}
                  към <span className="font-semibold text-slate-100">{formatSignedNumber(row.net)}</span>.
                </p>
              </>
            ) : (
              <p>
                Представи си COT като седмична снимка на големите участници: колко контракта са
                заложени за покачване, колко са заложени срещу покачване и дали общата net картина се
                подобрява или отслабва.
              </p>
            )}
            <p>
              По-просто: ако long страната намалява, short страната расте и net позицията пада,
              пазарът може още да е net long, но bullish импулсът вече не е толкова силен. Това не е
              автоматична прогноза за спад; то казва, че подкрепата от позиционирането е по-слаба.
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <CotPatternCard
            tone="cooling"
            title="Охлаждане на bullish импулса"
            signals={["Long намалява", "Short се увеличава", "Net пада"]}
            result="Спекулантите намаляват long натиска и добавят short страна. Златото още може да е подкрепено, но импулсът отслабва."
          />
          <CotPatternCard
            tone="bullish"
            title="Засилване на bullish импулса"
            signals={["Long расте", "Short пада", "Net расте"]}
            result="Това е най-чистият позитивен COT прочит: повече bullish експозиция и по-малко short натиск."
          />
          <CotPatternCard
            tone="bearish"
            title="По-сериозен bearish натиск"
            signals={["Long пада", "Short расте", "Open Interest расте"]}
            result="Тук вече има по-силен предупредителен сигнал: не само се махат long позиции, но се добавя нов short интерес."
          />
          <CotPatternCard
            tone="neutral"
            title="Затваряне на позиции"
            signals={["Long пада", "Short пада", "Open Interest пада"]}
            result="Това често е редуциране на участие от двете страни. Не е задължително нова посока, а по-скоро прибиране на риск."
          />
        </div>
      </div>
    </details>
  );
}

function CotPatternCard({
  title,
  signals,
  result,
  tone,
}: {
  title: string;
  signals: string[];
  result: string;
  tone: PatternTone;
}) {
  return (
    <div className={cn("rounded-[22px] border p-4", patternCardClass(tone))}>
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {signals.map((signal) => (
          <span
            key={signal}
            className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", patternLabelClass(tone))}
          >
            {signal}
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{result}</p>
    </div>
  );
}
