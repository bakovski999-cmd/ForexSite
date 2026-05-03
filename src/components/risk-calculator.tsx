"use client";

import {
  AlertTriangle,
  Calculator,
  ChevronsUpDown,
  Info,
  Repeat2,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  calculateLeverageRisk,
  calculateReverseLeverageRisk,
  parseLeverage,
  type PositionSide,
} from "@/lib/risk-calculator";
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

function sideLabel(side: PositionSide) {
  return side === "long" ? "Long / Купувам" : "Short / Продавам";
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
      {(["long", "short"] as const).map((side) => (
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
            {side === "long"
              ? "Печелиш при покачване, рискът е спад."
              : "Печелиш при спад, рискът е покачване."}
          </span>
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
  liquidationPrice,
  entryPrice,
  exitPrice,
}: {
  side: PositionSide;
  liquidationPrice: number;
  entryPrice: number;
  exitPrice: number;
}) {
  const columns =
    side === "long"
      ? [
          { label: "Авто затваряне", value: liquidationPrice, tone: "text-rose-200/75" },
          { label: "Вход", value: entryPrice, tone: "text-amber-200/75" },
          { label: "План изход", value: exitPrice, tone: "text-emerald-200/75" },
        ]
      : [
          { label: "План изход", value: exitPrice, tone: "text-emerald-200/75" },
          { label: "Вход", value: entryPrice, tone: "text-amber-200/75" },
          { label: "Авто затваряне", value: liquidationPrice, tone: "text-rose-200/75" },
        ];

  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-950/30 p-5">
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        {columns.map((column) => (
          <div key={column.label}>
            <p className={cn("text-xs font-medium uppercase tracking-[0.12em]", column.tone)}>
              {column.label}
            </p>
            <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(column.value)}</p>
          </div>
        ))}
      </div>
      <div
        className={cn(
          "mt-5 h-3 overflow-hidden rounded-full",
          side === "long"
            ? "bg-gradient-to-r from-rose-300/80 via-amber-200/85 to-emerald-300/80"
            : "bg-gradient-to-r from-emerald-300/80 via-amber-200/85 to-rose-300/80",
        )}
      />
      <div className="mt-2 grid grid-cols-3 text-xs text-slate-500">
        <span>{side === "long" ? "Риск при спад" : "Цел при спад"}</span>
        <span className="text-center">Цена на вход</span>
        <span className="text-right">{side === "long" ? "Цел при ръст" : "Риск при ръст"}</span>
      </div>
    </div>
  );
}

function DirectionNote({ side }: { side: PositionSide }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">
      {side === "long" ? (
        <p>
          <span className="font-semibold text-emerald-100">Long</span> означава, че купуваш акцията
          и печелиш, ако цената се покачи. Рискът е цената да падне и да изчерпи зададения маржин.
        </p>
      ) : (
        <p>
          <span className="font-semibold text-rose-100">Short</span> означава, че продаваш чрез
          ливъридж и печелиш, ако цената падне. Рискът е цената да се качи срещу позицията.
        </p>
      )}
    </div>
  );
}

function ReverseCalculatorPanel() {
  const [side, setSide] = useState<PositionSide>("short");
  const [maxRisk, setMaxRisk] = useState("1000");
  const [leverageInput, setLeverageInput] = useState("1:100");
  const [entryPrice, setEntryPrice] = useState("50");
  const [stopPrice, setStopPrice] = useState("60");
  const [exitPrice, setExitPrice] = useState("40");

  const leverage = useMemo(() => parseLeverage(leverageInput), [leverageInput]);
  const result = useMemo(
    () =>
      calculateReverseLeverageRisk({
        side,
        maxRisk: parseAmount(maxRisk),
        leverage: leverage ?? Number.NaN,
        entryPrice: parseAmount(entryPrice),
        stopPrice: parseAmount(stopPrice),
        exitPrice: parseAmount(exitPrice),
      }),
    [entryPrice, exitPrice, leverage, maxRisk, side, stopPrice],
  );

  const errors = result.ok ? {} : result.errors;
  const leverageError = !leverage ? "Въведи ливъридж като 1:1000 или 1000." : errors.leverage;

  function changeSide(nextSide: PositionSide) {
    setSide(nextSide);

    if (nextSide === "long") {
      setStopPrice("40");
      setExitPrice("60");
    } else {
      setStopPrice("60");
      setExitPrice("40");
    }
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-[#10192d]/88 p-6 shadow-[0_30px_90px_rgba(5,8,20,0.45)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-300/18 text-amber-100">
            <Repeat2 className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-200/75">
              Обратен калкулатор
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">Колко акции мога да взема?</h2>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300">
          <ChevronsUpDown className="size-4 text-amber-200" />
          Смята максимум по риск и маржин
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="space-y-4">
          <SideControl onChange={changeSide} value={side} />
          <Field
            error={errors.maxRisk}
            hint="Колко максимум допускаш да се загуби, ако цената стигне стоп/затваряне."
            label="Максимален риск / маржин"
            onChange={setMaxRisk}
            type="number"
            value={maxRisk}
          />
          <Field
            error={leverageError}
            hint="Приема 1:1000, 1/1000 или само 1000."
            label="Ливъридж"
            onChange={setLeverageInput}
            placeholder="1:1000"
            value={leverageInput}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              error={errors.entryPrice}
              label="Цена на вход"
              onChange={setEntryPrice}
              type="number"
              value={entryPrice}
            />
            <Field
              error={errors.stopPrice}
              label="Стоп / авто затваряне"
              onChange={setStopPrice}
              type="number"
              value={stopPrice}
            />
            <Field
              error={errors.exitPrice}
              label="План изход"
              onChange={setExitPrice}
              type="number"
              value={exitPrice}
            />
          </div>
        </div>

        {result.ok ? (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <ResultCard
                hint={`Ограничението идва от ${result.limitingFactor === "risk" ? "разстоянието до стопа" : "маржина и ливъриджа"}.`}
                label="Макс. акции"
                tone="gold"
                value={formatNumber(result.recommendedShares)}
              />
              <ResultCard
                hint={`Рискът на една акция е ${formatCurrency(result.riskPerShare)}.`}
                label="Загуба при стоп"
                tone="red"
                value={formatCurrency(result.lossAtStop)}
              />
              <ResultCard
                hint={`${result.expectedReturnPct >= 0 ? "Доходност" : "Отрицателен резултат"} спрямо риска: ${result.expectedReturnPct.toFixed(1)}%.`}
                label={result.expectedProfit >= 0 ? "Потенциална печалба" : "Потенциална загуба"}
                tone={result.expectedProfit >= 0 ? "green" : "red"}
                value={formatCurrency(Math.abs(result.expectedProfit))}
              />
            </div>

            <div className="rounded-[24px] border border-amber-200/15 bg-amber-300/[0.08] p-5">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-1 size-5 shrink-0 text-amber-200" />
                <div className="space-y-3 text-base leading-7 text-slate-100">
                  <p>
                    При този риск можеш да вземеш до{" "}
                    <span className="font-semibold text-amber-100">
                      {formatNumber(result.recommendedShares)} акции
                    </span>
                    .
                  </p>
                  <p>
                    Ако цената стигне{" "}
                    <span className="font-semibold text-rose-100">
                      {formatCurrency(result.input.stopPrice)}
                    </span>
                    , очакваната загуба е приблизително{" "}
                    <span className="font-semibold text-rose-100">
                      {formatCurrency(result.lossAtStop)}
                    </span>
                    .
                  </p>
                  <p>
                    Ако излезеш на{" "}
                    <span className="font-semibold text-emerald-100">
                      {formatCurrency(result.input.exitPrice)}
                    </span>
                    , очакваният резултат е{" "}
                    <span
                      className={cn(
                        "font-semibold",
                        result.expectedProfit >= 0 ? "text-emerald-100" : "text-rose-100",
                      )}
                    >
                      {result.expectedProfit >= 0 ? "" : "-"}
                      {formatCurrency(Math.abs(result.expectedProfit))}
                    </span>
                    .
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
              <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                <p className="text-slate-400">Акции по риск</p>
                <p className="mt-1 font-semibold text-white">{formatNumber(result.sharesByRisk)}</p>
              </div>
              <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                <p className="text-slate-400">Акции по маржин</p>
                <p className="mt-1 font-semibold text-white">{formatNumber(result.sharesByMargin)}</p>
              </div>
              <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                <p className="text-slate-400">Нужен маржин</p>
                <p className="mt-1 font-semibold text-white">{formatCurrency(result.requiredMargin)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] border border-rose-200/20 bg-rose-300/[0.08] p-5 text-sm leading-6 text-rose-100">
            Попълни валидни стойности. При Long стопът трябва да е под входа; при Short стопът
            трябва да е над входа.
          </div>
        )}
      </div>
    </section>
  );
}

export function RiskCalculator() {
  const [side, setSide] = useState<PositionSide>("long");
  const [investedAmount, setInvestedAmount] = useState("1000");
  const [leverageInput, setLeverageInput] = useState("1:100");
  const [entryPrice, setEntryPrice] = useState("50");
  const [shares, setShares] = useState("100");
  const [exitPrice, setExitPrice] = useState("60");

  const leverage = useMemo(() => parseLeverage(leverageInput), [leverageInput]);
  const result = useMemo(
    () =>
      calculateLeverageRisk({
        side,
        investedAmount: parseAmount(investedAmount),
        leverage: leverage ?? Number.NaN,
        entryPrice: parseAmount(entryPrice),
        shares: parseAmount(shares),
        exitPrice: parseAmount(exitPrice),
      }),
    [entryPrice, exitPrice, investedAmount, leverage, shares, side],
  );

  const errors = result.ok ? {} : result.errors;
  const leverageError = !leverage ? "Въведи ливъридж като 1:1000 или 1000." : errors.leverage;

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
            <SideControl onChange={setSide} value={side} />
            <DirectionNote side={side} />
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
                error={errors.entryPrice}
                label="Цена на вход"
                onChange={setEntryPrice}
                type="number"
                value={entryPrice}
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
              error={errors.exitPrice}
              label="Планирана цена на изход"
              onChange={setExitPrice}
              type="number"
              value={exitPrice}
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
              {sideLabel(side)}
            </div>
          </div>

          {result.ok ? (
            <div className="mt-6 space-y-5">
              <div className="grid gap-4 lg:grid-cols-3">
                <ResultCard
                  hint={`Буферът до тази цена е ${formatCurrency(result.liquidationMove)} на акция.`}
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
                    сума е {formatCurrency(result.input.investedAmount)}. Намали броя акции,
                    увеличи сумата или използвай по-висок ливъридж, ако брокерът го позволява.
                  </p>
                </div>
              ) : null}

              <PriceRiskLine
                entryPrice={result.input.entryPrice}
                exitPrice={result.input.exitPrice}
                liquidationPrice={result.displayLiquidationPrice}
                side={side}
              />

              <div className="rounded-[24px] border border-amber-200/15 bg-amber-300/[0.08] p-5">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-1 size-5 shrink-0 text-amber-200" />
                  <div className="space-y-3 text-base leading-7 text-slate-100">
                    <p>
                      Ако цената {side === "long" ? "падне" : "се качи"} до{" "}
                      <span className="font-semibold text-rose-100">
                        {formatCurrency(result.displayLiquidationPrice)}
                      </span>
                      , позицията ще се затвори автоматично по този опростен модел.
                    </p>
                    <p>
                      Ако излезеш на{" "}
                      <span className="font-semibold text-emerald-100">
                        {formatCurrency(result.input.exitPrice)}
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
                Реален брокер може да затвори позицията по-рано заради maintenance margin,
                stop-out ниво, spread, комисиони, swap или бързо движение на пазара. Използвай това
                като ориентир, не като гарантирана брокерска цена.
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

      <ReverseCalculatorPanel />
    </div>
  );
}
