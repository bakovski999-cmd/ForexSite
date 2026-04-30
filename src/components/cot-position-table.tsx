import type { ReactNode } from "react";

import type { CotPositionRow } from "@/lib/cot";
import { cn } from "@/lib/utils";

type Tone = "positive" | "negative" | "neutral" | "long" | "short";

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

function toneForDelta(value: number, bullishWhenPositive = true): Tone {
  if (value === 0) {
    return "neutral";
  }

  const isPositive = bullishWhenPositive ? value > 0 : value < 0;
  return isPositive ? "positive" : "negative";
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
  return (
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
            <tr key={row.id} className="group">
              <ValueCell tone="neutral" align="left">
                {formatDate(row.reportDate)}
              </ValueCell>
              <ValueCell tone="long">{formatNumber(row.long)}</ValueCell>
              <ValueCell tone="short">{formatNumber(row.short)}</ValueCell>
              <ValueCell tone={toneForDelta(row.changeLong)}>
                {formatSignedNumber(row.changeLong)}
              </ValueCell>
              <ValueCell tone={toneForDelta(row.changeShort, false)}>
                {formatSignedNumber(row.changeShort)}
              </ValueCell>
              <ValueCell tone={row.net >= 0 ? "positive" : "negative"}>{formatSignedNumber(row.net)}</ValueCell>
              <ValueCell tone={toneForDelta(row.changeNet)}>{formatSignedNumber(row.changeNet)}</ValueCell>
              <ValueCell tone="long">{formatPercent(row.longOpenInterestShare)}</ValueCell>
              <ValueCell tone="short">{formatPercent(row.shortOpenInterestShare)}</ValueCell>
              <ValueCell tone="neutral">{formatNumber(row.openInterest)}</ValueCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
