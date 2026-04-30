"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { X } from "lucide-react";

import {
  buildCotPositionAnalysis,
  getCotChangeTone,
  type CotChangeTone,
  type CotPositionRow,
} from "@/lib/cot";
import { cn } from "@/lib/utils";

type Tone = CotChangeTone | "long" | "short";

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

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <AnalysisBlock title="Общ обзор" text={selectedAnalysis.overview} />
              <AnalysisBlock title="Как влияе на златото" text={selectedAnalysis.goldImpact} />
              <AnalysisBlock title="Long позиции" text={selectedAnalysis.longAnalysis} />
              <AnalysisBlock title="Short позиции" text={selectedAnalysis.shortAnalysis} />
              <AnalysisBlock title="Net позиция" text={selectedAnalysis.netAnalysis} />
              <AnalysisBlock title="Open interest" text={selectedAnalysis.openInterestAnalysis} />
            </div>

            <div className="mt-5 rounded-[22px] border border-amber-300/18 bg-amber-300/10 p-5 text-base leading-8 text-amber-50">
              <p className="font-semibold text-amber-200">Изводът</p>
              <p className="mt-2">{selectedAnalysis.conclusion}</p>
            </div>
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

function AnalysisBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-5">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-3 text-sm leading-7 text-slate-300">{text}</p>
    </div>
  );
}
