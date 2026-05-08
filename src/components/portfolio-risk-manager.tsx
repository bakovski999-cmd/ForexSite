"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  ChevronDown,
  Edit3,
  Info,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  calculateCustomCrashStress,
  calculatePortfolioRisk,
  calculateUniformDropStress,
  getDefaultAccountRiskProfile,
  getPositionKey,
  type AccountRiskProfile,
  type PortfolioDirection,
  type PortfolioPositionAnalysis,
  type PortfolioRiskResult,
  type PortfolioStressResult,
  type SavedPortfolioPosition,
} from "@/lib/portfolio-risk";
import { cn } from "@/lib/utils";

type ProfileForm = {
  id: string | null;
  accountName: string;
  brokerName: string;
  accountCurrency: string;
  balance: string;
  addedFundsSimulation: string;
  stopOutLevelPercent: string;
  marginCallLevelPercent: string;
  normalFixedLeverage: string;
  temporaryFixedLeverage: string;
  fxRateInstrumentToAccount: string;
};

type PositionForm = {
  id?: string;
  symbol: string;
  assetName: string;
  direction: PortfolioDirection;
  entryPrice: string;
  currentPrice: string;
  quantity: string;
  instrumentCurrency: string;
  normalFixedLeverage: string;
  temporaryFixedLeverage: string;
  notes: string;
};

type ApiPortfolioResponse = {
  ok: boolean;
  message?: string;
  profile?: AccountRiskProfile;
  positions?: SavedPortfolioPosition[];
};

const numberFormatter = new Intl.NumberFormat("bg-BG", {
  maximumFractionDigits: 2,
});

function formatCurrency(value: number, currency = "EUR") {
  if (!Number.isFinite(value)) {
    return "няма позиции";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      currency,
      maximumFractionDigits: 2,
      style: "currency",
    }).format(value);
  } catch {
    return `${numberFormatter.format(value)} ${currency}`;
  }
}

function formatNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) {
    return "няма позиции";
  }

  return new Intl.NumberFormat("bg-BG", {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "няма позиции";
  }

  return `${formatNumber(value, 1)}%`;
}

function parseAmount(value: string, fallback = Number.NaN) {
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");

  if (!normalized) {
    return fallback;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalAmount(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = parseAmount(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function profileToForm(profile: AccountRiskProfile): ProfileForm {
  const normalized = getDefaultAccountRiskProfile(profile);

  return {
    id: normalized.id,
    accountName: normalized.accountName,
    brokerName: normalized.brokerName,
    accountCurrency: normalized.accountCurrency,
    balance: String(normalized.balance),
    addedFundsSimulation: String(normalized.addedFundsSimulation),
    stopOutLevelPercent: String(normalized.stopOutLevelPercent),
    marginCallLevelPercent: String(normalized.marginCallLevelPercent),
    normalFixedLeverage: String(normalized.normalFixedLeverage),
    temporaryFixedLeverage: String(normalized.temporaryFixedLeverage),
    fxRateInstrumentToAccount: String(normalized.fxRateInstrumentToAccount),
  };
}

function formToProfile(form: ProfileForm): AccountRiskProfile {
  return getDefaultAccountRiskProfile({
    id: form.id,
    accountName: form.accountName,
    brokerName: form.brokerName,
    accountCurrency: form.accountCurrency,
    balance: parseAmount(form.balance, 0),
    addedFundsSimulation: parseAmount(form.addedFundsSimulation, 0),
    stopOutLevelPercent: parseAmount(form.stopOutLevelPercent, 20),
    marginCallLevelPercent: parseAmount(form.marginCallLevelPercent, 50),
    normalFixedLeverage: parseAmount(form.normalFixedLeverage, 20),
    temporaryFixedLeverage: parseAmount(form.temporaryFixedLeverage, 5),
    fxRateInstrumentToAccount: parseAmount(form.fxRateInstrumentToAccount, 0.85),
  });
}

function emptyPositionForm(): PositionForm {
  return {
    symbol: "SOFI",
    assetName: "",
    direction: "buy",
    entryPrice: "16.30",
    currentPrice: "",
    quantity: "6",
    instrumentCurrency: "USD",
    normalFixedLeverage: "",
    temporaryFixedLeverage: "",
    notes: "",
  };
}

function formToPosition(form: PositionForm): SavedPortfolioPosition {
  return {
    id: form.id ?? "preview-position",
    symbol: form.symbol.trim().toUpperCase(),
    assetName: form.assetName.trim() || null,
    direction: form.direction,
    entryPrice: parseAmount(form.entryPrice),
    currentPrice: parseOptionalAmount(form.currentPrice),
    quantity: parseAmount(form.quantity),
    instrumentCurrency: form.instrumentCurrency.trim().toUpperCase() || "USD",
    normalFixedLeverage: parseOptionalAmount(form.normalFixedLeverage),
    temporaryFixedLeverage: parseOptionalAmount(form.temporaryFixedLeverage),
    notes: form.notes.trim() || null,
  };
}

function positionToForm(position: SavedPortfolioPosition): PositionForm {
  return {
    id: position.id,
    symbol: position.symbol,
    assetName: position.assetName ?? "",
    direction: position.direction,
    entryPrice: String(position.entryPrice),
    currentPrice: position.currentPrice == null ? "" : String(position.currentPrice),
    quantity: String(position.quantity),
    instrumentCurrency: position.instrumentCurrency,
    normalFixedLeverage:
      position.normalFixedLeverage == null ? "" : String(position.normalFixedLeverage),
    temporaryFixedLeverage:
      position.temporaryFixedLeverage == null ? "" : String(position.temporaryFixedLeverage),
    notes: position.notes ?? "",
  };
}

function riskTone(status: "safe" | "moderate" | "high" | "critical") {
  if (status === "safe") {
    return "emerald";
  }

  if (status === "moderate") {
    return "amber";
  }

  if (status === "high") {
    return "orange";
  }

  return "rose";
}

function riskLabel(status: "safe" | "moderate" | "high" | "critical") {
  if (status === "safe") {
    return "Safe";
  }

  if (status === "moderate") {
    return "Moderate";
  }

  if (status === "high") {
    return "High risk";
  }

  return "Critical";
}

function directionLabel(direction: PortfolioDirection) {
  return direction === "buy" ? "BUY" : "SELL";
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 100;
  }

  return Math.min(100, Math.max(0, value));
}

function Field({
  label,
  value,
  onChange,
  hint,
  type = "text",
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  type?: "text" | "number";
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-[10px] font-medium uppercase text-slate-500">
        {label}
      </span>
      <input
        className="mt-1 h-9 w-full rounded-md border border-white/10 bg-slate-950/45 px-2.5 text-sm font-medium text-white outline-none transition placeholder:text-slate-600 focus:border-amber-200/45 focus:ring-1 focus:ring-amber-200/15"
        inputMode={type === "number" ? "decimal" : undefined}
        min={type === "number" ? "0" : undefined}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
      {hint ? <span className="mt-1.5 block text-xs leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-[10px] font-medium uppercase text-slate-500">
        {label}
      </span>
      <select
        className="mt-1 h-9 w-full rounded-md border border-white/10 bg-slate-950/45 px-2.5 text-sm font-medium text-white outline-none transition focus:border-amber-200/45 focus:ring-1 focus:ring-amber-200/15"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}

function InfoHint({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-slate-400">
      <Info className="size-3 text-slate-500" />
      {text}
    </span>
  );
}

function SummaryCell({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "green" | "red" | "amber" | "slate";
}) {
  return (
    <div className="min-w-0 px-3 py-3">
      <p className="truncate text-[10px] font-medium uppercase text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-lg font-semibold text-white",
          tone === "green" && "text-emerald-100",
          tone === "red" && "text-rose-100",
          tone === "amber" && "text-amber-100",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: Extract<PortfolioRiskResult, { ok: true }>["summary"]["riskStatus"];
}) {
  const tone = riskTone(status);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold uppercase",
        tone === "emerald" && "border-emerald-200/20 bg-emerald-300/10 text-emerald-100",
        tone === "amber" && "border-amber-200/20 bg-amber-300/10 text-amber-100",
        tone === "orange" && "border-orange-200/20 bg-orange-300/10 text-orange-100",
        tone === "rose" && "border-rose-200/20 bg-rose-300/10 text-rose-100",
      )}
    >
      {riskLabel(status)}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  children,
  disabled,
  tone = "slate",
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  tone?: "slate" | "red";
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50",
        tone === "red" && "hover:border-rose-200/25 hover:bg-rose-300/10 hover:text-rose-100",
      )}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function StressResultView({
  title,
  result,
  currency,
}: {
  title: string;
  result: PortfolioStressResult;
  currency: string;
}) {
  if (!result.ok) {
    return (
      <div className="rounded-md border border-rose-200/20 bg-rose-300/10 p-3 text-sm text-rose-100">
        {result.errors.join(" ")}
      </div>
    );
  }

  const survivesBoth = result.survivesNormal && result.survivesTemporary;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{title}</p>
        <span
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-semibold",
            survivesBoth
              ? "border-emerald-200/20 bg-emerald-300/10 text-emerald-100"
              : "border-rose-200/20 bg-rose-300/10 text-rose-100",
          )}
        >
          {survivesBoth ? "Account survives" : "Stop-out risk"}
        </span>
      </div>
      <div className="grid divide-y divide-white/8 rounded-lg border border-white/8 bg-slate-950/20 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <SummaryCell label="Equity след сценария" value={formatCurrency(result.equityAfter, currency)} />
        <SummaryCell
          label="Обща загуба"
          tone={result.totalLossAccount > 0 ? "red" : "slate"}
          value={formatCurrency(result.totalLossAccount, currency)}
        />
        <SummaryCell
          label="Margin level 1:20 / 1:5"
          value={`${formatPercent(result.normalMarginLevel)} — ${formatPercent(result.temporaryMarginLevel)}`}
        />
      </div>
      {result.positions.length > 0 ? (
        <div className="divide-y divide-white/8 rounded-lg border border-white/8 text-xs text-slate-400">
          {result.positions.map((position) => (
            <div
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              key={position.positionId}
            >
              <span>{position.symbol} crash {formatNumber(position.crashPrice)}</span>
              <span>{formatCurrency(position.incrementalPnlAccount, currency)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ToolPanel({
  title,
  description,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#0b1322]/70">
      <button
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={onToggle}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-slate-400">
            {icon}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white">{title}</span>
            <span className="block truncate text-xs text-slate-500">{description}</span>
          </span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-slate-500 transition", open && "rotate-180")}
        />
      </button>
      {open ? <div className="border-t border-white/8 p-4">{children}</div> : null}
    </section>
  );
}

function PositionsTable({
  positions,
  accountCurrency,
  onEdit,
  onDelete,
  deletingId,
}: {
  positions: PortfolioPositionAnalysis[];
  accountCurrency: string;
  onEdit: (position: SavedPortfolioPosition) => void;
  onDelete: (position: SavedPortfolioPosition) => void;
  deletingId: string | null;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#0b1322]/80">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-white">Позиции</h2>
          <p className="text-xs text-slate-500">
            Ръчни цени, margin и stop-out по всяка позиция.
          </p>
        </div>
        <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-400">
          {positions.length} позиции
        </span>
      </div>

      {positions.length === 0 ? (
        <div className="px-4 py-8 text-sm leading-6 text-slate-400">
          Все още няма запазени позиции. Добави първата позиция от панела за позиция.
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-white/8 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Symbol</th>
                  <th className="px-3 py-2 font-medium">Side</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Entry / Current</th>
                  <th className="px-3 py-2 text-right font-medium">Value</th>
                  <th className="px-3 py-2 text-right font-medium">Margin</th>
                  <th className="px-3 py-2 text-right font-medium">Auto-close</th>
                  <th className="px-3 py-2 font-medium">Risk</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {positions.map((analysis) => {
                  const position = analysis.position;
                  const instrumentCurrency = position.instrumentCurrency;

                  return (
                    <tr className="align-top text-slate-300" key={position.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white">{position.symbol}</p>
                        {position.assetName ? (
                          <p className="mt-0.5 max-w-36 truncate text-xs text-slate-500">
                            {position.assetName}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-md border border-white/10 px-2 py-1 text-xs">
                          {directionLabel(position.direction)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">{formatNumber(position.quantity, 2)}</td>
                      <td className="px-3 py-3 text-right">
                        <p>{formatCurrency(position.entryPrice, instrumentCurrency)}</p>
                        <p className="text-xs text-slate-500">
                          {position.currentPrice == null
                            ? "current = entry"
                            : formatCurrency(analysis.basePrice, instrumentCurrency)}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <p>{formatCurrency(analysis.positionValueAccount, accountCurrency)}</p>
                        <p className="text-xs text-slate-500">
                          {formatPercent(analysis.allocationPercent)}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <p>{formatCurrency(analysis.normalUsedMargin, accountCurrency)}</p>
                        <p className="text-xs text-amber-100/80">
                          {formatCurrency(analysis.temporaryUsedMargin, accountCurrency)}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <p>{formatCurrency(analysis.normalAutoClose.displayAutoClosePrice, instrumentCurrency)}</p>
                        <p className="text-xs text-amber-100/80">
                          {formatCurrency(analysis.temporaryAutoClose.displayAutoClosePrice, instrumentCurrency)}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={analysis.riskBadge} />
                        {analysis.warnings.length > 0 ? (
                          <p className="mt-1 max-w-36 text-xs leading-5 text-rose-200">
                            {analysis.warnings.join(" ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <IconButton label={`Редактирай ${position.symbol}`} onClick={() => onEdit(position)}>
                            <Edit3 className="size-4" />
                          </IconButton>
                          <IconButton
                            disabled={deletingId === position.id}
                            label={`Изтрий ${position.symbol}`}
                            onClick={() => onDelete(position)}
                            tone="red"
                          >
                            {deletingId === position.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 p-3 lg:hidden">
            {positions.map((analysis) => {
              const position = analysis.position;
              const instrumentCurrency = position.instrumentCurrency;

              return (
                <article
                  className="rounded-lg border border-white/8 bg-white/[0.025] p-3"
                  key={position.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">{position.symbol}</p>
                        <span className="rounded-md border border-white/10 px-2 py-0.5 text-xs text-slate-300">
                          {directionLabel(position.direction)}
                        </span>
                        <StatusBadge status={analysis.riskBadge} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatNumber(position.quantity, 2)} shares · entry{" "}
                        {formatCurrency(position.entryPrice, instrumentCurrency)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <IconButton label={`Редактирай ${position.symbol}`} onClick={() => onEdit(position)}>
                        <Edit3 className="size-4" />
                      </IconButton>
                      <IconButton
                        disabled={deletingId === position.id}
                        label={`Изтрий ${position.symbol}`}
                        onClick={() => onDelete(position)}
                        tone="red"
                      >
                        {deletingId === position.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </IconButton>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <p className="text-slate-500">Value</p>
                      <p className="mt-0.5 text-slate-200">
                        {formatCurrency(analysis.positionValueAccount, accountCurrency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Margin N/R</p>
                      <p className="mt-0.5 text-slate-200">
                        {formatCurrency(analysis.normalUsedMargin, accountCurrency)} /{" "}
                        {formatCurrency(analysis.temporaryUsedMargin, accountCurrency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Current</p>
                      <p className="mt-0.5 text-slate-200">
                        {position.currentPrice == null
                          ? "entry"
                          : formatCurrency(analysis.basePrice, instrumentCurrency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Auto-close N/R</p>
                      <p className="mt-0.5 text-slate-200">
                        {formatCurrency(analysis.normalAutoClose.displayAutoClosePrice, instrumentCurrency)} /{" "}
                        {formatCurrency(analysis.temporaryAutoClose.displayAutoClosePrice, instrumentCurrency)}
                      </p>
                    </div>
                  </div>
                  {analysis.warnings.length > 0 ? (
                    <p className="mt-3 text-xs leading-5 text-rose-200">
                      {analysis.warnings.join(" ")}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

export function PortfolioRiskManager() {
  const [profileForm, setProfileForm] = useState<ProfileForm>(
    profileToForm(getDefaultAccountRiskProfile()),
  );
  const [positions, setPositions] = useState<SavedPortfolioPosition[]>([]);
  const [positionForm, setPositionForm] = useState<PositionForm>(emptyPositionForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewRequested, setPreviewRequested] = useState(false);
  const [uniformDrop, setUniformDrop] = useState("20");
  const [crashPrices, setCrashPrices] = useState<Record<string, string>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stressOpen, setStressOpen] = useState(false);

  const profile = useMemo(() => formToProfile(profileForm), [profileForm]);
  const portfolio = useMemo(() => calculatePortfolioRisk(profile, positions), [profile, positions]);
  const draftPosition = useMemo(() => formToPosition(positionForm), [positionForm]);
  const previewPortfolio = useMemo(() => {
    if (!previewRequested) {
      return null;
    }

    const nextPositions = editingId
      ? positions.map((position) => (position.id === editingId ? { ...draftPosition, id: editingId } : position))
      : [...positions, draftPosition];

    return calculatePortfolioRisk(profile, nextPositions);
  }, [draftPosition, editingId, positions, previewRequested, profile]);
  const uniformStress = useMemo(
    () => calculateUniformDropStress(profile, positions, parseAmount(uniformDrop, 0)),
    [positions, profile, uniformDrop],
  );
  const customStress = useMemo(() => {
    const parsedCrashPrices = Object.fromEntries(
      positions.map((position) => [getPositionKey(position), parseAmount(crashPrices[getPositionKey(position)] ?? "", Number.NaN)]),
    );

    return calculateCustomCrashStress(profile, positions, parsedCrashPrices);
  }, [crashPrices, positions, profile]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/portfolio-risk", { cache: "no-store" });
        const data = (await response.json()) as ApiPortfolioResponse;

        if (!response.ok || !data.ok) {
          throw new Error(data.message ?? "Portfolio risk data failed to load.");
        }

        if (!isMounted) {
          return;
        }

        if (data.profile) {
          setProfileForm(profileToForm(data.profile));
        }

        setPositions(data.positions ?? []);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  function updateProfileField(field: keyof ProfileForm, value: string) {
    setProfileForm((current) => ({ ...current, [field]: value }));
  }

  function updatePositionField(field: keyof PositionForm, value: string) {
    setPositionForm((current) => {
      if (field === "direction") {
        return { ...current, direction: value === "sell" ? "sell" : "buy" };
      }

      return { ...current, [field]: value };
    });
    setPreviewRequested(false);
  }

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/portfolio-risk", {
        body: JSON.stringify({ profile }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const data = (await response.json()) as ApiPortfolioResponse;

      if (!response.ok || !data.ok || !data.profile) {
        throw new Error(data.message ?? "Account settings failed to save.");
      }

      setProfileForm(profileToForm(data.profile));
      setPositions(data.positions ?? positions);
      setMessage("Настройките на акаунта са запазени.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function savePosition() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const bodyPosition = editingId ? { ...draftPosition, id: editingId } : draftPosition;
      const response = await fetch("/api/portfolio-risk", {
        body: JSON.stringify({ profile, position: bodyPosition }),
        headers: { "Content-Type": "application/json" },
        method: editingId ? "PATCH" : "POST",
      });
      const data = (await response.json()) as ApiPortfolioResponse;

      if (!response.ok || !data.ok || !data.profile) {
        throw new Error(data.message ?? "Position failed to save.");
      }

      setProfileForm(profileToForm(data.profile));
      setPositions(data.positions ?? []);
      setPositionForm(emptyPositionForm());
      setEditingId(null);
      setPreviewRequested(false);
      setMessage(editingId ? "Позицията е обновена." : "Позицията е запазена.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function deletePosition(position: SavedPortfolioPosition) {
    if (!profile.id) {
      setError("Първо запази настройките на акаунта.");
      return;
    }

    setDeletingId(position.id);
    setError(null);
    setMessage(null);

    try {
      const params = new URLSearchParams({ id: position.id, profileId: profile.id });
      const response = await fetch(`/api/portfolio-risk?${params.toString()}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as ApiPortfolioResponse;

      if (!response.ok || !data.ok || !data.profile) {
        throw new Error(data.message ?? "Position failed to delete.");
      }

      setProfileForm(profileToForm(data.profile));
      setPositions(data.positions ?? []);
      setMessage("Позицията е изтрита.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    } finally {
      setDeletingId(null);
    }
  }

  function startEdit(position: SavedPortfolioPosition) {
    setEditingId(position.id);
    setPositionForm(positionToForm(position));
    setPreviewRequested(true);
  }

  const savedPortfolio = portfolio.ok ? portfolio : null;
  const accountCurrency = savedPortfolio?.summary.accountCurrency ?? profile.accountCurrency;
  const healthMarginLevel = savedPortfolio
    ? Math.min(savedPortfolio.summary.normal.marginLevel, savedPortfolio.summary.temporary.marginLevel)
    : Number.POSITIVE_INFINITY;
  const healthPct = clampPercent(Number.isFinite(healthMarginLevel) ? healthMarginLevel / 8 : 100);
  const healthTone = savedPortfolio ? riskTone(savedPortfolio.summary.riskStatus) : "emerald";

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-white/10 bg-[#0b1322]/80">
        <div className="flex flex-col gap-4 border-b border-white/8 px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-white">Portfolio Risk</h2>
              {savedPortfolio ? <StatusBadge status={savedPortfolio.summary.riskStatus} /> : null}
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
              Данните са по логнат потребител в Supabase. Цени, FX курс и broker настройки се
              въвеждат ръчно; няма live връзка с брокер.
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-950/55">
              <div
                className={cn(
                  "h-full rounded-full",
                  healthTone === "emerald" && "bg-emerald-300/80",
                  healthTone === "amber" && "bg-amber-300/85",
                  healthTone === "orange" && "bg-orange-300/85",
                  healthTone === "rose" && "bg-rose-300/85",
                )}
                style={{ width: `${healthPct}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <Field
              className="w-36"
              label="Add funds"
              onChange={(value) => updateProfileField("addedFundsSimulation", value)}
              type="number"
              value={profileForm.addedFundsSimulation}
            />
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving}
              onClick={() => void saveProfile()}
              type="button"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save
            </button>
          </div>
        </div>

        {savedPortfolio ? (
          <>
            <div className="grid divide-y divide-white/8 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-6">
              <SummaryCell
                label="Equity"
                value={formatCurrency(savedPortfolio.summary.equity, accountCurrency)}
              />
              <SummaryCell
                label="Free margin"
                tone={savedPortfolio.summary.temporary.freeMargin >= 0 ? "green" : "red"}
                value={formatCurrency(savedPortfolio.summary.temporary.freeMargin, accountCurrency)}
              />
              <SummaryCell
                label="Exposure"
                value={formatCurrency(
                  savedPortfolio.summary.totalPositionValueAccount,
                  accountCurrency,
                )}
              />
              <SummaryCell
                label="Risk margin level"
                tone={savedPortfolio.summary.temporary.marginLevel >= 200 ? "green" : "amber"}
                value={formatPercent(savedPortfolio.summary.temporary.marginLevel)}
              />
              <SummaryCell
                label="Unrealized P/L"
                tone={savedPortfolio.summary.totalUnrealizedPnLAccount >= 0 ? "green" : "red"}
                value={formatCurrency(
                  savedPortfolio.summary.totalUnrealizedPnLAccount,
                  accountCurrency,
                )}
              />
              <SummaryCell
                label="Stop-out buffer"
                tone={savedPortfolio.summary.temporary.maxLossBeforeStopOut >= 0 ? "green" : "red"}
                value={formatCurrency(
                  savedPortfolio.summary.temporary.maxLossBeforeStopOut,
                  accountCurrency,
                )}
              />
            </div>
            {savedPortfolio.summary.warnings.length > 0 ? (
              <div className="border-t border-rose-200/15 px-4 py-2 text-xs leading-5 text-rose-100">
                {savedPortfolio.summary.warnings.join(" ")}
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      {loading ? (
        <div className="rounded-lg border border-white/10 bg-[#0b1322]/80 p-6 text-center text-slate-300">
          <Loader2 className="mx-auto size-8 animate-spin text-amber-200" />
          <p className="mt-3">Зареждам портфолио данните...</p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-200/20 bg-rose-300/[0.08] p-4 text-sm leading-6 text-rose-100">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-emerald-200/20 bg-emerald-300/[0.08] p-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      {!portfolio.ok ? (
        <div className="rounded-lg border border-rose-200/20 bg-rose-300/[0.08] p-4 text-sm leading-6 text-rose-100">
          {portfolio.errors.join(" ")}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <PositionsTable
            accountCurrency={accountCurrency}
            deletingId={deletingId}
            onDelete={(position) => void deletePosition(position)}
            onEdit={startEdit}
            positions={savedPortfolio?.positions ?? []}
          />

          <ToolPanel
            description={`${profileForm.brokerName || "Broker"} · ${profileForm.accountCurrency || "EUR"}`}
            icon={<BriefcaseBusiness className="size-4" />}
            onToggle={() => setSettingsOpen((current) => !current)}
            open={settingsOpen}
            title="Настройки на акаунта"
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Field
                label="Account name"
                onChange={(value) => updateProfileField("accountName", value)}
                value={profileForm.accountName}
              />
              <Field
                label="Broker"
                onChange={(value) => updateProfileField("brokerName", value)}
                value={profileForm.brokerName}
              />
              <Field
                label="Balance"
                onChange={(value) => updateProfileField("balance", value)}
                type="number"
                value={profileForm.balance}
              />
              <Field
                label="Currency"
                onChange={(value) => updateProfileField("accountCurrency", value)}
                value={profileForm.accountCurrency}
              />
              <Field
                label="Stop-out %"
                onChange={(value) => updateProfileField("stopOutLevelPercent", value)}
                type="number"
                value={profileForm.stopOutLevelPercent}
              />
              <Field
                label="Margin call %"
                onChange={(value) => updateProfileField("marginCallLevelPercent", value)}
                type="number"
                value={profileForm.marginCallLevelPercent}
              />
              <Field
                label="Normal leverage"
                onChange={(value) => updateProfileField("normalFixedLeverage", value)}
                type="number"
                value={profileForm.normalFixedLeverage}
              />
              <Field
                label="Risk leverage"
                onChange={(value) => updateProfileField("temporaryFixedLeverage", value)}
                type="number"
                value={profileForm.temporaryFixedLeverage}
              />
              <Field
                hint={`Колко ${profileForm.accountCurrency || "EUR"} е 1 USD.`}
                label="FX USD"
                onChange={(value) => updateProfileField("fxRateInstrumentToAccount", value)}
                type="number"
                value={profileForm.fxRateInstrumentToAccount}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-3">
              <p className="max-w-2xl text-xs leading-5 text-slate-500">
                Fixed leverage се настройва според продукта. Ако current price е празна, системата
                използва entry price за планирана позиция.
              </p>
              <button
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={saving}
                onClick={() => void saveProfile()}
                type="button"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save settings
              </button>
            </div>
          </ToolPanel>

          <ToolPanel
            description="Uniform drop и custom crash prices"
            icon={<BarChart3 className="size-4" />}
            onToggle={() => setStressOpen((current) => !current)}
            open={stressOpen}
            title="Стрес тест"
          >
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="space-y-3">
                <Field
                  hint="Пример: 10, 20, 30 или 50."
                  label="Uniform drop %"
                  onChange={setUniformDrop}
                  type="number"
                  value={uniformDrop}
                />
                <StressResultView
                  currency={accountCurrency}
                  result={uniformStress}
                  title={`Uniform Drop · ${uniformDrop || 0}%`}
                />
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">Custom crash</p>
                  <InfoHint text="Празно = текуща/входна цена" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {positions.length > 0 ? (
                    positions.map((position) => {
                      const key = getPositionKey(position);

                      return (
                        <Field
                          key={key}
                          label={`${position.symbol} crash`}
                          onChange={(value) =>
                            setCrashPrices((current) => ({ ...current, [key]: value }))
                          }
                          type="number"
                          value={crashPrices[key] ?? ""}
                        />
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-400">
                      Добави позиции, за да въведеш crash prices.
                    </p>
                  )}
                </div>
                <StressResultView
                  currency={accountCurrency}
                  result={customStress}
                  title="Custom Crash"
                />
              </div>
            </div>
          </ToolPanel>
        </div>

        <aside className="self-start rounded-lg border border-white/10 bg-[#0b1322]/90 p-4 xl:sticky xl:top-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                {editingId ? (
                  <Edit3 className="size-4 text-slate-400" />
                ) : (
                  <Plus className="size-4 text-slate-400" />
                )}
                <h2 className="text-base font-semibold text-white">
                  {editingId ? "Редакция" : "Нова позиция"}
                </h2>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Добави или редактирай Share/Stock CFD позиция.
              </p>
            </div>
            {editingId ? (
              <button
                aria-label="Откажи редакция"
                className="inline-flex size-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100"
                onClick={() => {
                  setEditingId(null);
                  setPositionForm(emptyPositionForm());
                  setPreviewRequested(false);
                }}
                title="Откажи редакция"
                type="button"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Field
              label="Symbol"
              onChange={(value) => updatePositionField("symbol", value)}
              value={positionForm.symbol}
            />
            <Field
              label="Asset name"
              onChange={(value) => updatePositionField("assetName", value)}
              value={positionForm.assetName}
            />
            <SelectField
              label="Direction"
              onChange={(value) => updatePositionField("direction", value)}
              value={positionForm.direction}
            >
              <option value="buy">BUY</option>
              <option value="sell">SELL</option>
            </SelectField>
            <Field
              label="Currency"
              onChange={(value) => updatePositionField("instrumentCurrency", value)}
              value={positionForm.instrumentCurrency}
            />
            <Field
              label="Entry price"
              onChange={(value) => updatePositionField("entryPrice", value)}
              type="number"
              value={positionForm.entryPrice}
            />
            <Field
              hint="Празно за планирана позиция."
              label="Current price"
              onChange={(value) => updatePositionField("currentPrice", value)}
              type="number"
              value={positionForm.currentPrice}
            />
            <Field
              label="Quantity"
              onChange={(value) => updatePositionField("quantity", value)}
              type="number"
              value={positionForm.quantity}
            />
            <Field
              hint="Празно = account setting."
              label="Normal leverage"
              onChange={(value) => updatePositionField("normalFixedLeverage", value)}
              type="number"
              value={positionForm.normalFixedLeverage}
            />
            <Field
              hint="Празно = account setting."
              label="Risk leverage"
              onChange={(value) => updatePositionField("temporaryFixedLeverage", value)}
              type="number"
              value={positionForm.temporaryFixedLeverage}
            />
            <Field
              className="sm:col-span-2 xl:col-span-1"
              label="Notes"
              onChange={(value) => updatePositionField("notes", value)}
              value={positionForm.notes}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/8 pt-3">
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.06]"
              onClick={() => setPreviewRequested(true)}
              type="button"
            >
              <Activity className="size-4" />
              Preview
            </button>
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-amber-200/20 bg-amber-300/10 px-3 text-sm font-semibold text-amber-50 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving}
              onClick={() => void savePosition()}
              type="button"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {editingId ? "Update" : "Save"}
            </button>
          </div>

          {previewPortfolio ? (
            <div className="mt-4 border-t border-white/8 pt-3">
              <p className="text-sm font-semibold text-white">Preview impact</p>
              {previewPortfolio.ok ? (
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Exposure</p>
                    <p className="mt-0.5 text-slate-200">
                      {formatCurrency(
                        previewPortfolio.summary.totalPositionValueAccount,
                        previewPortfolio.summary.accountCurrency,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Margin risk</p>
                    <p className="mt-0.5 text-amber-100">
                      {formatCurrency(
                        previewPortfolio.summary.temporary.usedMargin,
                        previewPortfolio.summary.accountCurrency,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Level normal</p>
                    <p className="mt-0.5 text-slate-200">
                      {formatPercent(previewPortfolio.summary.normal.marginLevel)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Level risk</p>
                    <p className="mt-0.5 text-slate-200">
                      {formatPercent(previewPortfolio.summary.temporary.marginLevel)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm leading-6 text-rose-100">
                  {previewPortfolio.errors.join(" ")}
                </p>
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
