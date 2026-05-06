"use client";

import {
  AlertTriangle,
  Calculator,
  Info,
  Layers3,
  Plus,
  ReceiptText,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  calculateAccumulatedPosition,
  calculateLeverageRisk,
  calculatePartialSales,
  parseLeverage,
  type MarginMode,
  type PositionSide,
} from "@/lib/risk-calculator";
import { cn } from "@/lib/utils";

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
    return "Real broker margin";
  }

  if (mode === "fixed_leverage") {
    return "Fixed leverage";
  }

  return "Account leverage";
}

function SideControl({
  value,
  onChange,
}: {
  value: PositionSide;
  onChange: (value: PositionSide) => void;
}) {
  return (
    <div className="grid gap-2 rounded-[22px] border border-white/8 bg-white/[0.035] p-2 sm:grid-cols-2">
      {(["buy", "sell"] as const).map((side) => (
        <button
          className={cn(
            "rounded-2xl px-4 py-3 text-left transition",
            value === side
              ? "border border-amber-200/35 bg-amber-300/16 text-amber-50"
              : "border border-transparent text-slate-300 hover:bg-white/[0.05]",
          )}
          key={side}
          onClick={() => onChange(side)}
          type="button"
        >
          <span className="block text-sm font-semibold">{sideLabel(side)}</span>
          <span className="mt-1 block text-xs leading-5 text-slate-400">
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
      title: "Real Broker Margin",
      text: "Най-точно: използва Margin/Used Margin от PU Prime.",
      badge: "Препоръчано",
    },
    {
      value: "fixed_leverage",
      title: "Fixed Leverage",
      text: "За CFD акции, ETF-и, индекси и продукти с фиксиран leverage.",
    },
    {
      value: "account_leverage",
      title: "Account Leverage",
      text: "Само за инструменти, които реално следват account leverage.",
    },
  ];

  return (
    <div className="grid gap-2 rounded-[22px] border border-white/8 bg-white/[0.035] p-2 lg:grid-cols-3">
      {options.map((option) => (
        <button
          className={cn(
            "rounded-2xl px-4 py-3 text-left transition",
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
          <span className="mt-1 block text-xs leading-5 text-slate-400">{option.text}</span>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  error?: string;
  type?: "text" | "number";
}) {
  return (
    <label className="block rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
      <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input
        className={cn(
          "mt-3 h-12 w-full rounded-2xl border bg-slate-950/45 px-4 text-base font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/15",
          error ? "border-rose-300/40" : "border-white/10",
        )}
        inputMode="decimal"
        min={type === "number" ? "0" : undefined}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      {error ? <span className="mt-2 block text-sm text-rose-200">{error}</span> : null}
      {hint && !error ? <span className="mt-2 block text-sm text-slate-400">{hint}</span> : null}
    </label>
  );
}

function ResultCard({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "gold" | "green" | "red" | "slate";
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[24px] border p-5 ring-1",
        tone === "gold" && "border-amber-200/18 bg-amber-300/[0.07] ring-amber-200/10",
        tone === "green" && "border-emerald-200/15 bg-emerald-300/[0.07] ring-emerald-200/10",
        tone === "red" && "border-rose-200/15 bg-rose-300/[0.07] ring-rose-200/10",
        tone === "slate" && "border-white/10 bg-white/[0.04] ring-white/10",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{hint}</p>
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
    <div className="rounded-[24px] border border-white/10 bg-slate-950/30 p-5">
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
          "mt-5 h-3 overflow-hidden rounded-full",
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
    <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">
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
  const [stopOutLevelPercent, setStopOutLevelPercent] = useState("20");
  const [fxRateInstrumentToAccount, setFxRateInstrumentToAccount] = useState("0.85");

  const accountLeverage = useMemo(() => parseLeverage(accountLeverageInput), [accountLeverageInput]);
  const fixedLeverage = useMemo(() => parseLeverage(fixedLeverageInput), [fixedLeverageInput]);
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
        equity: parseAmount(equity),
        usedMargin: parseAmount(usedMargin),
        currentPrice: parseOptionalAmount(currentPrice),
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
  const accountCurrencyCode = result.ok
    ? result.input.accountCurrency
    : accountCurrency.trim().toUpperCase() || "EUR";
  const instrumentCurrencyCode = result.ok
    ? result.input.instrumentCurrency
    : instrumentCurrency.trim().toUpperCase() || "USD";

  function applySofiPreset(mode: "real" | "normal" | "open-close") {
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
    setStopOutLevelPercent("20");
    setFxRateInstrumentToAccount("0.85");

    if (mode === "real") {
      setMarginMode("real_broker_margin");
      setFixedLeverageInput("1:20");
      return;
    }

    setMarginMode("fixed_leverage");
    setFixedLeverageInput(mode === "normal" ? "1:20" : "1:5");
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-[28px] border border-white/10 bg-[#10192d]/88 p-6 shadow-[0_30px_90px_rgba(5,8,20,0.45)]">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-300/18 text-amber-100">
              <Calculator className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-200/75">
                Входни данни
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">Параметри на позицията</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <MarginModeControl onChange={setMarginMode} value={marginMode} />
            <div className="rounded-[22px] border border-amber-200/18 bg-amber-300/[0.08] p-4 text-sm leading-6 text-amber-50">
              Account leverage не винаги важи за конкретния инструмент. За PU Prime Share CFDs
              използвай <span className="font-semibold">Fixed Leverage</span> или най-добре{" "}
              <span className="font-semibold">Real Broker Margin</span> от платформата.
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                className="rounded-2xl border border-emerald-200/20 bg-emerald-300/10 px-4 py-3 text-left text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/15"
                onClick={() => applySofiPreset("real")}
                type="button"
              >
                SOFI пример: реален Margin
              </button>
              <button
                className="rounded-2xl border border-amber-200/20 bg-amber-300/10 px-4 py-3 text-left text-sm font-semibold text-amber-50 transition hover:bg-amber-300/15"
                onClick={() => applySofiPreset("normal")}
                type="button"
              >
                PU Prime US Shares 1:20
              </button>
              <button
                className="rounded-2xl border border-rose-200/20 bg-rose-300/10 px-4 py-3 text-left text-sm font-semibold text-rose-50 transition hover:bg-rose-300/15"
                onClick={() => applySofiPreset("open-close")}
                type="button"
              >
                Open/Close прозорец 1:5
              </button>
            </div>
            <SideControl onChange={setSide} value={side} />
            <DirectionNote side={side} />
            <Field
              error={errors.accountBalance}
              hint="Balance от платформата. При примера: 50 EUR."
              label="Account balance"
              onChange={setAccountBalance}
              type="number"
              value={accountBalance}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                hint="Например EUR."
                label="Account currency"
                onChange={setAccountCurrency}
                value={accountCurrency}
              />
              <Field
                hint="Например USD за US Shares CFD."
                label="Instrument currency"
                onChange={setInstrumentCurrency}
                value={instrumentCurrency}
              />
            </div>
            <Field
              error={errors.fxRateInstrumentToAccount}
              hint={`Колко ${accountCurrencyCode} е 1 ${instrumentCurrencyCode}. Например USD към EUR: 0.85.`}
              label={`FX rate ${instrumentCurrencyCode} към ${accountCurrencyCode}`}
              onChange={setFxRateInstrumentToAccount}
              type="number"
              value={fxRateInstrumentToAccount}
            />
            {marginMode === "account_leverage" ? (
              <Field
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
                error={fixedLeverageError}
                hint="За PU Prime US Shares CFD често е 1:20, а около open/close може да е 1:5."
                label="Fixed leverage"
                onChange={setFixedLeverageInput}
                placeholder="1:20"
                value={fixedLeverageInput}
              />
            ) : null}
            {marginMode === "real_broker_margin" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  error={errors.equity}
                  hint="Equity от платформата. При примера: 48.36 EUR."
                  label="Equity"
                  onChange={setEquity}
                  type="number"
                  value={equity}
                />
                <Field
                  error={errors.usedMargin}
                  hint="Margin / Used Margin от платформата. При примера: 4.16 EUR."
                  label="Real broker margin"
                  onChange={setUsedMargin}
                  type="number"
                  value={usedMargin}
                />
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                error={errors.entryPrice}
                label="Цена на вход"
                onChange={setEntryPrice}
                type="number"
                value={entryPrice}
              />
              <Field
                error={errors.quantity}
                label="Брой акции"
                onChange={setShares}
                type="number"
                value={shares}
              />
            </div>
            <Field
              error={errors.currentPrice}
              hint="По желание: помага да свериш текущата плаваща печалба/загуба с платформата."
              label="Текуща цена"
              onChange={setCurrentPrice}
              type="number"
              value={currentPrice}
            />
            <Field
              error={errors.plannedExitPrice}
              label="Планирана цена на изход"
              onChange={setExitPrice}
              type="number"
              value={exitPrice}
            />
            <Field
              error={errors.stopOutLevelPercent}
              hint="Въведи ръчно, защото може да се различава според акаунт/entity. Пример: 20."
              label="Stop-out level %"
              onChange={setStopOutLevelPercent}
              type="number"
              value={stopOutLevelPercent}
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[#10192d]/88 p-6 shadow-[0_30px_90px_rgba(5,8,20,0.45)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-200/75">
                Резултат
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">Риск и очакван резултат</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300">
              <Info className="size-4 text-amber-200" />
              {sideLabel(side)} · {marginModeLabel(marginMode)}
            </div>
          </div>

          {result.ok ? (
            <div className="mt-6 space-y-5">
              <div className="grid gap-4 lg:grid-cols-3">
                <ResultCard
                  hint={`Буферът е ${formatCurrency(result.maxLossPerUnitInstrument, instrumentCurrencyCode)} на акция.`}
                  label="Авто затваряне"
                  tone="red"
                  value={formatCurrency(result.displayAutoClosePrice, instrumentCurrencyCode)}
                />
                <ResultCard
                  hint={`Ефективен ливъридж около 1:${formatNumber(result.effectiveLeverage)}.`}
                  label="Нужен маржин"
                  tone={result.positionAllowed ? "gold" : "red"}
                  value={formatCurrency(result.requiredMargin, accountCurrencyCode)}
                />
                <ResultCard
                  hint={`Резултат спрямо balance: ${result.returnPercentOnBalance.toFixed(1)}%.`}
                  label={result.grossProfitAccount >= 0 ? "Очаквана печалба" : "Очаквана загуба"}
                  tone={result.grossProfitAccount >= 0 ? "green" : "red"}
                  value={formatCurrency(Math.abs(result.grossProfitAccount), accountCurrencyCode)}
                />
              </div>

              {!result.positionAllowed ? (
                <div className="flex gap-3 rounded-[22px] border border-rose-200/20 bg-rose-300/[0.08] p-4 text-sm leading-6 text-rose-100">
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

              <div className="rounded-[24px] border border-amber-200/15 bg-amber-300/[0.08] p-5">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-1 size-5 shrink-0 text-amber-200" />
                  <div className="space-y-3 text-base leading-7 text-slate-100">
                    <p>
                      Ако цената {side === "buy" ? "падне" : "се качи"} до{" "}
                      <span className="font-semibold text-rose-100">
                        {formatCurrency(result.displayAutoClosePrice, instrumentCurrencyCode)}
                      </span>
                      , позицията ще се затвори автоматично по този PU Prime margin модел.
                    </p>
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
                <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-slate-400">Position value</p>
                  <p className="mt-1 font-semibold text-white">
                    {formatCurrency(result.positionValueInstrument, instrumentCurrencyCode)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatCurrency(result.positionValueAccount, accountCurrencyCode)}
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-slate-400">Free margin</p>
                  <p className="mt-1 font-semibold text-white">
                    {formatCurrency(result.freeMargin, accountCurrencyCode)}
                  </p>
                  <p className="text-xs text-slate-500">Margin level {result.marginLevel.toFixed(1)}%</p>
                </div>
                <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-slate-400">Stop-out equity</p>
                  <p className="mt-1 font-semibold text-white">
                    {formatCurrency(result.stopOutEquity, accountCurrencyCode)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Max loss {formatCurrency(result.maxLossAccount, accountCurrencyCode)}
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-slate-400">Buffer per share</p>
                  <p className="mt-1 font-semibold text-white">
                    {formatCurrency(result.maxLossPerUnitInstrument, instrumentCurrencyCode)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatCurrency(result.maxLossPerUnitAccount, accountCurrencyCode)} на акция
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-slate-400">Expected profit</p>
                  <p className="mt-1 font-semibold text-white">
                    {formatCurrency(result.grossProfitInstrument, instrumentCurrencyCode)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatCurrency(result.grossProfitAccount, accountCurrencyCode)}
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
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

              <p className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
                Най-точният режим е Real Broker Margin, защото използва реалния margin от PU Prime.
                Все пак реалното затваряне може да се различи заради spread, slippage, комисиони,
                overnight fee, market gap или промяна в fixed leverage около отваряне/затваряне.
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-[24px] border border-rose-200/20 bg-rose-300/[0.08] p-5 text-sm leading-6 text-rose-100">
              Попълни всички полета с валидни положителни стойности, за да видиш риска и очаквания
              резултат.
            </div>
          )}
        </section>
      </div>

      <PartialSalesPanel />
      <AccumulationPanel />
    </div>
  );
}
