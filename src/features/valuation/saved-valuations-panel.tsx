"use client";

import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { calculateStockValuation, type ModelValuationResult } from "@/lib/stock-valuation";
import type { SavedStockValuationAnalysis } from "@/lib/stock-valuation-repository";
import type { ValuationQuoteSnapshot } from "@/lib/stock-valuation-quotes";
import { cn } from "@/lib/utils";

type SavedValuationView = {
  analysis: SavedStockValuationAnalysis;
  currency: string;
  currentPrice: number | null;
  fairValue: number | null;
  valueGap: ValueGapView;
  tone: "buy" | "wait" | "neutral";
  modelValues: Array<{ label: string; value: number | null; weight: number; isUsed: boolean }>;
};

type ValueGapView = {
  label: "Подценен" | "Надценен" | "Справедлив" | "needs input";
  display: string;
  tone: "undervalued" | "overvalued" | "fair" | "unknown";
};

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

function finiteOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function modelValue(model: ModelValuationResult | undefined) {
  return finiteOrNull(model?.weightedFairValue);
}

function modelWeight(weight: number | null | undefined) {
  return finiteOrNull(weight) ?? 0;
}

function formatModelWeight(weight: number) {
  const roundedPercent = Math.round(weight * 1000) / 10;
  const normalizedPercent = Object.is(roundedPercent, -0) ? 0 : roundedPercent;
  const display = Number.isInteger(normalizedPercent)
    ? normalizedPercent.toFixed(0)
    : normalizedPercent.toFixed(1);

  return `${display}%`;
}

function calculateValueGap(fairValue: number | null, currentPrice: number | null): ValueGapView {
  if (fairValue === null || currentPrice === null || currentPrice <= 0) {
    return { label: "needs input", display: "needs input", tone: "unknown" };
  }

  const roundedPercent = Math.round(((fairValue - currentPrice) / currentPrice) * 1000) / 10;

  if (roundedPercent > 0) {
    return {
      label: "Подценен",
      display: `+${roundedPercent.toFixed(1)}%`,
      tone: "undervalued",
    };
  }

  if (roundedPercent < 0) {
    return {
      label: "Надценен",
      display: `${roundedPercent.toFixed(1)}%`,
      tone: "overvalued",
    };
  }

  return { label: "Справедлив", display: "0.0%", tone: "fair" };
}

function buildView(
  analysis: SavedStockValuationAnalysis,
  quote: ValuationQuoteSnapshot | undefined,
): SavedValuationView {
  const result = calculateStockValuation(analysis.payload);
  const currency = quote?.currency ?? analysis.payload.currency ?? "USD";
  const fairValue = finiteOrNull(result.weightedFairValue) ?? analysis.latestFairValue;
  const currentPrice =
    finiteOrNull(quote?.currentPrice) ??
    finiteOrNull(analysis.currentPrice) ??
    finiteOrNull(analysis.payload.currentPrice);
  const dcfWeight = modelWeight(analysis.payload.finalWeights.dcf10Years);
  const evEbitdaWeight = modelWeight(analysis.payload.finalWeights.evEbitda);
  const peWeight = modelWeight(analysis.payload.finalWeights.pe);
  const dcfMultipleWeight = modelWeight(analysis.payload.finalWeights.dcfMultiple);
  const tone =
    fairValue !== null && currentPrice !== null
      ? currentPrice <= fairValue
        ? "buy"
        : "wait"
      : "neutral";

  return {
    analysis,
    currency,
    currentPrice,
    fairValue,
    valueGap: calculateValueGap(fairValue, currentPrice),
    tone,
    modelValues: [
      {
        label: "DCF",
        value: modelValue(result.models.dcf10Years),
        weight: dcfWeight,
        isUsed: dcfWeight > 0,
      },
      {
        label: "EV/EBITDA",
        value: modelValue(result.models.evEbitda),
        weight: evEbitdaWeight,
        isUsed: evEbitdaWeight > 0,
      },
      {
        label: "P/E",
        value: modelValue(result.models.pe),
        weight: peWeight,
        isUsed: peWeight > 0,
      },
      {
        label: "P/FCF",
        value: modelValue(result.models.dcfMultiple),
        weight: dcfMultipleWeight,
        isUsed: dcfMultipleWeight > 0,
      },
    ],
  };
}

export function SavedValuationsPanel() {
  const [analyses, setAnalyses] = useState<SavedStockValuationAnalysis[]>([]);
  const [quotes, setQuotes] = useState<Record<string, ValuationQuoteSnapshot>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const refreshQuotes = useCallback(async (nextAnalyses: SavedStockValuationAnalysis[]) => {
    const tickers = Array.from(
      new Set(nextAnalyses.map((analysis) => analysis.ticker.trim().toUpperCase()).filter(Boolean)),
    );

    if (tickers.length === 0) {
      setQuotes({});
      return;
    }

    setIsRefreshingQuotes(true);
    try {
      const response = await fetch(
        `/api/valuation/quotes?tickers=${encodeURIComponent(tickers.join(","))}`,
      );
      const body = (await response.json()) as {
        ok: boolean;
        quotes?: ValuationQuoteSnapshot[];
        error?: string;
      };

      if (!response.ok || !body.ok) {
        throw new Error(body.error || "Quote refresh failed.");
      }

      setQuotes(
        Object.fromEntries(
          (body.quotes ?? []).map((quote) => [quote.ticker.toUpperCase(), quote]),
        ),
      );
      setStatusMessage("Цените са обновени.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Quote refresh failed.");
    } finally {
      setIsRefreshingQuotes(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialAnalyses() {
      try {
        const response = await fetch("/api/valuation/saved");
        const body = (await response.json()) as {
          ok: boolean;
          analyses?: SavedStockValuationAnalysis[];
          error?: string;
        };

        if (!response.ok || !body.ok) {
          throw new Error(body.error || "Saved analyses failed to load.");
        }

        if (cancelled) {
          return;
        }

        const nextAnalyses = body.analyses ?? [];
        setAnalyses(nextAnalyses);
        await refreshQuotes(nextAnalyses);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Saved analyses failed to load.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadInitialAnalyses();

    return () => {
      cancelled = true;
    };
  }, [refreshQuotes]);

  useEffect(() => {
    if (analyses.length === 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      refreshQuotes(analyses);
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [analyses, refreshQuotes]);

  const rows = useMemo(
    () =>
      analyses.map((analysis) =>
        buildView(analysis, quotes[analysis.ticker.trim().toUpperCase()]),
      ),
    [analyses, quotes],
  );

  async function deleteAnalysis(id: string) {
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/valuation/saved/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Delete failed.");
      }

      setAnalyses((current) => current.filter((analysis) => analysis.id !== id));
      setStatusMessage("Анализът е изтрит.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  return (
    <section className="rounded-[26px] border border-white/10 bg-slate-950/40 shadow-[0_30px_100px_rgba(0,0,0,0.22)]">
      <div className="flex flex-col gap-4 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Запазени анализи</h2>
          <p className="mt-1 text-sm text-slate-400">
            Отвори анализа, редактирай го и запази ръчно, когато искаш промените да останат.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={isRefreshingQuotes || analyses.length === 0}
            onClick={() => refreshQuotes(analyses)}
          >
            {isRefreshingQuotes ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh prices
          </button>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white transition hover:bg-blue-400"
            href="/valuation"
          >
            New analysis
          </Link>
        </div>
      </div>

      <div className="grid gap-3 p-5">
        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-300">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Зареждане...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-slate-400">
            Няма запазени анализи или текущата сесия е demo. Създай анализ от таба
            „Справедлива цена“ и го запази.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.analysis.id}
              className={cn(
                "grid gap-3 rounded-2xl border p-4 transition md:grid-cols-[minmax(180px,0.85fr)_minmax(320px,1.45fr)_minmax(120px,0.42fr)_minmax(120px,0.42fr)_minmax(120px,0.4fr)_auto] md:items-center",
                row.tone === "buy" &&
                  "border-emerald-300/25 bg-emerald-300/[0.065] hover:bg-emerald-300/[0.09]",
                row.tone === "wait" &&
                  "border-rose-300/20 bg-rose-300/[0.045] hover:bg-rose-300/[0.07]",
                row.tone === "neutral" &&
                  "border-white/10 bg-white/[0.03] hover:bg-white/[0.055]",
              )}
              data-testid="saved-valuation-row"
              data-valuation-tone={row.tone}
            >
              <Link
                aria-label={`Open ${row.analysis.ticker} valuation`}
                className="contents"
                href={`/valuation?analysis=${row.analysis.id}`}
              >
                <div>
                  <p className="text-base font-semibold text-white">{row.analysis.ticker}</p>
                  <p className="mt-1 truncate text-sm font-medium text-slate-200">
                    {row.analysis.title}
                  </p>
                  {row.analysis.companyName ? (
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {row.analysis.companyName}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {row.modelValues.map((model) => (
                    <div
                      key={model.label}
                      className="rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2"
                      data-testid="saved-valuation-model-card"
                      data-model-label={model.label}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {model.label}
                        </p>
                        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.035] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-slate-300">
                          {formatModelWeight(model.weight)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "mt-1 text-sm font-semibold",
                          model.isUsed ? "text-slate-100" : "text-slate-500",
                        )}
                      >
                        {model.isUsed ? formatCurrency(model.value, row.currency) : "--"}
                      </p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Fair value
                  </p>
                  <p className="mt-1 text-xl font-semibold text-emerald-200">
                    {formatCurrency(row.fairValue, row.currency)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Current price
                  </p>
                  <p className="mt-1 text-xl font-semibold text-white">
                    {formatCurrency(row.currentPrice, row.currency)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Value gap
                  </p>
                  {row.valueGap.tone === "unknown" ? (
                    <p className="mt-1 text-sm font-semibold text-slate-400">needs input</p>
                  ) : (
                    <p
                      className={cn(
                        "mt-1 flex flex-wrap items-baseline gap-x-1 text-sm font-semibold leading-5",
                        row.valueGap.tone === "undervalued" && "text-emerald-200",
                        row.valueGap.tone === "overvalued" && "text-rose-200",
                        row.valueGap.tone === "fair" && "text-slate-200",
                      )}
                    >
                      <span>{row.valueGap.label}</span>
                      <span>{row.valueGap.display}</span>
                    </p>
                  )}
                </div>
              </Link>

              <button
                aria-label={`Delete ${row.analysis.ticker} valuation`}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06]"
                type="button"
                onClick={() => deleteAnalysis(row.analysis.id)}
              >
                <Trash2 className="size-4" />
                Delete
              </button>
            </div>
          ))
        )}

        <div className="min-h-6 text-sm">
          {statusMessage ? <span className="text-emerald-300">{statusMessage}</span> : null}
          {errorMessage ? <span className="text-rose-300">{errorMessage}</span> : null}
        </div>
      </div>
    </section>
  );
}
