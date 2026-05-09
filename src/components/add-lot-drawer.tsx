"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { SavedPortfolioPosition } from "@/lib/portfolio-risk";

type AddLotForm = {
  entryPrice: string;
  quantity: string;
  plannedExitPrice: string;
  notes: string;
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

export function AddLotDrawer({
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
  const existingLots = position.lots ?? [];
  const currentTotalShares = position.quantity;
  const currentAvgEntry = position.entryPrice;

  const [form, setForm] = useState<AddLotForm>({
    entryPrice: "",
    quantity: "",
    plannedExitPrice: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(field: keyof AddLotForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  const preview = useMemo(() => {
    const ep = parseNum(form.entryPrice);
    const qty = parseNum(form.quantity);

    if (!Number.isFinite(ep) || ep <= 0 || !Number.isFinite(qty) || qty <= 0) {
      return null;
    }

    const newTotalShares = currentTotalShares + qty;
    const totalCostInstrument = currentAvgEntry * currentTotalShares + ep * qty;
    const newAvgEntry = totalCostInstrument / newTotalShares;
    const costInstrument = ep * qty;
    const costAccount = Number.isFinite(fxRate) && fxRate > 0 ? costInstrument / fxRate : costInstrument;

    return { newTotalShares, newAvgEntry, costInstrument, costAccount };
  }, [form.entryPrice, form.quantity, currentTotalShares, currentAvgEntry, fxRate]);

  async function handleSave() {
    const ep = parseNum(form.entryPrice);
    const qty = parseNum(form.quantity);
    const validationErrors: string[] = [];

    if (!Number.isFinite(ep) || ep <= 0) {
      validationErrors.push("Цената трябва да е положително число.");
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      validationErrors.push("Количеството трябва да е положително число.");
    }

    if (validationErrors.length > 0) {
      setError(validationErrors.join(" "));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const plannedExit = parseNum(form.plannedExitPrice);
      const response = await fetch("/api/portfolio-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-lot",
          lot: {
            positionId: position.id,
            entryPrice: ep,
            quantity: qty,
            plannedExitPrice: Number.isFinite(plannedExit) && plannedExit > 0 ? plannedExit : null,
            notes: form.notes.trim() || null,
            displayOrder: existingLots.length,
          },
        }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? "Грешка при записване.");
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
        aria-label="Добави лот"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-[#0b1322] shadow-2xl"
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {position.symbol}
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-white">Добави лот</h2>
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

        <div className="border-b border-white/8 bg-white/[0.02] px-4 py-3">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-slate-500">Акции</p>
              <p className="mt-0.5 font-semibold text-slate-200">
                {currentTotalShares.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Лотове</p>
              <p className="mt-0.5 font-semibold text-slate-200">{existingLots.length}</p>
            </div>
            <div>
              <p className="text-slate-500">Ср. entry</p>
              <p className="mt-0.5 font-semibold text-slate-200">
                {fmtCurr(currentAvgEntry, instrumentCurrency)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Цена на влизане{" "}
                <span className="ml-1 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                  {instrumentCurrency}
                </span>
              </label>
              <input
                className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-amber-300/40 focus:outline-none"
                onChange={(e) => updateField("entryPrice", e.target.value)}
                placeholder="напр. 16.50"
                step="any"
                type="number"
                value={form.entryPrice}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Брой акции
              </label>
              <input
                className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-amber-300/40 focus:outline-none"
                onChange={(e) => updateField("quantity", e.target.value)}
                placeholder="напр. 5"
                step="any"
                type="number"
                value={form.quantity}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Планирана цена продажба{" "}
                <span className="ml-1 text-[10px] font-normal text-slate-600">(по избор)</span>
              </label>
              <input
                className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-amber-300/40 focus:outline-none"
                onChange={(e) => updateField("plannedExitPrice", e.target.value)}
                placeholder="напр. 18.00"
                step="any"
                type="number"
                value={form.plannedExitPrice}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Бележки{" "}
                <span className="ml-1 text-[10px] font-normal text-slate-600">(по избор)</span>
              </label>
              <input
                className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-amber-300/40 focus:outline-none"
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="напр. Покупка при корекция"
                value={form.notes}
              />
            </div>
          </div>

          {preview ? (
            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.025] px-4 py-3 text-xs">
              <p className="mb-2 font-semibold text-slate-300">Преглед след добавяне</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-slate-400">
                <div>
                  <p className="text-slate-500">Нов общ брой</p>
                  <p className="font-semibold text-white">
                    {preview.newTotalShares.toLocaleString("en-US", { maximumFractionDigits: 2 })} акции
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Нова ср. entry</p>
                  <p className="font-semibold text-white">
                    {fmtCurr(preview.newAvgEntry, instrumentCurrency)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-500">Себестойност</p>
                  <p className="font-semibold text-white">
                    {fmtCurr(preview.costInstrument, instrumentCurrency)}
                    {instrumentCurrency !== accountCurrency ? (
                      <span className="ml-2 font-normal text-slate-500">
                        (~{fmtCurr(preview.costAccount, accountCurrency)})
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-md border border-rose-200/20 bg-rose-300/[0.08] px-3 py-2 text-sm text-rose-100">
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
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-amber-200/20 bg-amber-300/10 px-3 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving}
            onClick={() => void handleSave()}
            type="button"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Запази лота
          </button>
        </div>
      </div>
    </>
  );
}
