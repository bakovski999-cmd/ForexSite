"use client";

import { Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { SavedPortfolioPosition } from "@/lib/portfolio-risk";
import { cn } from "@/lib/utils";

type LotSale = {
  checked: boolean;
  sharesToSell: string;
  sellPrice: string;
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  positions?: SavedPortfolioPosition[];
};

function parseNum(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : Number.NaN;
}

function fmtCurr(value: number, currency: string): string {
  if (!Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function SellPositionDrawer({
  position,
  fxRate,
  accountCurrency,
  onClose,
  onSaved,
}: {
  position: SavedPortfolioPosition;
  fxRate: number;
  accountCurrency: string;
  onClose: () => void;
  onSaved: (positions: SavedPortfolioPosition[]) => void;
}) {
  const instrumentCurrency = position.instrumentCurrency;

  const lots = useMemo(
    () => (position.lots ?? []).filter((lot) => lot.quantity > 0),
    [position.lots],
  );

  const [lotSales, setLotSales] = useState<Record<string, LotSale>>(() => {
    const initial: Record<string, LotSale> = {};

    lots.forEach((lot) => {
      initial[lot.id] = {
        checked: false,
        sharesToSell: String(lot.quantity),
        sellPrice: "",
      };
    });

    return initial;
  });

  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleLot(lotId: string) {
    setLotSales((current) => ({
      ...current,
      [lotId]: { ...current[lotId], checked: !current[lotId].checked },
    }));
  }

  function updateLotSale(lotId: string, field: "sharesToSell" | "sellPrice", value: string) {
    setLotSales((current) => ({
      ...current,
      [lotId]: { ...current[lotId], [field]: value },
    }));
  }

  const summary = useMemo(() => {
    const checkedLots = lots.filter((lot) => lotSales[lot.id]?.checked);

    const perLot = checkedLots.map((lot) => {
      const sale = lotSales[lot.id];
      const sharesToSell = parseNum(sale?.sharesToSell ?? "");
      const sellPrice = parseNum(sale?.sellPrice ?? "");
      const lotValid =
        Number.isFinite(sharesToSell) &&
        sharesToSell > 0 &&
        sharesToSell <= lot.quantity &&
        Number.isFinite(sellPrice) &&
        sellPrice > 0;

      const proceeds = lotValid ? sharesToSell * sellPrice : 0;
      const costBasis = lotValid ? sharesToSell * lot.entryPrice : 0;
      const realizedPnLInstrument =
        position.direction === "sell" ? costBasis - proceeds : proceeds - costBasis;
      const realizedPnLAccount =
        Number.isFinite(fxRate) && fxRate > 0
          ? realizedPnLInstrument / fxRate
          : realizedPnLInstrument;

      return {
        lot,
        sharesToSell,
        sellPrice,
        realizedPnLInstrument,
        realizedPnLAccount,
        lotValid,
      };
    });
    const totals = perLot.reduce(
      (acc, item) => ({
        totalShares: acc.totalShares + (item.lotValid ? item.sharesToSell : 0),
        proceedsInstrument:
          acc.proceedsInstrument + (item.lotValid ? item.sharesToSell * item.sellPrice : 0),
        costBasisInstrument:
          acc.costBasisInstrument + (item.lotValid ? item.sharesToSell * item.lot.entryPrice : 0),
      }),
      {
        totalShares: 0,
        proceedsInstrument: 0,
        costBasisInstrument: 0,
      },
    );
    const allValid = perLot.every((item) => item.lotValid);

    const realizedPnLInstrument =
      position.direction === "sell"
        ? totals.costBasisInstrument - totals.proceedsInstrument
        : totals.proceedsInstrument - totals.costBasisInstrument;
    const realizedPnLAccount =
      Number.isFinite(fxRate) && fxRate > 0
        ? realizedPnLInstrument / fxRate
        : realizedPnLInstrument;

    return {
      totalShares: totals.totalShares,
      proceedsInstrument: totals.proceedsInstrument,
      costBasisInstrument: totals.costBasisInstrument,
      realizedPnLInstrument,
      realizedPnLAccount,
      perLot,
      allValid,
      hasSelection: checkedLots.length > 0,
    };
  }, [lots, lotSales, fxRate, position.direction]);

  async function handleSave() {
    const validationErrors: string[] = [];

    if (!summary.hasSelection) {
      validationErrors.push("Избери поне един лот за продажба.");
    } else if (!summary.allValid) {
      validationErrors.push(
        "Провери количествата и цените — всеки избран лот трябва да има валидно количество и цена.",
      );
    }

    if (validationErrors.length > 0) {
      setError(validationErrors.join(" "));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const sales = summary.perLot
        .filter((item) => item.lotValid && item.sharesToSell > 0)
        .map((item) => ({
          lotId: item.lot.id,
          sharesToSell: item.sharesToSell,
          sellPrice: item.sellPrice,
        }));

      const response = await fetch("/api/portfolio-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sell-lots",
          positionId: position.id,
          fxRate,
          sales,
          notes: notes.trim() || null,
        }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? "Грешка при продажбата.");
      }

      onSaved(data.positions ?? []);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      <div
        aria-label="Продай лотове"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-[#0b1322] shadow-2xl"
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {position.symbol}
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-white">Продай лотове</h2>
          </div>
          <button
            aria-label="Затвори"
            className="inline-flex size-8 items-center justify-center rounded-md border border-white/10 text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="border-b border-white/8 bg-white/[0.02] px-4 py-2.5 text-xs text-slate-400">
          {position.quantity} акции · {lots.length}{" "}
          {lots.length === 1 ? "лот" : lots.length > 1 && lots.length < 5 ? "лота" : "лота"}
          <span className="ml-2 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
            Цени в {instrumentCurrency}
          </span>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {lots.length === 0 ? (
            <p className="text-sm text-slate-400">Няма лотове за продажба.</p>
          ) : (
            lots.map((lot, index) => {
              const sale = lotSales[lot.id];
              const isChecked = sale?.checked ?? false;
              const sharesToSell = parseNum(sale?.sharesToSell ?? "");
              const sellPrice = parseNum(sale?.sellPrice ?? "");
              const pnlInstrument =
                isChecked && Number.isFinite(sharesToSell) && Number.isFinite(sellPrice)
                  ? position.direction === "sell"
                    ? (lot.entryPrice - sellPrice) * sharesToSell
                    : (sellPrice - lot.entryPrice) * sharesToSell
                  : null;
              const pnlAccount =
                pnlInstrument !== null && Number.isFinite(fxRate) && fxRate > 0
                  ? pnlInstrument / fxRate
                  : null;

              return (
                <div
                  className={cn(
                    "rounded-lg border px-3 py-2.5 transition",
                    isChecked
                      ? "border-amber-200/30 bg-amber-300/[0.06]"
                      : "border-white/10 bg-white/[0.025]",
                  )}
                  key={lot.id}
                >
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      checked={isChecked}
                      className="size-4 accent-amber-400"
                      onChange={() => toggleLot(lot.id)}
                      type="checkbox"
                    />
                    <span className="text-sm font-semibold text-white">Лот #{index + 1}</span>
                    <span className="text-xs text-slate-500">
                      entry {fmtCurr(lot.entryPrice, instrumentCurrency)} · {lot.quantity} налични
                    </span>
                  </label>

                  {isChecked ? (
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          Продай (бр.)
                        </label>
                        <input
                          className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white placeholder-slate-600 focus:border-amber-300/40 focus:outline-none"
                          max={lot.quantity}
                          min={0}
                          onChange={(e) => updateLotSale(lot.id, "sharesToSell", e.target.value)}
                          placeholder={String(lot.quantity)}
                          step="any"
                          type="number"
                          value={sale?.sharesToSell ?? ""}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          Цена ({instrumentCurrency})
                        </label>
                        <input
                          className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white placeholder-slate-600 focus:border-amber-300/40 focus:outline-none"
                          onChange={(e) => updateLotSale(lot.id, "sellPrice", e.target.value)}
                          placeholder="0.00"
                          step="any"
                          type="number"
                          value={sale?.sellPrice ?? ""}
                        />
                      </div>

                      {pnlInstrument !== null ? (
                        <div className="col-span-2 text-xs">
                          <span className="text-slate-500">Realized P/L: </span>
                          <span
                            className={cn(
                              "font-semibold",
                              pnlInstrument >= 0 ? "text-emerald-300" : "text-rose-300",
                            )}
                          >
                            {fmtCurr(pnlInstrument, instrumentCurrency)}
                            {pnlAccount !== null && instrumentCurrency !== accountCurrency ? (
                              <span className="ml-1 font-normal text-slate-500">
                                (~{fmtCurr(pnlAccount, accountCurrency)})
                              </span>
                            ) : null}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}

          <div className="pt-1">
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Бележки{" "}
              <span className="ml-1 text-[10px] font-normal text-slate-600">(по избор)</span>
            </label>
            <input
              className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-amber-300/40 focus:outline-none"
              onChange={(e) => setNotes(e.target.value)}
              placeholder="напр. Частична продажба при таргет"
              value={notes}
            />
          </div>

          {summary.hasSelection && summary.allValid ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.025] px-3 py-3 text-xs">
              <p className="mb-2 font-semibold text-slate-300">Обобщение</p>
              <div className="space-y-1.5 text-slate-400">
                <div className="flex justify-between">
                  <span>Общо за продажба</span>
                  <span className="text-white">{summary.totalShares} акции</span>
                </div>
                <div className="flex justify-between">
                  <span>Постъпление</span>
                  <span className="text-white">
                    {fmtCurr(summary.proceedsInstrument, instrumentCurrency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Себестойност</span>
                  <span className="text-white">
                    {fmtCurr(summary.costBasisInstrument, instrumentCurrency)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-white/8 pt-1">
                  <span>Realized P/L</span>
                  <span
                    className={cn(
                      "font-semibold",
                      summary.realizedPnLInstrument >= 0 ? "text-emerald-300" : "text-rose-300",
                    )}
                  >
                    {fmtCurr(summary.realizedPnLInstrument, instrumentCurrency)}
                    {instrumentCurrency !== accountCurrency ? (
                      <span className="ml-1 font-normal text-slate-500">
                        (~{fmtCurr(summary.realizedPnLAccount, accountCurrency)})
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-rose-200/20 bg-rose-300/[0.08] px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-white/10 px-4 py-3">
          <button
            className="flex-1 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.07]"
            onClick={onClose}
            type="button"
          >
            Откажи
          </button>
          <button
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
              "border-emerald-200/20 bg-emerald-300/10 text-emerald-50 hover:bg-emerald-300/15",
            )}
            disabled={saving || !summary.hasSelection || !summary.allValid}
            onClick={() => void handleSave()}
            type="button"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Запази продажбата
          </button>
        </div>
      </div>
    </>
  );
}
