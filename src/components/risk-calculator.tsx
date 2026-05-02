"use client";

import { AlertTriangle, Calculator, Info, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { calculateLeverageRisk, parseLeverage } from "@/lib/risk-calculator";
import { cn } from "@/lib/utils";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("bg-BG", {
  maximumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function parseAmount(value: string) {
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
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
  liquidationPrice,
  buyPrice,
  plannedSellPrice,
}: {
  liquidationPrice: number;
  buyPrice: number;
  plannedSellPrice: number;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-950/30 p-5">
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-rose-200/75">
            Авто затваряне
          </p>
          <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(liquidationPrice)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-amber-200/75">
            Вход
          </p>
          <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(buyPrice)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-emerald-200/75">
            План продажба
          </p>
          <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(plannedSellPrice)}</p>
        </div>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-gradient-to-r from-rose-300/80 via-amber-200/85 to-emerald-300/80" />
      <div className="mt-2 grid grid-cols-3 text-xs text-slate-500">
        <span>Риск</span>
        <span className="text-center">Цена на вход</span>
        <span className="text-right">Цел</span>
      </div>
    </div>
  );
}

export function RiskCalculator() {
  const [investedAmount, setInvestedAmount] = useState("1000");
  const [leverageInput, setLeverageInput] = useState("1:100");
  const [buyPrice, setBuyPrice] = useState("50");
  const [shares, setShares] = useState("100");
  const [plannedSellPrice, setPlannedSellPrice] = useState("60");

  const leverage = useMemo(() => parseLeverage(leverageInput), [leverageInput]);
  const result = useMemo(
    () =>
      calculateLeverageRisk({
        investedAmount: parseAmount(investedAmount),
        leverage: leverage ?? Number.NaN,
        buyPrice: parseAmount(buyPrice),
        shares: parseAmount(shares),
        plannedSellPrice: parseAmount(plannedSellPrice),
      }),
    [buyPrice, investedAmount, leverage, plannedSellPrice, shares],
  );

  const errors = result.ok ? {} : result.errors;
  const leverageError = !leverage ? "Въведи ливъридж като 1:1000 или 1000." : errors.leverage;

  return (
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
          <Field
            error={errors.investedAmount}
            hint="Капиталът/маржинът, който приемаш, че може да се изчерпи."
            label="Сума, която инвестираш"
            onChange={setInvestedAmount}
            type="number"
            value={investedAmount}
          />
          <Field
            error={leverageError}
            hint="Приема 1:1000, 1/1000 или само 1000."
            label="Ливъридж"
            onChange={setLeverageInput}
            placeholder="1:1000"
            value={leverageInput}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              error={errors.buyPrice}
              label="Цена на покупка"
              onChange={setBuyPrice}
              type="number"
              value={buyPrice}
            />
            <Field
              error={errors.shares}
              label="Брой акции"
              onChange={setShares}
              type="number"
              value={shares}
            />
          </div>
          <Field
            error={errors.plannedSellPrice}
            label="Планирана продажна цена"
            onChange={setPlannedSellPrice}
            type="number"
            value={plannedSellPrice}
          />
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-[#10192d]/88 p-6 shadow-[0_30px_90px_rgba(5,8,20,0.45)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-200/75">
              Резултат
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">Риск и очаквана печалба</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300">
            <Info className="size-4 text-amber-200" />
            Опростен модел за long позиция
          </div>
        </div>

        {result.ok ? (
          <div className="mt-6 space-y-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <ResultCard
                hint={`Буферът до тази цена е ${formatCurrency(result.liquidationDrop)} на акция.`}
                label="Авто затваряне"
                tone="red"
                value={formatCurrency(result.displayLiquidationPrice)}
              />
              <ResultCard
                hint={`Обем ${formatCurrency(result.notional)} при ливъридж ${formatNumber(result.input.leverage)}x.`}
                label="Нужен маржин"
                tone={result.positionAllowed ? "gold" : "red"}
                value={formatCurrency(result.requiredMargin)}
              />
              <ResultCard
                hint={`${result.expectedReturnPct >= 0 ? "Доходност" : "Отрицателен резултат"} спрямо сумата: ${result.expectedReturnPct.toFixed(1)}%.`}
                label={result.expectedProfit >= 0 ? "Очаквана печалба" : "Очаквана загуба"}
                tone={result.expectedProfit >= 0 ? "green" : "red"}
                value={formatCurrency(Math.abs(result.expectedProfit))}
              />
            </div>

            {!result.positionAllowed ? (
              <div className="flex gap-3 rounded-[22px] border border-rose-200/20 bg-rose-300/[0.08] p-4 text-sm leading-6 text-rose-100">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                <p>
                  Този обем изисква {formatCurrency(result.requiredMargin)} маржин, а въведената
                  сума е {formatCurrency(result.input.investedAmount)}. Намали броя акции, увеличи
                  сумата или използвай по-висок ливъридж, ако брокерът го позволява.
                </p>
              </div>
            ) : null}

            <PriceRiskLine
              buyPrice={result.input.buyPrice}
              liquidationPrice={result.displayLiquidationPrice}
              plannedSellPrice={result.input.plannedSellPrice}
            />

            <div className="rounded-[24px] border border-amber-200/15 bg-amber-300/[0.08] p-5">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-1 size-5 shrink-0 text-amber-200" />
                <div className="space-y-3 text-base leading-7 text-slate-100">
                  <p>
                    Ако цената падне до{" "}
                    <span className="font-semibold text-rose-100">
                      {formatCurrency(result.displayLiquidationPrice)}
                    </span>
                    , позицията ще се затвори автоматично по този опростен модел.
                  </p>
                  <p>
                    Ако продадеш на{" "}
                    <span className="font-semibold text-emerald-100">
                      {formatCurrency(result.input.plannedSellPrice)}
                    </span>
                    ,{" "}
                    {result.expectedProfit >= 0 ? (
                      <>
                        печалбата ще е{" "}
                        <span className="font-semibold text-emerald-100">
                          {formatCurrency(result.expectedProfit)}
                        </span>
                        .
                      </>
                    ) : (
                      <>
                        загубата ще е{" "}
                        <span className="font-semibold text-rose-100">
                          {formatCurrency(Math.abs(result.expectedProfit))}
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
                <p className="text-slate-400">Максимален обем</p>
                <p className="mt-1 font-semibold text-white">{formatCurrency(result.maxNotional)}</p>
              </div>
              <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                <p className="text-slate-400">Макс. акции при входа</p>
                <p className="mt-1 font-semibold text-white">{formatNumber(result.maxShares)}</p>
              </div>
              <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                <p className="text-slate-400">Използван маржин</p>
                <p className="mt-1 font-semibold text-white">{result.marginUsagePct.toFixed(1)}%</p>
              </div>
            </div>

            <p className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
              Реален брокер може да затвори позицията по-рано заради maintenance margin, stop-out
              ниво, spread, комисиони, swap или бързо движение на пазара. Използвай това като
              ориентир, не като гарантирана брокерска цена.
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
  );
}
