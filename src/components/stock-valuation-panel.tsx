"use client";

import {
  BadgeDollarSign,
  CheckCircle2,
  Database,
  Loader2,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  buildDefaultStockValuationInput,
  calculateStockValuation,
  cloneStockValuationInput,
  type DcfTenYearsScenario,
  type EvEbitdaScenario,
  type StockValuationAutofillFields,
  type StockValuationInput,
  type TerminalMultipleScenario,
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

function numberInputValue(value: number | null) {
  return value === null || !Number.isFinite(value) ? "" : String(value);
}

function parseNumberInput(value: string) {
  const normalized = value.replace(",", ".").trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function sourceLabel(source: string | undefined) {
  return source || "Manual";
}

function SourceBadge({ source }: { source?: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
      {sourceLabel(source)}
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

function PercentField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <NumericField
      label={label}
      value={value === null ? null : value * 100}
      onChange={(next) => onChange(next === null ? null : next / 100)}
    />
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const result = useMemo(() => calculateStockValuation(input), [input]);

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
      setStatusMessage("Данните са попълнени. Всички полета остават editable.");
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
  const signalTone =
    result.signal === "BUY" ? "good" : result.signal === "SELL" ? "bad" : "neutral";

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
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

            <div className="grid gap-3 sm:grid-cols-[160px_minmax(180px,1fr)_auto] lg:min-w-[620px]">
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

        <div className="grid gap-4 border-y border-white/10 p-5 lg:grid-cols-2">
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

          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-4">
            {modelTabs.map((tab) => (
              <PercentField
                key={tab.key}
                label={tab.label}
                value={input.finalWeights[tab.key]}
                onChange={(value) => updateFinalWeight(tab.key, value)}
              />
            ))}
          </div>
        </div>

        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            {modelTabs.map((tab) => (
              <button
                key={tab.key}
                aria-pressed={activeModel === tab.key}
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm font-semibold transition",
                  activeModel === tab.key
                    ? "border-blue-400/40 bg-blue-500 text-white"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]",
                )}
                type="button"
                onClick={() => setActiveModel(tab.key)}
              >
                {tab.label}
              </button>
            ))}
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
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Scenario weight total {formatPercent(activeResult.scenarioWeightTotal, 0)}
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {activeScenarios.map((scenario, index) => (
                <ScenarioEditor
                  key={scenario.id}
                  modelKey={activeModel}
                  scenario={scenario}
                  fairValue={activeResult.scenarios[index]?.fairValue ?? null}
                  currency={input.currency}
                  onChange={(key, value) => updateScenario(activeModel, scenario.id, key, value)}
                />
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <Database className="mt-1 size-5 text-slate-400" />
              <div>
                <p className="font-semibold text-white">Source badges</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  SEC и Alpha Vantage са primary; Yahoo се използва само за current price;
                  Macrotrends е best-effort fallback. Празните полета остават editable.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(input.sources ?? {}).length === 0 ? (
                <SourceBadge source="Manual" />
              ) : (
                Object.entries(input.sources ?? {}).map(([key, value]) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-300"
                  >
                    <span className="font-semibold text-slate-500">{key}</span>
                    <SourceBadge source={String(value?.source ?? "Manual")} />
                  </span>
                ))
              )}
            </div>
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

        <div className="mt-4 grid gap-3">
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
  onChange,
}: {
  modelKey: ModelKey;
  scenario: DcfTenYearsScenario | EvEbitdaScenario | TerminalMultipleScenario;
  fairValue: number | null;
  currency: string;
  onChange: (key: string, value: number | null) => void;
}) {
  const isDcf = modelKey === "dcf10Years";
  const isEvEbitda = modelKey === "evEbitda";
  const dcfScenario = scenario as DcfTenYearsScenario;
  const evScenario = scenario as EvEbitdaScenario;
  const terminalScenario = scenario as TerminalMultipleScenario;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-semibold text-white">{scenario.label}</p>
          <p className="text-sm text-slate-400">{formatCurrency(fairValue, currency)}</p>
        </div>
        <PercentField
          label="Scenario weight"
          value={scenario.weight}
          onChange={(value) => onChange("weight", value)}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isDcf ? (
          <NumericField
            label="Free cash flow"
            value={dcfScenario.baseFreeCashFlow}
            onChange={(value) => onChange("baseFreeCashFlow", value)}
          />
        ) : null}
        {isEvEbitda ? (
          <NumericField
            label="EBITDA"
            value={evScenario.baseEbitda}
            onChange={(value) => onChange("baseEbitda", value)}
          />
        ) : null}
        {!isDcf && !isEvEbitda ? (
          <NumericField
            label={modelKey === "pe" ? "EPS" : "FCF per share"}
            value={terminalScenario.baseMetricPerShare}
            onChange={(value) => onChange("baseMetricPerShare", value)}
          />
        ) : null}
        {!isDcf ? (
          <NumericField
            label={modelKey === "pe" ? "P/E multiple" : modelKey === "evEbitda" ? "EV/EBITDA multiple" : "P/FCF multiple"}
            value={(scenario as EvEbitdaScenario | TerminalMultipleScenario).terminalMultiple}
            onChange={(value) => onChange("terminalMultiple", value)}
          />
        ) : null}
        <PercentField
          label="Discount rate"
          value={scenario.discountRate}
          onChange={(value) => onChange("discountRate", value)}
        />
        <PercentField
          label="Growth years 1-5"
          value={scenario.growthNextFiveYears}
          onChange={(value) => onChange("growthNextFiveYears", value)}
        />
        <PercentField
          label="Growth years 6-10"
          value={scenario.growthYearsFiveToTen}
          onChange={(value) => onChange("growthYearsFiveToTen", value)}
        />
        {isDcf ? (
          <PercentField
            label="Perpetual growth"
            value={dcfScenario.perpetualGrowth}
            onChange={(value) => onChange("perpetualGrowth", value)}
          />
        ) : null}
        <PercentField
          label="Margin of safety"
          value={scenario.marginOfSafety}
          onChange={(value) => onChange("marginOfSafety", value)}
        />
      </div>
    </div>
  );
}
