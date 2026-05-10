"use client";

import {
  AlertTriangle,
  BriefcaseBusiness,
  Calculator,
  ChevronDown,
  Info,
  Layers3,
  Plus,
  ReceiptText,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { PortfolioRiskManager } from "@/components/portfolio-risk-manager";
import {
  calculateAccumulatedPosition,
  calculateLeverageRisk,
  calculatePartialSales,
  parseLeverage,
  type LeverageRiskResult,
  type MarginMode,
  type PositionSide,
} from "@/lib/risk-calculator";
import { cn } from "@/lib/utils";

type SuccessfulLeverageRiskResult = Extract<LeverageRiskResult, { ok: true }>;
type CalculatorTab = "risk" | "partial-sales" | "accumulation" | "portfolio";

const numberFormatter = new Intl.NumberFormat("bg-BG", {
  maximumFractionDigits: 2,
});

function formatCurrency(value: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${numberFormatter.format(value)} ${currency}`;
  }
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function parseAmount(value: string) {
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseOptionalAmount(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return parseAmount(trimmed);
}

function sideLabel(side: PositionSide) {
  return side === "buy" ? "BUY / Купувам" : "SELL / Продавам";
}

function marginModeLabel(mode: MarginMode) {
  if (mode === "real_broker_margin") {
    return "Реален маржин";
  }

  if (mode === "fixed_leverage") {
    return "Фиксиран ливъридж";
  }

  return "Account leverage";
}

function CalculatorTabNav({
  value,
  onChange,
}: {
  value: CalculatorTab;
  onChange: (value: CalculatorTab) => void;
}) {
  const options: Array<{
    value: CalculatorTab;
    title: string;
    text: string;
    icon: typeof Calculator;
  }> = [
    {
      value: "risk",
      title: "Входни данни / Резултат",
      text: "Stop-out, маржин и печалба",
      icon: Calculator,
    },
    {
      value: "partial-sales",
      title: "Продажба на части",
      text: "Отделни покупки и продажби",
      icon: ReceiptText,
    },
    {
      value: "accumulation",
      title: "Осредняване",
      text: "Средна цена и целева печалба",
      icon: Layers3,
    },
    {
      value: "portfolio",
      title: "Портфолио риск",
      text: "Акаунт, позиции и стрес тест",
      icon: BriefcaseBusiness,
    },
  ];

  return (
    <section className="rounded-[28px] border border-white/10 bg-[#10192d]/88 p-3 shadow-[0_30px_90px_rgba(5,8,20,0.35)]">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = value === option.value;

          return (
            <button
              aria-pressed={isActive}
              className={cn(
                "flex items-center gap-3 rounded-[22px] border px-4 py-4 text-left transition",
                isActive
                  ? "border-amber-200/35 bg-amber-300/16 text-amber-50 shadow-[0_16px_45px_rgba(245,189,73,0.12)]"
                  : "border-white/8 bg-white/[0.035] text-slate-300 hover:border-white/14 hover:bg-white/[0.06]",
              )}
              key={option.value}
              onClick={() => onChange(option.value)}
              type="button"
            >
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                  isActive ? "bg-amber-300/20 text-amber-100" : "bg-white/[0.05] text-slate-300",
                )}
              >
                <Icon className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{option.title}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-400">{option.text}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SideControl({
  value,
  onChange,
}: {
  value: PositionSide;
  onChange: (value: PositionSide) => void;
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-white/8 bg-white/[0.03] p-1.5 sm:grid-cols-2">
      {(["buy", "sell"] as const).map((side) => (
        <button
          className={cn(
            "rounded-lg px-3 py-2.5 text-left transition",
            value === side
              ? "border border-amber-200/35 bg-amber-300/16 text-amber-50"
              : "border border-transparent text-slate-300 hover:bg-white/[0.05]",
          )}
          key={side}
          onClick={() => onChange(side)}
          type="button"
        >
          <span className="block text-sm font-semibold">{sideLabel(side)}</span>
          <span className="mt-1 block text-xs leading-4 text-slate-400">
            {side === "buy"
              ? "Печелиш при покачване, рискът е спад."
              : "Печелиш при спад, рискът е покачване."}
          </span>
        </button>
      ))}
    </div>
  );
}

function MarginModeControl({
  value,
  onChange,
}: {
  value: MarginMode;
  onChange: (value: MarginMode) => void;
}) {
  const options: Array<{ value: MarginMode; title: string; text: string; badge?: string }> = [
    {
      value: "real_broker_margin",
      title: "Реален маржин от брокера",
      text: "Най-точно: въведи Margin/Used Margin от платформата. Работи с всеки брокер.",
      badge: "Най-точен",
    },
    {
      value: "fixed_leverage",
      title: "Фиксиран ливъридж / Margin %",
      text: "Когато инструментът има собствен ливъридж или margin percentage в спецификацията.",
    },
    {
      value: "account_leverage",
      title: "Account Leverage",
      text: "Само когато конкретният инструмент реално следва leverage-а на акаунта.",
    },
  ];

  return (
    <div className="grid gap-2 rounded-xl border border-white/8 bg-white/[0.03] p-1.5 lg:grid-cols-3">
      {options.map((option) => (
        <button
          className={cn(
            "rounded-lg px-3 py-2.5 text-left transition",
            value === option.value
              ? "border border-amber-200/35 bg-amber-300/16 text-amber-50"
              : "border border-transparent text-slate-300 hover:bg-white/[0.05]",
          )}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {option.title}
            {option.badge ? (
              <span className="rounded-full bg-emerald-300/14 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-emerald-100">
                {option.badge}
              </span>
            ) : null}
          </span>
          <span className="mt-1 block text-xs leading-4 text-slate-400">{option.text}</span>
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
  placeholder,
  error,
  type = "text",
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  error?: string;
  type?: "text" | "number";
  compact?: boolean;
}) {
  return (
    <label
      className={cn(
        "block border border-white/8 bg-white/[0.03]",
        compact ? "rounded-xl p-3" : "rounded-[22px] p-4",
      )}
    >
      <span className="text-[11px] font-medium uppercase tracking-[0.11em] text-slate-400">
        {label}
      </span>
      <input
        className={cn(
          "w-full border bg-slate-950/45 font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/15",
          compact ? "mt-2 h-10 rounded-lg px-3 text-sm" : "mt-3 h-12 rounded-2xl px-4 text-base",
          error ? "border-rose-300/40" : "border-white/10",
        )}
        inputMode="decimal"
        min={type === "number" ? "0" : undefined}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      {error ? (
        <span className={cn("mt-2 block text-rose-200", compact ? "text-xs" : "text-sm")}>
          {error}
        </span>
      ) : null}
      {hint && !error ? (
        <span className={cn("mt-2 block text-slate-400", compact ? "text-xs leading-5" : "text-sm")}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function ResultCard({
  label,
  value,
  hint,
  tone = "slate",
  compact = false,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "gold" | "green" | "red" | "slate";
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden border ring-1",
        compact ? "rounded-xl p-4" : "rounded-[24px] p-5",
        tone === "gold" && "border-amber-200/18 bg-amber-300/[0.07] ring-amber-200/10",
        tone === "green" && "border-emerald-200/15 bg-emerald-300/[0.07] ring-emerald-200/10",
        tone === "red" && "border-rose-200/15 bg-rose-300/[0.07] ring-rose-200/10",
        tone === "slate" && "border-white/10 bg-white/[0.04] ring-white/10",
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={cn("mt-2 font-semibold text-white", compact ? "text-2xl" : "text-3xl")}>
        {value}
      </p>
      <p className={cn("mt-2 text-slate-300", compact ? "text-xs leading-5" : "text-sm leading-6")}>
        {hint}
      </p>
    </div>
  );
}

function AutoCloseResultCard({
  result,
  currency,
  compact = false,
}: {
  result: SuccessfulLeverageRiskResult;
  currency: string;
  compact?: boolean;
}) {
  const range = result.stopOutRange;

  if (!range) {
    return (
      <ResultCard
        hint={`Буферът е ${formatCurrency(result.maxLossPerUnitInstrument, currency)} на акция.`}
        label="Авто затваряне"
        compact={compact}
        tone="red"
        value={formatCurrency(result.displayAutoClosePrice, currency)}
      />
    );
  }

  const hasActiveStopOutRisk =
    range.normal.isStopOutRiskActive || range.temporary.isStopOutRiskActive;

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-rose-200/15 bg-rose-300/[0.07] ring-1 ring-rose-200/10",
        compact ? "rounded-xl p-4" : "rounded-[24px] p-5",
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
        Auto затваряне
      </p>
      <p className={cn("mt-2 font-semibold text-white", compact ? "text-2xl" : "text-2xl sm:text-3xl")}>
        {formatCurrency(range.normal.displayAutoClosePrice, currency)}{" "}
        <span className="text-slate-500">—</span>{" "}
        {formatCurrency(range.temporary.displayAutoClosePrice, currency)}
      </p>
      <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-300">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 bg-slate-950/25 px-3 py-2">
          <span>Реален маржин</span>
          <span className="font-semibold text-rose-100">
            {formatCurrency(range.normal.displayAutoClosePrice, currency)}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 bg-slate-950/25 px-3 py-2">
          <span>Временен leverage 1:{formatNumber(range.temporary.leverage)}</span>
          <span className="font-semibold text-rose-100">
            {formatCurrency(range.temporary.displayAutoClosePrice, currency)}
          </span>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-xs leading-5 text-slate-300">
        <p>
          Буфер при реален маржин:{" "}
          <span className="font-semibold text-slate-100">
            {formatCurrency(range.normal.lossPerUnitInstrument, currency)}
          </span>{" "}
          на акция.
        </p>
        <p>
          Буфер при временен leverage:{" "}
          <span className="font-semibold text-slate-100">
            {formatCurrency(range.temporary.lossPerUnitInstrument, currency)}
          </span>{" "}
          на акция.
        </p>
      </div>
      {hasActiveStopOutRisk ? (
        <p className="mt-3 rounded-lg border border-rose-200/20 bg-rose-300/10 px-3 py-2 text-xs leading-5 text-rose-100">
          Акаунтът вече е под изисквания маржин / има риск от stop-out по въведените данни.
        </p>
      ) : null}
    </div>
  );
}

function PriceRiskLine({
  side,
  autoClosePrice,
  entryPrice,
  exitPrice,
  currency,
}: {
  side: PositionSide;
  autoClosePrice: number;
  entryPrice: number;
  exitPrice: number;
  currency: string;
}) {
  const columns =
    side === "buy"
      ? [
          { label: "Авто затваряне", value: autoClosePrice, tone: "text-rose-200/75" },
          { label: "Вход", value: entryPrice, tone: "text-amber-200/75" },
          { label: "План изход", value: exitPrice, tone: "text-emerald-200/75" },
        ]
      : [
          { label: "План изход", value: exitPrice, tone: "text-emerald-200/75" },
          { label: "Вход", value: entryPrice, tone: "text-amber-200/75" },
          { label: "Авто затваряне", value: autoClosePrice, tone: "text-rose-200/75" },
        ];

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        {columns.map((column) => (
          <div key={column.label}>
            <p className={cn("text-xs font-medium uppercase tracking-[0.12em]", column.tone)}>
              {column.label}
            </p>
            <p className="mt-1 text-lg font-semibold text-white">
              {formatCurrency(column.value, currency)}
            </p>
          </div>
        ))}
      </div>
      <div
        className={cn(
          "mt-4 h-2.5 overflow-hidden rounded-full",
          side === "buy"
            ? "bg-gradient-to-r from-rose-300/80 via-amber-200/85 to-emerald-300/80"
            : "bg-gradient-to-r from-emerald-300/80 via-amber-200/85 to-rose-300/80",
        )}
      />
      <div className="mt-2 grid grid-cols-3 text-xs text-slate-500">
        <span>{side === "buy" ? "Риск при спад" : "Цел при спад"}</span>
        <span className="text-center">Цена на вход</span>
        <span className="text-right">{side === "buy" ? "Цел при ръст" : "Риск при ръст"}</span>
      </div>
    </div>
  );
}

function DirectionNote({ side }: { side: PositionSide }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-sm leading-6 text-slate-300">
      {side === "buy" ? (
        <p>
          <span className="font-semibold text-emerald-100">BUY</span> означава, че купуваш акцията
          и печелиш, ако цената се покачи. Рискът е цената да падне и да изчерпи зададения маржин.
        </p>
      ) : (
        <p>
          <span className="font-semibold text-rose-100">SELL</span> означава, че продаваш чрез
          ливъридж и печелиш, ако цената падне. Рискът е цената да се качи срещу позицията.
        </p>
      )}
    </div>
  );
}

type PartialSaleRow = {
  id: string;
  entryPrice: string;
  ownedShares: string;
  sharesToSell: string;
  exitPrice: string;
};

type AccumulationRow = {
  id: string;
  entryPrice: string;
  shares: string;
};

function RowInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      <input
        className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/15"
        inputMode="decimal"
        min="0"
        onChange={(event) => onChange(event.target.value)}
        type="number"
        value={value}
      />
    </label>
  );
}

function ResultAmount({ value }: { value: number }) {
  return (
    <span className={cn("font-semibold", value >= 0 ? "text-emerald-100" : "text-rose-100")}>
      {value >= 0 ? "" : "-"}
      {formatCurrency(Math.abs(value))}
    </span>
  );
}

function BrokerDataChecklist() {
  const items = [
    "Balance и Equity",
    "Margin / Used Margin за позицията",
    "Stop-out level %",
    "Валута на акаунта и валута на инструмента",
    "FX курс между двете валути",
    "Цена на вход, брой акции и планиран изход",
  ];

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-xs leading-5 text-slate-300">
      <p className="font-semibold text-slate-100">За най-точна сметка вземи тези данни от брокера:</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div className="rounded-lg border border-white/8 bg-slate-950/25 px-3 py-2" key={item}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function PartialSalesPanel() {
  const [sales, setSales] = useState<PartialSaleRow[]>([
    { id: "sale-1", entryPrice: "16.43", ownedShares: "7", sharesToSell: "7", exitPrice: "30" },
    { id: "sale-2", entryPrice: "18", ownedShares: "7", sharesToSell: "3", exitPrice: "60" },
    { id: "sale-3", entryPrice: "23", ownedShares: "5", sharesToSell: "4", exitPrice: "50" },
  ]);

  const result = useMemo(
    () =>
      calculatePartialSales({
        lots: sales.map((sale) => ({
          entryPrice: parseAmount(sale.entryPrice),
          ownedShares: parseAmount(sale.ownedShares),
          sharesToSell: parseAmount(sale.sharesToSell),
          exitPrice: parseAmount(sale.exitPrice),
        })),
      }),
    [sales],
  );
  const errors = result.ok ? {} : result.errors;

  function updateSale(id: string, field: keyof Omit<PartialSaleRow, "id">, value: string) {
    setSales((current) =>
      current.map((sale) => (sale.id === id ? { ...sale, [field]: value } : sale)),
    );
  }

  function addSale() {
    setSales((current) => [
      ...current,
      {
        id: `sale-${current.length + 1}-${Date.now()}`,
        entryPrice: "0",
        ownedShares: "1",
        sharesToSell: "1",
        exitPrice: "0",
      },
    ]);
  }

  function removeSale(id: string) {
    setSales((current) => current.filter((sale) => sale.id !== id));
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-[#10192d]/88 p-6 shadow-[0_30px_90px_rgba(5,8,20,0.45)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-300/18 text-amber-100">
            <ReceiptText className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-200/75">
              Продажба на части
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">Частични продажби</h2>
          </div>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-200/20 bg-amber-300/12 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-amber-300/18"
          onClick={addSale}
          type="button"
        >
          <Plus className="size-4" />
          Добави продажба
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {sales.map((sale, index) => {
          const saleResult = result.ok
            ? result.saleResults.find((item) => item.index === index)
            : null;

          return (
            <div
              className="grid gap-3 rounded-[24px] border border-white/8 bg-white/[0.035] p-4 xl:grid-cols-[1fr_1fr_1fr_1fr_auto_auto]"
              key={sale.id}
            >
              <RowInput
                label={`Ред ${index + 1}: цена на покупка`}
                onChange={(value) => updateSale(sale.id, "entryPrice", value)}
                value={sale.entryPrice}
              />
              <RowInput
                label="Купени акции"
                onChange={(value) => updateSale(sale.id, "ownedShares", value)}
                value={sale.ownedShares}
              />
              <RowInput
                label="Продавам акции"
                onChange={(value) => updateSale(sale.id, "sharesToSell", value)}
                value={sale.sharesToSell}
              />
              <RowInput
                label="Цена на продажба"
                onChange={(value) => updateSale(sale.id, "exitPrice", value)}
                value={sale.exitPrice}
              />
              <div className="rounded-2xl border border-white/8 bg-slate-950/30 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                  Печалба
                </p>
                <p className="mt-2 text-lg">
                  {saleResult ? <ResultAmount value={saleResult.profit} /> : "-"}
                </p>
              </div>
              <button
                aria-label={`Премахни продажба ${index + 1}`}
                className="flex size-11 items-center justify-center self-end rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-rose-200/30 hover:bg-rose-300/10 hover:text-rose-100"
                disabled={sales.length === 1}
                onClick={() => removeSale(sale.id)}
                type="button"
              >
                <Trash2 className="size-4" />
              </button>
              {!result.ok && errors.lots?.[index] ? (
                <p className="text-sm text-rose-200 xl:col-span-6">{errors.lots[index]}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      {result.ok ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-4">
          <ResultCard
            hint="Сбор от купените акции във всички въведени редове."
            label="Общо купени"
            tone="slate"
            value={formatNumber(result.totalOwnedShares)}
          />
          <ResultCard
            hint={`Продадени са ${formatNumber(result.soldShares)} от ${formatNumber(result.totalOwnedShares)} акции.`}
            label="Продадени акции"
            tone="gold"
            value={formatNumber(result.soldShares)}
          />
          <ResultCard
            hint="Тези акции още не са включени в реализирана печалба."
            label="Остават акции"
            tone="slate"
            value={formatNumber(result.remainingShares)}
          />
          <ResultCard
            hint="Сбор от всички въведени частични продажби."
            label={result.totalProfit >= 0 ? "Обща печалба" : "Обща загуба"}
            tone={result.totalProfit >= 0 ? "green" : "red"}
            value={formatCurrency(Math.abs(result.totalProfit))}
          />
        </div>
      ) : null}

      {result.ok ? (
        <div className="mt-5 rounded-[24px] border border-amber-200/15 bg-amber-300/[0.08] p-5 text-base leading-7 text-slate-100">
          {result.saleResults.slice(0, 3).map((sale) => (
            <p key={sale.index}>
              Ред {sale.index + 1}: купени са {formatNumber(sale.ownedShares)} акции на{" "}
              <span className="font-semibold text-amber-100">
                {formatCurrency(sale.entryPrice)}
              </span>
              , продаваш {formatNumber(sale.sharesToSell)} на{" "}
              <span className="font-semibold text-emerald-100">
                {formatCurrency(sale.exitPrice)}
              </span>
              , резултатът е <ResultAmount value={sale.profit} />.
            </p>
          ))}
          <p>
            Общият резултат от всички въведени продажби е{" "}
            <ResultAmount value={result.totalProfit} />.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function AccumulationPanel() {
  const [targetExitPrice, setTargetExitPrice] = useState("50");
  const [lots, setLots] = useState<AccumulationRow[]>([
    { id: "lot-1", entryPrice: "15", shares: "7" },
    { id: "lot-2", entryPrice: "18", shares: "5" },
    { id: "lot-3", entryPrice: "23", shares: "6" },
  ]);

  const result = useMemo(
    () =>
      calculateAccumulatedPosition({
        targetExitPrice: parseAmount(targetExitPrice),
        lots: lots.map((lot) => ({
          entryPrice: parseAmount(lot.entryPrice),
          shares: parseAmount(lot.shares),
        })),
      }),
    [lots, targetExitPrice],
  );
  const errors = result.ok ? {} : result.errors;

  function updateLot(id: string, field: "entryPrice" | "shares", value: string) {
    setLots((current) => current.map((lot) => (lot.id === id ? { ...lot, [field]: value } : lot)));
  }

  function addLot() {
    setLots((current) => [
      ...current,
      { id: `lot-${current.length + 1}-${Date.now()}`, entryPrice: "0", shares: "1" },
    ]);
  }

  function removeLot(id: string) {
    setLots((current) => current.filter((lot) => lot.id !== id));
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-[#10192d]/88 p-6 shadow-[0_30px_90px_rgba(5,8,20,0.45)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-300/18 text-amber-100">
            <Layers3 className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-200/75">
              Осредняване
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">Натрупване / осредняване</h2>
          </div>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-200/20 bg-amber-300/12 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-amber-300/18"
          onClick={addLot}
          type="button"
        >
          <Plus className="size-4" />
          Добави покупка
        </button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.75fr]">
        <div className="space-y-3">
          {lots.map((lot, index) => {
            const lotResult = result.ok ? result.lotResults.find((item) => item.index === index) : null;

            return (
              <div
                className="grid gap-3 rounded-[24px] border border-white/8 bg-white/[0.035] p-4 lg:grid-cols-[1fr_1fr_auto_auto]"
                key={lot.id}
              >
                <RowInput
                  label={`Покупка ${index + 1}: цена`}
                  onChange={(value) => updateLot(lot.id, "entryPrice", value)}
                  value={lot.entryPrice}
                />
                <RowInput
                  label="Брой акции"
                  onChange={(value) => updateLot(lot.id, "shares", value)}
                  value={lot.shares}
                />
                <div className="rounded-2xl border border-white/8 bg-slate-950/30 px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                    Печалба при цел
                  </p>
                  <p className="mt-2 text-lg">
                    {lotResult ? <ResultAmount value={lotResult.profit} /> : "-"}
                  </p>
                </div>
                <button
                  aria-label={`Премахни покупка ${index + 1}`}
                  className="flex size-11 items-center justify-center self-end rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-rose-200/30 hover:bg-rose-300/10 hover:text-rose-100"
                  disabled={lots.length === 1}
                  onClick={() => removeLot(lot.id)}
                  type="button"
                >
                  <Trash2 className="size-4" />
                </button>
                {!result.ok && errors.lots?.[index] ? (
                  <p className="text-sm text-rose-200 lg:col-span-4">{errors.lots[index]}</p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <Field
            error={errors.targetExitPrice}
            hint="Сценарий: ако продадеш всички натрупани акции на тази цена."
            label="Целева продажна цена"
            onChange={setTargetExitPrice}
            type="number"
            value={targetExitPrice}
          />

          {result.ok ? (
            <div className="grid gap-4">
              <ResultCard
                hint={`Общо вложени: ${formatCurrency(result.totalCost)} за ${formatNumber(result.totalShares)} акции.`}
                label="Средна цена"
                tone="gold"
                value={formatCurrency(result.averageEntryPrice)}
              />
              <ResultCard
                hint={`Резултат спрямо общо вложената сума: ${result.totalReturnPct.toFixed(1)}%.`}
                label={result.totalProfit >= 0 ? "Обща печалба" : "Обща загуба"}
                tone={result.totalProfit >= 0 ? "green" : "red"}
                value={formatCurrency(Math.abs(result.totalProfit))}
              />
            </div>
          ) : null}
        </div>
      </div>

      {result.ok ? (
        <div className="mt-5 rounded-[24px] border border-amber-200/15 bg-amber-300/[0.08] p-5 text-base leading-7 text-slate-100">
          <p>
            Средната ти цена след натрупване е{" "}
            <span className="font-semibold text-amber-100">
              {formatCurrency(result.averageEntryPrice)}
            </span>
            .
          </p>
          <p>
            Ако продадеш всички на{" "}
            <span className="font-semibold text-emerald-100">
              {formatCurrency(result.input.targetExitPrice)}
            </span>
            , общият резултат е <ResultAmount value={result.totalProfit} />.
          </p>
          <p className="text-sm text-slate-300">
            Това е сценарий за продажба на всички натрупани акции на една целева цена. Отделните
            редове показват каква печалба носи всяка покупна цена.
          </p>
        </div>
      ) : null}
    </section>
  );
}

export function RiskCalculator() {
  const [activeCalculator, setActiveCalculator] = useState<CalculatorTab>("risk");
  const [showAdvancedInputs, setShowAdvancedInputs] = useState(false);
  const [marginMode, setMarginMode] = useState<MarginMode>("real_broker_margin");
  const [side, setSide] = useState<PositionSide>("buy");
  const [accountBalance, setAccountBalance] = useState("50");
  const [equity, setEquity] = useState("48.36");
  const [usedMargin, setUsedMargin] = useState("4.16");
  const [accountCurrency, setAccountCurrency] = useState("EUR");
  const [instrumentCurrency, setInstrumentCurrency] = useState("USD");
  const [entryPrice, setEntryPrice] = useState("16.30");
  const [currentPrice, setCurrentPrice] = useState("15.98");
  const [shares, setShares] = useState("6");
  const [exitPrice, setExitPrice] = useState("30");
  const [accountLeverageInput, setAccountLeverageInput] = useState("1:1000");
  const [fixedLeverageInput, setFixedLeverageInput] = useState("1:20");
  const [temporaryLeverageInput, setTemporaryLeverageInput] = useState("1:5");
  const [stopOutLevelPercent, setStopOutLevelPercent] = useState("20");
  const [fxRateInstrumentToAccount, setFxRateInstrumentToAccount] = useState("0.85");

  const accountLeverage = useMemo(() => parseLeverage(accountLeverageInput), [accountLeverageInput]);
  const fixedLeverage = useMemo(() => parseLeverage(fixedLeverageInput), [fixedLeverageInput]);
  const temporaryLeverage = useMemo(
    () => parseLeverage(temporaryLeverageInput),
    [temporaryLeverageInput],
  );
  const result = useMemo(
    () =>
      calculateLeverageRisk({
        marginMode,
        direction: side,
        accountBalance: parseAmount(accountBalance),
        accountCurrency: accountCurrency.trim().toUpperCase() || "EUR",
        instrumentCurrency: instrumentCurrency.trim().toUpperCase() || "USD",
        entryPrice: parseAmount(entryPrice),
        quantity: parseAmount(shares),
        plannedExitPrice: parseAmount(exitPrice),
        stopOutLevelPercent: parseAmount(stopOutLevelPercent),
        fxRateInstrumentToAccount: parseAmount(fxRateInstrumentToAccount),
        accountLeverage: accountLeverage ?? Number.NaN,
        fixedLeverage: fixedLeverage ?? Number.NaN,
        equity: parseOptionalAmount(equity),
        usedMargin: parseAmount(usedMargin),
        currentPrice: parseOptionalAmount(currentPrice),
        temporaryFixedLeverage: temporaryLeverage ?? Number.NaN,
      }),
    [
      accountBalance,
      accountCurrency,
      accountLeverage,
      currentPrice,
      entryPrice,
      equity,
      exitPrice,
      fixedLeverage,
      fxRateInstrumentToAccount,
      instrumentCurrency,
      marginMode,
      shares,
      side,
      stopOutLevelPercent,
      temporaryLeverage,
      usedMargin,
    ],
  );

  const errors = result.ok ? {} : result.errors;
  const accountLeverageError =
    marginMode === "account_leverage" && !accountLeverage
      ? "Въведи account leverage като 1:1000 или 1000."
      : errors.accountLeverage;
  const fixedLeverageError =
    marginMode === "fixed_leverage" && !fixedLeverage
      ? "Въведи fixed leverage като 1:20 или 20."
      : errors.fixedLeverage;
  const temporaryLeverageError =
    marginMode === "real_broker_margin" && !temporaryLeverage
      ? "Въведи временен leverage като 1:5 или 5."
      : errors.temporaryFixedLeverage;
  const accountCurrencyCode = result.ok
    ? result.input.accountCurrency
    : accountCurrency.trim().toUpperCase() || "EUR";
  const instrumentCurrencyCode = result.ok
    ? result.input.instrumentCurrency
    : instrumentCurrency.trim().toUpperCase() || "USD";

  function applyGenericExample(mode: "real" | "fixed-20" | "fixed-5") {
    setSide("buy");
    setAccountBalance("50");
    setEquity("48.36");
    setUsedMargin("4.16");
    setAccountCurrency("EUR");
    setInstrumentCurrency("USD");
    setEntryPrice("16.30");
    setCurrentPrice("15.98");
    setShares("6");
    setExitPrice("30");
    setTemporaryLeverageInput("1:5");
    setStopOutLevelPercent("20");
    setFxRateInstrumentToAccount("0.85");

    if (mode === "real") {
      setMarginMode("real_broker_margin");
      setFixedLeverageInput("1:20");
      return;
    }

    setMarginMode("fixed_leverage");
    setFixedLeverageInput(mode === "fixed-20" ? "1:20" : "1:5");
  }

  return (
    <div className="space-y-6">
      <CalculatorTabNav onChange={setActiveCalculator} value={activeCalculator} />

      <div className={cn(activeCalculator !== "risk" && "hidden")}>
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-white/10 bg-[#10192d]/88 p-4 shadow-[0_18px_55px_rgba(5,8,20,0.34)]">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-amber-300/16 text-amber-100">
                <Calculator className="size-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-amber-200/75">
                  Входни данни
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">Параметри на позицията</h2>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <SideControl onChange={setSide} value={side} />
              <DirectionNote side={side} />

              <div
                className={cn(
                  "grid gap-3",
                  marginMode === "real_broker_margin" ? "lg:grid-cols-3" : "sm:grid-cols-2",
                )}
              >
                <Field
                  compact
                  error={errors.accountBalance}
                  hint="Balance от платформата."
                  label="Баланс"
                  onChange={setAccountBalance}
                  type="number"
                  value={accountBalance}
                />
                {marginMode === "real_broker_margin" ? (
                  <>
                    <Field
                      compact
                      error={errors.equity}
                      hint="Ако е празно, смята от balance + текущ P/L."
                      label="Equity"
                      onChange={setEquity}
                      type="number"
                      value={equity}
                    />
                    <Field
                      compact
                      error={errors.usedMargin}
                      hint="Въведи реалния Margin / Used Margin, който брокерът показва за позицията."
                      label="Margin / Used Margin от брокера"
                      onChange={setUsedMargin}
                      type="number"
                      value={usedMargin}
                    />
                  </>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  compact
                  error={errors.entryPrice}
                  label="Цена на вход"
                  onChange={setEntryPrice}
                  type="number"
                  value={entryPrice}
                />
                <Field
                  compact
                  error={errors.quantity}
                  label="Брой акции"
                  onChange={setShares}
                  type="number"
                  value={shares}
                />
                <Field
                  compact
                  error={errors.currentPrice}
                  hint="За по-точен stop-out от текущия пазар."
                  label="Текуща цена"
                  onChange={setCurrentPrice}
                  type="number"
                  value={currentPrice}
                />
                <Field
                  compact
                  error={errors.plannedExitPrice}
                  label="Планирана цена на изход"
                  onChange={setExitPrice}
                  type="number"
                  value={exitPrice}
                />
              </div>

              <div className="rounded-xl border border-white/8 bg-white/[0.03]">
              <button
                aria-expanded={showAdvancedInputs}
                className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                onClick={() => setShowAdvancedInputs((current) => !current)}
                type="button"
              >
                <span className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-amber-300/14 text-amber-100">
                    <SlidersHorizontal className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      Допълнителни настройки
                    </span>
                    <span className="mt-0.5 block text-xs leading-4 text-slate-400">
                      Валути, FX курс, leverage режим, stop-out и примерни стойности.
                    </span>
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "size-5 shrink-0 text-slate-400 transition",
                    showAdvancedInputs && "rotate-180",
                  )}
                />
              </button>

              {showAdvancedInputs ? (
                <div className="grid gap-3 border-t border-white/8 p-3">
                  <MarginModeControl onChange={setMarginMode} value={marginMode} />
                  <div className="rounded-xl border border-amber-200/18 bg-amber-300/[0.08] p-3 text-xs leading-5 text-amber-50">
                    Account leverage не винаги важи за всеки инструмент. При акции, CFD акции,
                    ETF-и, индекси или други продукти с отделна спецификация брокерът може да
                    използва друг маржин. Ако виждаш реален Margin/Used Margin в платформата,
                    използвай <span className="font-semibold">Реален маржин от брокера</span>.
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      compact
                      hint="Например EUR."
                      label="Валута на акаунта"
                      onChange={setAccountCurrency}
                      value={accountCurrency}
                    />
                    <Field
                      compact
                      hint="Например USD, ако акцията/CFD инструментът се котира в долари."
                      label="Валута на инструмента"
                      onChange={setInstrumentCurrency}
                      value={instrumentCurrency}
                    />
                  </div>
                  <Field
                    compact
                    error={errors.fxRateInstrumentToAccount}
                    hint={`Колко ${accountCurrencyCode} е 1 ${instrumentCurrencyCode}. Например USD към EUR: 0.85.`}
                    label={`FX rate ${instrumentCurrencyCode} към ${accountCurrencyCode}`}
                    onChange={setFxRateInstrumentToAccount}
                    type="number"
                    value={fxRateInstrumentToAccount}
                  />

                  {marginMode === "account_leverage" ? (
                    <Field
                      compact
                      error={accountLeverageError}
                      hint="Ползвай го само ако инструментът следва account leverage."
                      label="Account leverage"
                      onChange={setAccountLeverageInput}
                      placeholder="1:1000"
                      value={accountLeverageInput}
                    />
                  ) : null}
                  {marginMode === "fixed_leverage" ? (
                    <Field
                      compact
                      error={fixedLeverageError}
                      hint="Въведи продуктовия leverage или го сметни от Margin %. Например 5% margin = 1:20."
                      label="Фиксиран ливъридж / продуктови leverage"
                      onChange={setFixedLeverageInput}
                      placeholder="1:20"
                      value={fixedLeverageInput}
                    />
                  ) : null}
                  {marginMode === "real_broker_margin" ? (
                    <>
                      <Field
                        compact
                        error={temporaryLeverageError}
                        hint="Предпазен сценарий при брокер, който временно намалява leverage-а около market open/close. Ако не знаеш точната стойност, остави 1:5."
                        label="Временен leverage прозорец"
                        onChange={setTemporaryLeverageInput}
                        placeholder="1:5"
                        value={temporaryLeverageInput}
                      />
                      <div className="rounded-xl border border-amber-200/18 bg-amber-300/[0.08] p-3 text-xs leading-5 text-amber-50">
                        Някои брокери временно намаляват leverage-а около open/close. Ако твоят
                        брокер има такова правило, въведи временния leverage. Ако не знаеш, остави{" "}
                        <span className="font-semibold">1:5</span> като предпазен сценарий.
                      </div>
                    </>
                  ) : null}
                  <Field
                    compact
                    error={errors.stopOutLevelPercent}
                    hint="Въведи ръчно, защото може да се различава според акаунт/entity. Пример: 20."
                    label="Stop-out level %"
                    onChange={setStopOutLevelPercent}
                    type="number"
                    value={stopOutLevelPercent}
                  />
                  <BrokerDataChecklist />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      className="rounded-xl border border-emerald-200/20 bg-emerald-300/10 px-3 py-2.5 text-left text-xs font-semibold text-emerald-50 transition hover:bg-emerald-300/15"
                      onClick={() => applyGenericExample("real")}
                      type="button"
                    >
                      Пример: реален маржин от платформа
                    </button>
                    <button
                      className="rounded-xl border border-amber-200/20 bg-amber-300/10 px-3 py-2.5 text-left text-xs font-semibold text-amber-50 transition hover:bg-amber-300/15"
                      onClick={() => applyGenericExample("fixed-20")}
                      type="button"
                    >
                      Пример: продукт 1:20
                    </button>
                    <button
                      className="rounded-xl border border-rose-200/20 bg-rose-300/10 px-3 py-2.5 text-left text-xs font-semibold text-rose-50 transition hover:bg-rose-300/15"
                      onClick={() => applyGenericExample("fixed-5")}
                      type="button"
                    >
                      Пример: продукт 1:5
                    </button>
                  </div>
                </div>
              ) : null}
              </div>
            </div>
          </section>

        <section className="rounded-2xl border border-white/10 bg-[#10192d]/88 p-4 shadow-[0_18px_55px_rgba(5,8,20,0.34)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-amber-200/75">
                Резултат
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">Риск и очакван резултат</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-slate-300">
              <Info className="size-4 text-amber-200" />
              {sideLabel(side)} · {marginModeLabel(marginMode)}
            </div>
          </div>

          {result.ok ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 lg:grid-cols-3">
                <AutoCloseResultCard compact result={result} currency={instrumentCurrencyCode} />
                <ResultCard
                  compact
                  hint={`Ефективен ливъридж около 1:${formatNumber(result.effectiveLeverage)}.`}
                  label="Нужен маржин"
                  tone={result.positionAllowed ? "gold" : "red"}
                  value={formatCurrency(result.requiredMargin, accountCurrencyCode)}
                />
                <ResultCard
                  compact
                  hint={`Резултат спрямо balance: ${result.returnPercentOnBalance.toFixed(1)}%.`}
                  label={result.grossProfitAccount >= 0 ? "Очаквана печалба" : "Очаквана загуба"}
                  tone={result.grossProfitAccount >= 0 ? "green" : "red"}
                  value={formatCurrency(Math.abs(result.grossProfitAccount), accountCurrencyCode)}
                />
              </div>

              {!result.positionAllowed ? (
                <div className="flex gap-3 rounded-xl border border-rose-200/20 bg-rose-300/[0.08] p-3 text-sm leading-6 text-rose-100">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                  <p>
                    Този обем изисква {formatCurrency(result.requiredMargin, accountCurrencyCode)}{" "}
                    маржин, а наличният equity/balance за сметката е по-нисък. Намали броя акции
                    или използвай реалния margin от платформата.
                  </p>
                </div>
              ) : null}

              <PriceRiskLine
                entryPrice={result.input.entryPrice}
                exitPrice={result.input.plannedExitPrice}
                autoClosePrice={result.displayAutoClosePrice}
                currency={instrumentCurrencyCode}
                side={side}
              />

              <div className="rounded-xl border border-amber-200/15 bg-amber-300/[0.08] p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-200" />
                  <div className="space-y-2 text-sm leading-6 text-slate-100">
                    <p>
                      Ако цената {side === "buy" ? "падне" : "се качи"} до{" "}
                      <span className="font-semibold text-rose-100">
                        {result.stopOutRange
                          ? `${formatCurrency(
                              result.stopOutRange.normal.displayAutoClosePrice,
                              instrumentCurrencyCode,
                            )} — ${formatCurrency(
                              result.stopOutRange.temporary.displayAutoClosePrice,
                              instrumentCurrencyCode,
                            )}`
                          : formatCurrency(result.displayAutoClosePrice, instrumentCurrencyCode)}
                      </span>
                      , позицията може да бъде затворена автоматично според въведените margin и
                      stop-out данни.
                    </p>
                    {result.stopOutRange ? (
                      <p>
                        Диапазонът показва къде може да бъде stop-out цената при реалния маржин от
                        платформата и при временен намален leverage около open/close на пазара.
                      </p>
                    ) : null}
                    <p>
                      Ако излезеш на{" "}
                      <span className="font-semibold text-emerald-100">
                        {formatCurrency(result.input.plannedExitPrice, instrumentCurrencyCode)}
                      </span>
                      ,{" "}
                      {result.grossProfitAccount >= 0 ? (
                        <>
                          печалбата ще е{" "}
                          <span className="font-semibold text-emerald-100">
                            {formatCurrency(result.grossProfitInstrument, instrumentCurrencyCode)} /{" "}
                            {formatCurrency(result.grossProfitAccount, accountCurrencyCode)}
                          </span>
                          .
                        </>
                      ) : (
                        <>
                          загубата ще е{" "}
                          <span className="font-semibold text-rose-100">
                            {formatCurrency(Math.abs(result.grossProfitInstrument), instrumentCurrencyCode)} /{" "}
                            {formatCurrency(Math.abs(result.grossProfitAccount), accountCurrencyCode)}
                          </span>
                          .
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-slate-400">Position value</p>
                  <p className="mt-1 font-semibold text-white">
                    {formatCurrency(result.positionValueInstrument, instrumentCurrencyCode)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatCurrency(result.positionValueAccount, accountCurrencyCode)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-slate-400">Free margin</p>
                  <p className="mt-1 font-semibold text-white">
                    {formatCurrency(result.freeMargin, accountCurrencyCode)}
                  </p>
                  <p className="text-xs text-slate-500">Margin level {result.marginLevel.toFixed(1)}%</p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-slate-400">Stop-out equity</p>
                  <p className="mt-1 font-semibold text-white">
                    {formatCurrency(result.stopOutEquity, accountCurrencyCode)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Max loss {formatCurrency(result.maxLossAccount, accountCurrencyCode)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-slate-400">Buffer per share</p>
                  <p className="mt-1 font-semibold text-white">
                    {formatCurrency(result.maxLossPerUnitInstrument, instrumentCurrencyCode)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatCurrency(result.maxLossPerUnitAccount, accountCurrencyCode)} на акция
                  </p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-slate-400">Expected profit</p>
                  <p className="mt-1 font-semibold text-white">
                    {formatCurrency(result.grossProfitInstrument, instrumentCurrencyCode)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatCurrency(result.grossProfitAccount, accountCurrencyCode)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-slate-400">Текущ P/L</p>
                  <p className="mt-1 font-semibold text-white">
                    {result.currentProfitInstrument === undefined
                      ? "-"
                      : formatCurrency(result.currentProfitInstrument, instrumentCurrencyCode)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {result.currentProfitAccount === undefined
                      ? "Попълни текуща цена"
                      : formatCurrency(result.currentProfitAccount, accountCurrencyCode)}
                  </p>
                </div>
              </div>

              <p className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-xs leading-5 text-slate-400">
                Най-точният режим е Реален маржин от брокера, защото използва маржина, който
                платформата вече е изчислила за конкретния инструмент, акаунт и валута.
                Калкулаторът е универсален: не приема правила на конкретен брокер, а смята по
                стойностите, които ти въведеш. Реалното затваряне може да се различи при spread,
                slippage, комисиони, overnight fee, market gap, промяна в margin изискването или
                различна stop-out политика.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-rose-200/20 bg-rose-300/[0.08] p-4 text-sm leading-6 text-rose-100">
              Попълни всички полета с валидни положителни стойности, за да видиш риска и очаквания
              резултат.
            </div>
          )}
          </section>
        </div>
      </div>

      <div className={cn(activeCalculator !== "partial-sales" && "hidden")}>
        <PartialSalesPanel />
      </div>
      <div className={cn(activeCalculator !== "accumulation" && "hidden")}>
        <AccumulationPanel />
      </div>
      <div className={cn(activeCalculator !== "portfolio" && "hidden")}>
        <PortfolioRiskManager />
      </div>
    </div>
  );
}
