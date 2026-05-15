"use client";

import type { EChartsOption } from "echarts";
import {
  BadgeDollarSign,
  Calculator,
  ChevronDown,
  CheckCircle2,
  Database,
  Loader2,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BaseChart } from "@/components/charts/base-chart";
import {
  buildDefaultStockValuationInput,
  calculateFcfPerShareTtm,
  calculateHistoricalFcfAverage,
  calculateHistoricalMultipleSummary,
  calculateStockValuation,
  cloneStockValuationInput,
  type DcfTenYearsScenario,
  type EvEbitdaScenario,
  type FcfPerShareTtmCalculation,
  type HistoricalFreeCashFlowAverageCalculation,
  type HistoricalMultipleKey,
  type HistoricalMultipleSummary,
  type StockValuationAutofillFields,
  type StockValuationInput,
  type TerminalMultipleScenario,
  type ValuationField,
} from "@/lib/stock-valuation";
import type { SavedStockValuationAnalysis } from "@/lib/stock-valuation-repository";
import { cn } from "@/lib/utils";

type ModelKey = "dcf10Years" | "evEbitda" | "pe" | "dcfMultiple";

const modelTabs: Array<{ key: ModelKey; label: string }> = [
  { key: "dcf10Years", label: "DCF 10 years" },
  { key: "evEbitda", label: "EV/EBITDA" },
  { key: "pe", label: "P/E" },
  { key: "dcfMultiple", label: "DCF Multiple" },
];

function historicalMultipleKeyForModel(modelKey: ModelKey): HistoricalMultipleKey | null {
  if (modelKey === "dcfMultiple") {
    return "priceToFreeCashFlow";
  }

  if (modelKey === "pe") {
    return "peRatio";
  }

  if (modelKey === "evEbitda") {
    return "evToEbitda";
  }

  return null;
}

function formatCurrency(value: number | null, currency = "USD") {
  if (value === null || !Number.isFinite(value)) {
    return "needs input";
  }

  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) {
    return "needs input";
  }

  return `${(value * 100).toFixed(digits)}%`;
}

function formatPlainNumber(value: number | null, maximumFractionDigits = 2) {
  if (value === null || !Number.isFinite(value)) {
    return "needs input";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value);
}

function numberInputValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "";
  }

  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;

  return String(rounded);
}

function formattedNumberInputValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "";
  }

  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(rounded);
}

function parseNumberInput(value: string) {
  const trimmed = value.trim().replace(/\s/g, "");

  if (!trimmed) {
    return null;
  }

  let normalized = trimmed.replace(/[^\d,.-]/g, "");
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    normalized = normalized.replace(/,/g, "");
  } else if (hasComma) {
    const parts = normalized.split(",");
    const commaLooksDecimal =
      parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2;
    normalized = commaLooksDecimal ? `${parts[0]}.${parts[1]}` : normalized.replace(/,/g, "");
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatOriginalMetricValue(value: number | null, currency: string, unit?: "total" | "perShare") {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  const maximumFractionDigits = Math.abs(value) >= 100 ? 0 : 2;
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value);

  return `${formatted} ${currency}${unit === "perShare" ? "/share" : ""}`;
}

function originalMetricFromField(fieldValue: ValuationField<unknown> | undefined) {
  if (
    fieldValue?.source !== "Yahoo TTM + FX" ||
    typeof fieldValue.original?.value !== "number" ||
    !fieldValue.original.currency
  ) {
    return null;
  }

  return formatOriginalMetricValue(
    fieldValue.original.value,
    fieldValue.original.currency,
    fieldValue.original.unit,
  );
}

function originalMetricLabelForScenario(
  input: StockValuationInput,
  modelKey: ModelKey,
  scenario: DcfTenYearsScenario | EvEbitdaScenario | TerminalMultipleScenario,
) {
  if (modelKey === "dcf10Years") {
    return originalMetricFromField(input.sources?.freeCashFlow);
  }

  if (modelKey === "evEbitda") {
    return originalMetricFromField(input.sources?.ebitda);
  }

  if (modelKey === "pe") {
    const epsSource = input.sources?.eps;
    if (
      epsSource?.source !== "Yahoo TTM + FX" ||
      typeof epsSource.original?.value !== "number" ||
      !epsSource.original.currency
    ) {
      return null;
    }

    return formatOriginalMetricValue(epsSource.original.value, epsSource.original.currency);
  }

  const freeCashFlowSource = input.sources?.freeCashFlow;
  const terminalScenario = scenario as TerminalMultipleScenario;
  if (
    freeCashFlowSource?.source !== "Yahoo TTM + FX" ||
    !freeCashFlowSource.fx ||
    freeCashFlowSource.fx.rate <= 0 ||
    !freeCashFlowSource.original?.currency ||
    terminalScenario.baseMetricPerShare === null ||
    !Number.isFinite(terminalScenario.baseMetricPerShare)
  ) {
    return null;
  }

  return formatOriginalMetricValue(
    terminalScenario.baseMetricPerShare / freeCashFlowSource.fx.rate,
    freeCashFlowSource.original.currency,
    "perShare",
  );
}

function sourceLabel(source: string | undefined) {
  return source || "Manual";
}

function SourceBadge({ asOf, source }: { asOf?: string; source?: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
      {sourceLabel(source)}
      {asOf ? <span className="ml-1 text-slate-500">· {asOf}</span> : null}
    </span>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "bad";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold",
          tone === "good" && "text-emerald-300",
          tone === "bad" && "text-rose-300",
          tone === "neutral" && "text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ReadOnlyCalculationMetric({
  label,
  testId,
  value,
  highlight = false,
}: {
  label: string;
  testId?: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border border-white/10 bg-slate-950/50 p-3", highlight && "bg-emerald-300/8")}>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-2 text-base font-semibold text-white sm:text-lg",
          highlight && "text-emerald-200",
        )}
        data-testid={testId}
      >
        {value}
      </p>
    </div>
  );
}

function FcfPerShareTtmPanel({
  calculation,
  currency,
}: {
  calculation: FcfPerShareTtmCalculation;
  currency: string;
}) {
  return (
    <div
      className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-4"
      data-testid="fcf-per-share-ttm-calculator"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Calculator className="mt-0.5 size-5 text-emerald-200" />
          <div>
            <p className="font-semibold text-white">FCF per share TTM</p>
            <p className="mt-1 text-sm text-slate-400">FCF / Shares</p>
          </div>
        </div>
        <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
          read-only
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <ReadOnlyCalculationMetric
          label="Free Cash Flow TTM"
          testId="fcf-ttm-value"
          value={formatCurrency(calculation.freeCashFlow, currency)}
        />
        <ReadOnlyCalculationMetric
          label="Shares Outstanding"
          testId="shares-outstanding-value"
          value={formatPlainNumber(calculation.sharesOutstanding, 0)}
        />
        <ReadOnlyCalculationMetric
          label="FCF per share TTM"
          testId="fcf-per-share-ttm-value"
          value={formatCurrency(calculation.fcfPerShare, currency)}
          highlight
        />
      </div>
    </div>
  );
}

function formatMultiple(value: number | null) {
  return formatPlainNumber(value, 2);
}

const historicalMultipleLabels: Record<
  HistoricalMultipleKey,
  {
    benchmarkPath: string;
    denominator: string;
    label: string;
    numerator: string;
  }
> = {
  priceToFreeCashFlow: {
    benchmarkPath: "price-to-free-cash-flow",
    denominator: "FCF/share",
    label: "P/FCF",
    numerator: "Price",
  },
  peRatio: {
    benchmarkPath: "pe-ratio",
    denominator: "EPS",
    label: "P/E",
    numerator: "Price",
  },
  evToEbitda: {
    benchmarkPath: "ev-to-ebitda",
    denominator: "EBITDA",
    label: "EV/EBITDA",
    numerator: "Enterprise value",
  },
};

const historicalMultipleTabs: HistoricalMultipleKey[] = [
  "priceToFreeCashFlow",
  "peRatio",
  "evToEbitda",
];

function financeChartsBenchmarkUrl(ticker: string, key: HistoricalMultipleKey) {
  const clean = ticker.trim().toUpperCase();

  if (!clean) {
    return "https://www.financecharts.com";
  }

  return `https://www.financecharts.com/stocks/${encodeURIComponent(clean)}/value/${historicalMultipleLabels[key].benchmarkPath}`;
}

function formatChartValue(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numericValue) ? formatMultiple(numericValue) : "needs input";
}

function historicalMultipleBarOption(summary: HistoricalMultipleSummary): EChartsOption {
  const data = [
    { label: "Current", value: summary.currentMultiple },
    ...summary.periodAverages.map((period) => ({
      label: period.label,
      value: period.average,
    })),
  ];

  return {
    animation: false,
    grid: { bottom: 28, containLabel: true, left: 34, right: 16, top: 18 },
    tooltip: {
      appendTo: "body",
      backgroundColor: "#0f1729",
      borderColor: "rgba(255,255,255,0.1)",
      confine: true,
      formatter: (params) => {
        const entry = Array.isArray(params) ? params[0] : params;
        const name = String(entry?.name ?? "");
        const value = Array.isArray(entry?.value) ? entry.value[1] : entry?.value;

        return `<strong>${name}</strong><br/>Multiple: ${formatChartValue(value)}`;
      },
      textStyle: { color: "#f8fafc" },
      trigger: "item",
    },
    xAxis: {
      axisLabel: { color: "#94a3b8", fontSize: 11 },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.14)" } },
      axisTick: { show: false },
      data: data.map((row) => row.label),
      type: "category",
    },
    yAxis: {
      axisLabel: {
        color: "#94a3b8",
        formatter: (value: number) => formatMultiple(value),
      },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
      type: "value",
    },
    series: [
      {
        barMaxWidth: 34,
        data: data.map((row, index) => ({
          value: row.value,
          itemStyle: {
            borderRadius: [7, 7, 0, 0],
            color: index === 0 ? "#60a5fa" : "#38bdf8",
          },
        })),
        name: "Average multiple",
        type: "bar",
      },
    ],
  };
}

function historicalMultipleLineOption(summary: HistoricalMultipleSummary): EChartsOption {
  const rows = [...summary.seriesPoints]
    .filter((row) => row.date && row.multiple !== null)
    .sort((first, second) => first.date.localeCompare(second.date));
  const rowByDate = new Map(rows.map((row) => [row.date, row]));

  return {
    animation: false,
    grid: { bottom: 30, containLabel: true, left: 34, right: 18, top: 18 },
    tooltip: {
      appendTo: "body",
      backgroundColor: "#0f1729",
      borderColor: "rgba(255,255,255,0.1)",
      confine: true,
      formatter: (params) => {
        const entry = Array.isArray(params) ? params[0] : params;
        const date = String(entry?.name ?? "");
        const row = rowByDate.get(date);

        if (!row) {
          return "";
        }

        return [
          `<strong>${date}</strong>`,
          `Multiple: ${formatMultiple(row.multiple)}`,
          `${historicalMultipleLabels[summary.key].numerator}: ${formatPlainNumber(row.numerator, 2)}`,
          `${historicalMultipleLabels[summary.key].denominator}: ${formatPlainNumber(row.denominator, 2)}`,
          `Source: ${sourceLabel(row.source)}`,
          row.asOf ? `Fundamentals as of: ${row.asOf}` : null,
          row.needsReview && row.reviewReason ? `Review: ${row.reviewReason}` : null,
        ]
          .filter(Boolean)
          .join("<br/>");
      },
      textStyle: { color: "#f8fafc" },
      trigger: "axis",
    },
    xAxis: {
      axisLabel: { color: "#94a3b8", fontSize: 11, hideOverlap: true },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.14)" } },
      axisTick: { show: false },
      data: rows.map((row) => row.date),
      type: "category",
    },
    yAxis: {
      axisLabel: {
        color: "#94a3b8",
        formatter: (value: number) => formatMultiple(value),
      },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
      type: "value",
    },
    series: [
      {
        areaStyle: { color: "rgba(56,189,248,0.12)" },
        data: rows.map((row) => row.multiple),
        lineStyle: { color: "#5eead4", width: 2 },
        name: historicalMultipleLabels[summary.key].label,
        showSymbol: rows.length <= 24,
        smooth: false,
        symbolSize: 6,
        type: "line",
      },
    ],
  };
}

function HistoricalMultiplesModal({
  isOpen,
  onApply,
  onClose,
  onSelectKey,
  selectedKey,
  summaries,
  ticker,
}: {
  isOpen: boolean;
  onApply: (key: HistoricalMultipleKey) => void;
  onClose: () => void;
  onSelectKey: (key: HistoricalMultipleKey) => void;
  selectedKey: HistoricalMultipleKey;
  summaries: Record<HistoricalMultipleKey, HistoricalMultipleSummary>;
  ticker: string;
}) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const summary = summaries[selectedKey];
  const labels = historicalMultipleLabels[selectedKey];
  const visibleRows = summary.rows.slice(0, 8);
  const hasChartData = summary.seriesPoints.some((row) => row.multiple !== null);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/78 p-0 backdrop-blur-md sm:items-center sm:p-5">
      <button
        aria-label="Close historical charts backdrop"
        className="absolute inset-0 cursor-default"
        type="button"
        onClick={onClose}
      />
      <div
        aria-label="Historical charts"
        aria-modal="true"
        className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden border border-white/10 bg-slate-950 shadow-[0_30px_140px_rgba(0,0,0,0.55)] sm:max-h-[88vh] sm:rounded-3xl"
        role="dialog"
      >
        <div className="flex flex-col gap-4 border-b border-white/10 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Calculator className="mt-1 size-5 text-violet-200" />
            <div>
              <h3 className="text-lg font-semibold text-white">Historical charts</h3>
              <p className="mt-1 text-sm text-slate-400">
                Derived from SEC/Yahoo. Compare with FinanceCharts if needed.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs font-semibold text-violet-100">
              {labels.label} avg {formatMultiple(summary.average)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
              Current {formatMultiple(summary.currentMultiple)}
            </span>
            <button
              aria-label="Close historical charts"
              className="inline-flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              type="button"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div
            aria-label="Historical multiple metric"
            className="flex flex-wrap gap-2"
            role="tablist"
          >
            {historicalMultipleTabs.map((key) => (
              <button
                key={key}
                aria-selected={selectedKey === key}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                  selectedKey === key
                    ? "border-blue-300/30 bg-blue-500/20 text-blue-100"
                    : "border-white/10 bg-slate-950/45 text-slate-400 hover:text-white",
                )}
                role="tab"
                type="button"
                onClick={() => onSelectKey(key)}
              >
                {historicalMultipleLabels[key].label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <ReadOnlyCalculationMetric
              label="Current"
              value={formatMultiple(summary.currentMultiple)}
            />
            <ReadOnlyCalculationMetric
              label="Low"
              testId={`historical-multiple-low-${summary.key}`}
              value={formatMultiple(summary.low)}
            />
            <ReadOnlyCalculationMetric
              label="Average"
              testId={`historical-multiple-average-${summary.key}`}
              value={formatMultiple(summary.average)}
              highlight
            />
            <ReadOnlyCalculationMetric
              label="High"
              testId={`historical-multiple-high-${summary.key}`}
              value={formatMultiple(summary.high)}
            />
          </div>

          {hasChartData ? (
            <div className="mt-4 grid gap-4">
              <div
                className="rounded-2xl border border-white/10 bg-slate-950/45 p-3"
                data-testid={`historical-multiple-line-chart-${summary.key}`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">
                    {ticker.toUpperCase()} {labels.label} Ratio Chart
                  </p>
                  <p className="text-xs font-medium text-slate-500">monthly 10Y series</p>
                </div>
                <BaseChart height={390} option={historicalMultipleLineOption(summary)} />
              </div>
              <div
                className="rounded-2xl border border-white/10 bg-slate-950/45 p-3"
                data-testid={`historical-multiple-bar-chart-${summary.key}`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">Period averages</p>
                  <p className="text-xs font-medium text-slate-500">
                    Current / TTM / 3Y / 5Y / 10Y / 15Y / 20Y
                  </p>
                </div>
                <BaseChart height={230} option={historicalMultipleBarOption(summary)} />
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-slate-950/45 p-4 text-sm text-slate-400">
              Няма historical chart series за тази метрика. Попълни multiple assumptions ръчно.
            </div>
          )}

          <div className="mt-4 grid gap-3">
            {visibleRows.map((row, index) => (
              <div
                key={`${row.year ?? "unknown"}-${index}`}
                className="grid gap-3 rounded-xl border border-white/10 bg-slate-950/45 p-3 lg:grid-cols-[minmax(80px,0.65fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(100px,0.7fr)_minmax(135px,0.9fr)] lg:items-center"
                data-testid={`historical-multiple-row-${summary.key}-${index}`}
              >
                <div>
                  <p className="text-sm font-semibold text-white">{row.year ?? "Year"}</p>
                  <p className="mt-1 text-xs text-slate-500">{row.asOf ?? "manual"}</p>
                </div>
                <ReadOnlyCalculationMetric
                  label={labels.numerator}
                  value={formatPlainNumber(row.numerator, 2)}
                />
                <ReadOnlyCalculationMetric
                  label={labels.denominator}
                  value={formatPlainNumber(row.denominator, 2)}
                />
                <ReadOnlyCalculationMetric
                  label={labels.label}
                  value={formatMultiple(row.multiple)}
                  highlight={row.usableForApply}
                />
                <div
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-semibold",
                    row.usableForApply
                      ? "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200"
                      : row.ignoredReason === "needs-review"
                        ? "border-sky-300/15 bg-sky-300/[0.06] text-sky-100"
                        : "border-amber-300/15 bg-amber-300/[0.06] text-amber-100",
                  )}
                >
                  <span className="block">
                    {row.usableForApply
                      ? "used for Apply"
                      : row.ignoredReason === "needs-review"
                        ? "needs review"
                        : "ignored for Apply"}
                  </span>
                  {row.reviewReason ? (
                    <span className="mt-1 block text-xs font-medium opacity-80">
                      {row.reviewReason}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 p-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm leading-6 text-slate-400">
            <p>Apply maps High to Best, Average to Average, and Low to Worst.</p>
            <a
              className="mt-1 inline-flex font-semibold text-sky-200 transition hover:text-sky-100"
              href={financeChartsBenchmarkUrl(ticker, selectedKey)}
              rel="noreferrer"
              target="_blank"
            >
              FinanceCharts benchmark
            </a>
          </div>
          <button
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={!summary.canApply}
            onClick={() => onApply(selectedKey)}
          >
            Apply {labels.label} to scenarios
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoricalFcfPanel({
  calculation,
  currency,
  isOpen,
  onApplyAverage,
  onChangeRow,
  onToggle,
}: {
  calculation: HistoricalFreeCashFlowAverageCalculation;
  currency: string;
  isOpen: boolean;
  onApplyAverage: () => void;
  onChangeRow: (
    slot: number,
    key: "year" | "freeCashFlow",
    value: number | null,
  ) => void;
  onToggle: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035]">
      <button
        aria-controls="historical-fcf-calculator"
        aria-expanded={isOpen}
        className="flex w-full flex-col gap-3 p-4 text-left transition hover:bg-white/[0.03] lg:flex-row lg:items-center lg:justify-between"
        type="button"
        onClick={onToggle}
      >
        <span className="flex items-start gap-3">
          <Calculator className="mt-0.5 size-5 text-cyan-200" />
          <span>
            <span className="block font-semibold text-white">10 Years Free Cash Flow</span>
            <span className="mt-1 block text-sm text-slate-400">
              Year 10 до Year 0, editable FCF history и average за DCF.
            </span>
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-3">
          {calculation.isPartialHistory ? (
            <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
              {calculation.missingRows} missing
            </span>
          ) : null}
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
            Avg {formatCurrency(calculation.averageFreeCashFlow, currency)}
          </span>
          <ChevronDown
            className={cn("size-5 text-slate-400 transition", isOpen && "rotate-180")}
          />
        </span>
      </button>

      {isOpen ? (
        <div id="historical-fcf-calculator" className="border-t border-white/10 p-4">
          <div className="grid gap-3">
            {calculation.rows.map((row) => (
              <div
                key={row.slot}
                className="grid gap-3 rounded-xl border border-white/10 bg-slate-950/45 p-3 lg:grid-cols-[minmax(96px,0.8fr)_minmax(120px,0.8fr)_minmax(190px,1.2fr)_minmax(140px,0.9fr)_minmax(140px,0.9fr)] lg:items-end"
                data-testid={`historical-fcf-row-${row.slot}`}
              >
                <div>
                  <p className="text-sm font-semibold text-white">{row.label}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.source ? sourceLabel(row.source) : "Manual"}
                  </p>
                </div>
                <label className="grid gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Fiscal year
                  </span>
                  <input
                    aria-label={`Historical year ${row.label}`}
                    className="h-10 rounded-lg border border-white/10 bg-slate-950/70 px-2 text-sm font-semibold text-white outline-none transition focus:border-amber-300/50"
                    inputMode="numeric"
                    type="number"
                    value={numberInputValue(row.year)}
                    onChange={(event) =>
                      onChangeRow(row.slot, "year", parseNumberInput(event.target.value))
                    }
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Free Cash Flow
                  </span>
                  <input
                    aria-label={`Historical FCF ${row.label}`}
                    className="h-10 rounded-lg border border-white/10 bg-slate-950/70 px-2 text-sm font-semibold text-white outline-none transition focus:border-amber-300/50"
                    inputMode="decimal"
                    type="number"
                    value={numberInputValue(row.freeCashFlow)}
                    onChange={(event) =>
                      onChangeRow(row.slot, "freeCashFlow", parseNumberInput(event.target.value))
                    }
                  />
                </label>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    YoY change
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-200">
                    {row.growthLabel ?? "needs input"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Percent
                  </p>
                  <p className="mt-1 text-sm font-semibold text-cyan-100">
                    {formatPercent(row.growthPercent, 2)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4 md:grid-cols-[1fr_1fr_auto] md:items-center">
            <ReadOnlyCalculationMetric
              label="Average FCF"
              testId="historical-fcf-average"
              value={formatCurrency(calculation.averageFreeCashFlow, currency)}
              highlight
            />
            <ReadOnlyCalculationMetric
              label="Average %"
              testId="historical-fcf-average-percent"
              value={formatPercent(calculation.averageGrowthPercent, 2)}
            />
            <button
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={calculation.averageFreeCashFlow === null}
              onClick={onApplyAverage}
            >
              Apply average to DCF scenarios
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NumericField({
  label,
  value,
  onChange,
  step = "any",
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  step?: string;
}) {
  return (
    <label className="grid gap-2 text-sm text-slate-400">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <input
        className="min-h-12 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-base text-white outline-none transition focus:border-amber-300/50"
        inputMode="decimal"
        step={step}
        type="number"
        value={numberInputValue(value)}
        onChange={(event) => onChange(parseNumberInput(event.target.value))}
      />
    </label>
  );
}

function CompactWeightField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2">
      <span className="truncate text-sm font-semibold text-slate-300">{label}</span>
      <span className="flex items-center gap-1">
        <input
          aria-label={`${label} final weight`}
          className="h-8 w-16 rounded-lg border border-white/10 bg-slate-950 px-2 text-right text-sm font-semibold text-amber-100 outline-none transition focus:border-amber-300/50"
          inputMode="decimal"
          type="number"
          value={numberInputValue(value * 100)}
          onChange={(event) => {
            const next = parseNumberInput(event.target.value);
            onChange(next === null ? null : next / 100);
          }}
        />
        <span className="text-xs font-semibold text-slate-500">%</span>
      </span>
    </label>
  );
}

function CompactNumberField({
  label,
  value,
  onChange,
  percent = false,
  originalLabel,
  suffix,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  percent?: boolean;
  originalLabel?: string | null;
  suffix?: string | null;
}) {
  const displayValue = percent && value !== null ? value * 100 : value;
  const inputValue = percent ? numberInputValue(displayValue) : formattedNumberInputValue(displayValue);

  return (
    <label className="min-w-0">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {label}
        </span>
        {originalLabel ? (
          <span className="truncate text-[10px] font-semibold normal-case tracking-normal text-cyan-200/70">
            {originalLabel}
          </span>
        ) : null}
      </span>
      <span className="mt-1 flex h-9 items-center rounded-lg border border-white/10 bg-slate-950/70 px-2 transition focus-within:border-amber-300/50">
        <input
          aria-label={label}
          className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none"
          inputMode="decimal"
          type={percent ? "number" : "text"}
          value={inputValue}
          onChange={(event) => {
            const next = parseNumberInput(event.target.value);
            onChange(percent && next !== null ? next / 100 : next);
          }}
        />
        {percent ? <span className="pl-1 text-xs font-semibold text-slate-500">%</span> : null}
        {!percent && suffix ? (
          <span className="pl-1 text-[10px] font-semibold uppercase text-slate-500">{suffix}</span>
        ) : null}
      </span>
    </label>
  );
}

function updateSource(
  sources: StockValuationInput["sources"],
  key: string,
  value: number | string | null,
) {
  return {
    ...(sources ?? {}),
    [key]: {
      value,
      source: "Manual" as const,
    },
  };
}

function applyAutofillSources(fields: StockValuationAutofillFields) {
  return fields as StockValuationInput["sources"];
}

export function StockValuationPanel() {
  const [input, setInput] = useState<StockValuationInput>(() =>
    buildDefaultStockValuationInput(),
  );
  const [activeModel, setActiveModel] = useState<ModelKey>("dcf10Years");
  const [savedAnalyses, setSavedAnalyses] = useState<SavedStockValuationAnalysis[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSourceBadgesOpen, setIsSourceBadgesOpen] = useState(false);
  const [isHistoricalFcfOpen, setIsHistoricalFcfOpen] = useState(false);
  const [isHistoricalMultiplesModalOpen, setIsHistoricalMultiplesModalOpen] =
    useState(false);
  const [activeHistoricalMultipleKey, setActiveHistoricalMultipleKey] =
    useState<HistoricalMultipleKey>("priceToFreeCashFlow");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const result = useMemo(() => calculateStockValuation(input), [input]);
  const fcfPerShareTtm = useMemo(() => calculateFcfPerShareTtm(input), [input]);
  const historicalFcfCalculation = useMemo(
    () => calculateHistoricalFcfAverage(input),
    [input],
  );
  const historicalMultipleSummaries = useMemo(
    () => ({
      priceToFreeCashFlow: calculateHistoricalMultipleSummary(input, "priceToFreeCashFlow"),
      peRatio: calculateHistoricalMultipleSummary(input, "peRatio"),
      evToEbitda: calculateHistoricalMultipleSummary(input, "evToEbitda"),
    }),
    [input],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSavedAnalyses() {
      try {
        const response = await fetch("/api/valuation/saved");
        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as {
          ok: boolean;
          analyses?: SavedStockValuationAnalysis[];
        };

        if (!cancelled && body.ok) {
          setSavedAnalyses(body.analyses ?? []);
        }
      } catch {
        if (!cancelled) {
          setSavedAnalyses([]);
        }
      }
    }

    loadSavedAnalyses();

    return () => {
      cancelled = true;
    };
  }, []);

  function setTopLevelNumber(key: "currentPrice" | "sharesOutstanding", value: number | null) {
    setInput((current) => ({
      ...current,
      [key]: value,
      sources: updateSource(current.sources, key, value),
    }));
  }

  function updateFinalWeight(key: ModelKey, value: number | null) {
    setInput((current) => ({
      ...current,
      finalWeights: {
        ...current.finalWeights,
        [key]: value ?? 0,
      },
    }));
  }

  function updateScenario(
    modelKey: ModelKey,
    scenarioId: string,
    key: string,
    value: number | null,
  ) {
    setInput((current) => {
      const next = cloneStockValuationInput(current);
      const model = next.models[modelKey];
      model.scenarios = model.scenarios.map((scenario) =>
        scenario.id === scenarioId ? { ...scenario, [key]: value } : scenario,
      ) as never;

      return next;
    });
  }

  function updateHistoricalFcfRow(
    slot: number,
    key: "year" | "freeCashFlow",
    value: number | null,
  ) {
    setInput((current) => {
      const rows = calculateHistoricalFcfAverage(current).rows.map((row) => ({
        year: row.year,
        freeCashFlow: row.freeCashFlow,
        source: row.source,
        asOf: row.asOf,
      }));
      rows[slot] = {
        ...rows[slot],
        [key]: value,
        source: "Manual",
        asOf: undefined,
      };

      return {
        ...current,
        historicalFreeCashFlows: rows,
      };
    });
  }

  function applyHistoricalAverageToDcfScenarios() {
    setInput((current) => {
      const averageFreeCashFlow =
        calculateHistoricalFcfAverage(current).averageFreeCashFlow;
      if (averageFreeCashFlow === null) {
        return current;
      }

      const next = cloneStockValuationInput(current);
      next.models.dcf10Years.scenarios = next.models.dcf10Years.scenarios.map(
        (scenario) => ({
          ...scenario,
          baseFreeCashFlow: averageFreeCashFlow,
        }),
      );

      return next;
    });
  }

  function applyHistoricalMultipleToScenarios(
    modelKey: "evEbitda" | "pe" | "dcfMultiple",
    summaryKey: HistoricalMultipleKey,
  ) {
    setInput((current) => {
      const applyValues = calculateHistoricalMultipleSummary(
        current,
        summaryKey,
      ).applyValues;
      if (!applyValues) {
        return current;
      }

      const next = cloneStockValuationInput(current);
      if (modelKey === "evEbitda") {
        next.models.evEbitda.scenarios = next.models.evEbitda.scenarios.map(
          (scenario) => ({
            ...scenario,
            terminalMultiple: applyValues[scenario.id],
          }),
        );
        return next;
      }

      next.models[modelKey].scenarios = next.models[modelKey].scenarios.map(
        (scenario) => ({
          ...scenario,
          terminalMultiple: applyValues[scenario.id],
        }),
      );

      return next;
    });
  }

  function applyHistoricalMultipleByKey(key: HistoricalMultipleKey) {
    if (key === "priceToFreeCashFlow") {
      applyHistoricalMultipleToScenarios("dcfMultiple", key);
    } else if (key === "peRatio") {
      applyHistoricalMultipleToScenarios("pe", key);
    } else {
      applyHistoricalMultipleToScenarios("evEbitda", key);
    }
  }

  async function handleAutofill() {
    setIsAutofilling(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch(
        `/api/valuation/autofill?ticker=${encodeURIComponent(input.ticker)}`,
      );
      const body = (await response.json()) as {
        ok: boolean;
        input?: StockValuationInput;
        fields?: StockValuationAutofillFields;
        warnings?: string[];
        error?: string;
      };

      if (!response.ok || !body.ok || !body.input) {
        throw new Error(body.error || "Autofill failed.");
      }

      setInput({
        ...body.input,
        sources: applyAutofillSources(body.fields ?? {}),
      });
      setSelectedAnalysisId(null);
      setStatusMessage(
        body.warnings?.length
          ? `Данните са попълнени. ${body.warnings.join(" ")}`
          : "Данните са попълнени. Всички полета остават editable.",
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Autofill failed.");
    } finally {
      setIsAutofilling(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const method = selectedAnalysisId ? "PUT" : "POST";
      const endpoint = selectedAnalysisId
        ? `/api/valuation/saved/${selectedAnalysisId}`
        : "/api/valuation/saved";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: input.ticker,
          companyName: input.companyName,
          title: input.title || `${input.ticker || "Stock"} valuation`,
          latestFairValue: result.weightedFairValue,
          currentPrice: input.currentPrice,
          payload: input,
        }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        analysis?: SavedStockValuationAnalysis;
        error?: string;
      };

      if (!response.ok || !body.ok || !body.analysis) {
        throw new Error(body.error || "Save failed.");
      }

      setSelectedAnalysisId(body.analysis.id);
      setSavedAnalyses((current) => {
        const rest = current.filter((analysis) => analysis.id !== body.analysis!.id);

        return [body.analysis!, ...rest];
      });
      setStatusMessage("Запазено");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/valuation/saved/${id}`, { method: "DELETE" });

      if (!response.ok) {
        throw new Error("Delete failed.");
      }

      setSavedAnalyses((current) => current.filter((analysis) => analysis.id !== id));
      if (selectedAnalysisId === id) {
        setSelectedAnalysisId(null);
      }
      setStatusMessage("Изтрито");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  function openSavedAnalysis(analysis: SavedStockValuationAnalysis) {
    setInput(analysis.payload);
    setSelectedAnalysisId(analysis.id);
    setStatusMessage(null);
    setErrorMessage(null);
  }

  const activeResult = result.models[activeModel];
  const activeScenarios = input.models[activeModel].scenarios;
  const sourceEntries = Object.entries(input.sources ?? {});
  const signalTone =
    result.signal === "BUY" ? "good" : result.signal === "SELL" ? "bad" : "neutral";

  return (
    <div className="grid gap-5" data-layout="valuation-workspace-wide">
      <section className="min-w-0 rounded-[26px] border border-white/10 bg-slate-950/40 shadow-[0_30px_100px_rgba(0,0,0,0.28)]">
        <div className="border-b border-white/10 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
                <BadgeDollarSign className="size-4" />
                US stocks
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-white">Справедлива цена</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Автоматично попълване от публични източници, editable assumptions и weighted
                fair value по четири модела.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[160px_minmax(180px,1fr)_auto] lg:min-w-[620px] xl:min-w-[720px]">
              <label className="grid gap-2 text-sm text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Ticker
                </span>
                <input
                  aria-label="Ticker"
                  className="min-h-12 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-base font-semibold uppercase text-white outline-none transition focus:border-amber-300/50"
                  value={input.ticker}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      ticker: event.target.value.toUpperCase(),
                    }))
                  }
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Company
                </span>
                <input
                  className="min-h-12 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-base text-white outline-none transition focus:border-amber-300/50"
                  value={input.companyName}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      companyName: event.target.value,
                      sources: updateSource(current.sources, "companyName", event.target.value),
                    }))
                  }
                />
              </label>
              <button
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/14 px-4 text-sm font-semibold text-amber-50 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                disabled={isAutofilling || !input.ticker.trim()}
                onClick={handleAutofill}
              >
                {isAutofilling ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                Авто попълване
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Current price" value={formatCurrency(input.currentPrice, input.currency)} />
          <MetricCard
            label="Weighted fair value"
            value={formatCurrency(result.weightedFairValue, input.currency)}
            tone={signalTone}
          />
          <MetricCard
            label="Upside / downside"
            value={formatPercent(result.upsideDownsidePercent)}
            tone={signalTone}
          />
          <MetricCard label="Signal" value={result.signal} tone={signalTone} />
        </div>

        <div className="grid gap-4 border-y border-white/10 p-5 xl:grid-cols-[minmax(320px,0.55fr)_minmax(720px,1fr)]">
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2">
            <div className="grid gap-3">
              <NumericField
                label="Current price"
                value={input.currentPrice}
                onChange={(value) => setTopLevelNumber("currentPrice", value)}
              />
              <SourceBadge source={input.sources?.currentPrice?.source} />
            </div>
            <div className="grid gap-3">
              <NumericField
                label="Shares outstanding"
                value={input.sharesOutstanding}
                onChange={(value) => setTopLevelNumber("sharesOutstanding", value)}
              />
              <SourceBadge source={input.sources?.sharesOutstanding?.source} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Final weights
              </p>
              <p className="text-xs font-semibold text-slate-400">
                Total {formatPercent(result.finalWeightTotal, 0)}
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[repeat(4,minmax(180px,1fr))]">
              {modelTabs.map((tab) => (
                <CompactWeightField
                  key={tab.key}
                  label={tab.label}
                  value={input.finalWeights[tab.key]}
                  onChange={(value) => updateFinalWeight(tab.key, value)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {modelTabs.map((tab) => {
              const modelFairValue = formatCurrency(
                result.models[tab.key].weightedFairValue,
                input.currency,
              );
              const modelButtonLabel = `${tab.label} · ${modelFairValue}`;

              return (
                <button
                  key={tab.key}
                  aria-label={modelButtonLabel}
                  aria-pressed={activeModel === tab.key}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-sm font-semibold transition",
                    activeModel === tab.key
                      ? "border-blue-400/40 bg-blue-500 text-white"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]",
                  )}
                  type="button"
                  onClick={() => {
                    const nextHistoricalKey = historicalMultipleKeyForModel(tab.key);
                    setActiveModel(tab.key);
                    if (nextHistoricalKey) {
                      setActiveHistoricalMultipleKey(nextHistoricalKey);
                    }
                  }}
                >
                  <span aria-hidden="true">{tab.label}</span>
                  <span aria-hidden="true" className="text-slate-300">
                    {" "}
                    · {modelFairValue}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {modelTabs.find((tab) => tab.key === activeModel)?.label}
                </h3>
                <p className="text-sm text-slate-400">
                  Model result: {formatCurrency(activeResult.weightedFairValue, input.currency)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {activeModel !== "dcf10Years" ? (
                  <button
                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-violet-300/20 bg-violet-300/10 px-3 text-xs font-semibold text-violet-100 transition hover:bg-violet-300/15"
                    type="button"
                    onClick={() => {
                      const historicalKey = historicalMultipleKeyForModel(activeModel);
                      if (historicalKey) {
                        setActiveHistoricalMultipleKey(historicalKey);
                      }
                      setIsHistoricalMultiplesModalOpen(true);
                    }}
                  >
                    <Calculator className="size-4" />
                    Historical charts
                  </button>
                ) : null}
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Scenario weight total {formatPercent(activeResult.scenarioWeightTotal, 0)}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {activeScenarios.map((scenario, index) => {
                const originalMetricLabel = originalMetricLabelForScenario(
                  input,
                  activeModel,
                  scenario,
                );

                return (
                  <ScenarioEditor
                    key={scenario.id}
                    modelKey={activeModel}
                    scenario={scenario}
                    fairValue={activeResult.scenarios[index]?.fairValue ?? null}
                    currency={input.currency}
                    originalMetricLabel={originalMetricLabel}
                    onChange={(key, value) =>
                      updateScenario(activeModel, scenario.id, key, value)
                    }
                  />
                );
              })}
            </div>

            {activeModel === "dcf10Years" ? (
              <HistoricalFcfPanel
                calculation={historicalFcfCalculation}
                currency={input.currency}
                isOpen={isHistoricalFcfOpen}
                onApplyAverage={applyHistoricalAverageToDcfScenarios}
                onChangeRow={updateHistoricalFcfRow}
                onToggle={() => setIsHistoricalFcfOpen((current) => !current)}
              />
            ) : null}

            {activeModel === "dcfMultiple" ? (
              <FcfPerShareTtmPanel calculation={fcfPerShareTtm} currency={input.currency} />
            ) : null}

          </div>

          <HistoricalMultiplesModal
            isOpen={isHistoricalMultiplesModalOpen}
            selectedKey={activeHistoricalMultipleKey}
            summaries={historicalMultipleSummaries}
            ticker={input.ticker}
            onApply={applyHistoricalMultipleByKey}
            onClose={() => setIsHistoricalMultiplesModalOpen(false)}
            onSelectKey={setActiveHistoricalMultipleKey}
          />

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03]">
            <button
              aria-controls="valuation-source-badges"
              aria-expanded={isSourceBadgesOpen}
              className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-white/[0.03]"
              type="button"
              onClick={() => setIsSourceBadgesOpen((current) => !current)}
            >
              <span className="flex items-center gap-3">
                <Database className="size-5 text-slate-400" />
                <span>
                  <span className="block font-semibold text-white">Source badges</span>
                  <span className="mt-1 block text-sm text-slate-500">
                    {sourceEntries.length} sources
                  </span>
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "size-5 text-slate-400 transition",
                  isSourceBadgesOpen && "rotate-180",
                )}
              />
            </button>

            {isSourceBadgesOpen ? (
              <div
                className="grid gap-3 border-t border-white/10 p-4 md:grid-cols-2"
                id="valuation-source-badges"
              >
                <p className="text-sm leading-6 text-slate-400">
                  SEC и Alpha Vantage са primary; Yahoo се използва само за current price;
                  Macrotrends е best-effort fallback. Празните полета остават editable.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {sourceEntries.length === 0 ? (
                    <SourceBadge source="Manual" />
                  ) : (
                    sourceEntries.map(([key, value]) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-300"
                      >
                        <span className="font-semibold text-slate-500">{key}</span>
                        <SourceBadge
                          asOf={typeof value?.asOf === "string" ? value.asOf : undefined}
                          source={String(value?.source ?? "Manual")}
                        />
                      </span>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-6 text-sm">
            {statusMessage ? (
              <span className="inline-flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="size-4" />
                {statusMessage}
              </span>
            ) : null}
            {errorMessage ? <span className="text-rose-300">{errorMessage}</span> : null}
          </div>

          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={isSaving || !input.ticker.trim()}
            onClick={handleSave}
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save analysis
          </button>
        </div>
      </section>

      <aside className="min-w-0 rounded-[26px] border border-white/10 bg-slate-950/40 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.22)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Запазени анализи</h2>
            <p className="mt-1 text-sm text-slate-400">Отвори, редактирай и презапиши.</p>
          </div>
          <button
            className="rounded-xl border border-white/10 p-2 text-slate-300 transition hover:bg-white/[0.06]"
            type="button"
            onClick={() => {
              setInput(buildDefaultStockValuationInput());
              setSelectedAnalysisId(null);
            }}
          >
            New
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {savedAnalyses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
              Няма запазени анализи или текущата сесия е demo. Изчисленията работят, но save
              изисква реален login.
            </div>
          ) : (
            savedAnalyses.map((analysis) => (
              <div
                key={analysis.id}
                className={cn(
                  "rounded-2xl border p-3 transition",
                  selectedAnalysisId === analysis.id
                    ? "border-blue-400/40 bg-blue-500/10"
                    : "border-white/10 bg-white/[0.03]",
                )}
              >
                <button
                  className="block w-full text-left"
                  type="button"
                  onClick={() => openSavedAnalysis(analysis)}
                >
                  <p className="font-semibold text-white">{analysis.title}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {analysis.ticker} · {formatCurrency(analysis.latestFairValue, analysis.payload.currency)}
                  </p>
                </button>
                <button
                  className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06]"
                  type="button"
                  onClick={() => handleDelete(analysis.id)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function ScenarioEditor({
  modelKey,
  scenario,
  fairValue,
  currency,
  originalMetricLabel,
  onChange,
}: {
  modelKey: ModelKey;
  scenario: DcfTenYearsScenario | EvEbitdaScenario | TerminalMultipleScenario;
  fairValue: number | null;
  currency: string;
  originalMetricLabel?: string | null;
  onChange: (key: string, value: number | null) => void;
}) {
  const isDcf = modelKey === "dcf10Years";
  const isEvEbitda = modelKey === "evEbitda";
  const dcfScenario = scenario as DcfTenYearsScenario;
  const evScenario = scenario as EvEbitdaScenario;
  const terminalScenario = scenario as TerminalMultipleScenario;
  const weightedValue =
    fairValue === null || !Number.isFinite(fairValue) ? null : fairValue * scenario.weight;
  const primaryMetricLabel = isDcf
    ? "FCF"
    : isEvEbitda
      ? "EBITDA"
      : modelKey === "pe"
        ? "EPS"
        : "FCF/share";
  const primaryMetricValue = isDcf
    ? dcfScenario.baseFreeCashFlow
    : isEvEbitda
      ? evScenario.baseEbitda
      : terminalScenario.baseMetricPerShare;
  const multipleLabel =
    modelKey === "pe" ? "P/E" : modelKey === "evEbitda" ? "EV/EBITDA" : "P/FCF";
  const multipleValue = isDcf
    ? dcfScenario.perpetualGrowth
    : (scenario as EvEbitdaScenario | TerminalMultipleScenario).terminalMultiple;

  return (
    <div
      className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(150px,1.2fr)_minmax(84px,0.55fr)_minmax(130px,1fr)_minmax(120px,0.9fr)_minmax(104px,0.78fr)_minmax(120px,0.86fr)_minmax(120px,0.86fr)_minmax(96px,0.68fr)_minmax(150px,1.05fr)] xl:items-end 2xl:grid-cols-[minmax(170px,1.3fr)_minmax(92px,0.55fr)_minmax(160px,1.05fr)_minmax(140px,0.9fr)_minmax(120px,0.78fr)_minmax(140px,0.86fr)_minmax(140px,0.86fr)_minmax(110px,0.68fr)_minmax(170px,1.05fr)]"
      data-layout="valuation-scenario-wide-row"
      data-testid="valuation-scenario-row"
    >
      <div className="min-w-0 self-center">
        <p className="truncate text-sm font-semibold text-white">{scenario.label}</p>
        <p className="mt-1 text-xs text-slate-500">scenario row</p>
      </div>

      <CompactNumberField
        label="Weight"
        percent
        value={scenario.weight}
        onChange={(value) => onChange("weight", value)}
      />

      <CompactNumberField
        label={primaryMetricLabel}
        originalLabel={originalMetricLabel}
        suffix={originalMetricLabel ? currency : null}
        value={primaryMetricValue}
        onChange={(value) => {
          if (isDcf) {
            onChange("baseFreeCashFlow", value);
            return;
          }

          if (isEvEbitda) {
            onChange("baseEbitda", value);
            return;
          }

          onChange("baseMetricPerShare", value);
        }}
      />

      <CompactNumberField
        label={isDcf ? "Perpetual" : multipleLabel}
        percent={isDcf}
        value={multipleValue}
        onChange={(value) => onChange(isDcf ? "perpetualGrowth" : "terminalMultiple", value)}
      />

      <CompactNumberField
        label="Discount"
        percent
        value={scenario.discountRate}
        onChange={(value) => onChange("discountRate", value)}
      />

      <CompactNumberField
        label="Growth 1-5"
        percent
        value={scenario.growthNextFiveYears}
        onChange={(value) => onChange("growthNextFiveYears", value)}
      />

      <CompactNumberField
        label="Growth 6-10"
        percent
        value={scenario.growthYearsFiveToTen}
        onChange={(value) => onChange("growthYearsFiveToTen", value)}
      />

      <CompactNumberField
        label="Safety"
        percent
        value={scenario.marginOfSafety}
        onChange={(value) => onChange("marginOfSafety", value)}
      />

      <div className="self-center rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] px-3 py-2 text-right">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200/70">
          Fair value
        </p>
        <p className="mt-1 text-sm font-semibold text-emerald-200">
          {formatCurrency(fairValue, currency)}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-slate-500">
          {formatCurrency(weightedValue, currency)} weighted
        </p>
      </div>
    </div>
  );
}
