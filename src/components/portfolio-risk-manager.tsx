"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  Edit3,
  Gauge,
  Info,
  Loader2,
  Plus,
  Save,
  Trash2,
  WalletCards,
  X,
  type LucideIcon,
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
  type PortfolioScenarioSummary,
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

function SectionCard({
  eyebrow,
  title,
  icon: Icon,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[#10192d]/88 p-5 shadow-[0_30px_90px_rgba(5,8,20,0.32)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-300/18 text-amber-100">
            <Icon className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-200/75">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  type?: "text" | "number";
}) {
  return (
    <label className="block rounded-[20px] border border-white/8 bg-white/[0.035] p-3">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      <input
        className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/15"
        inputMode={type === "number" ? "decimal" : undefined}
        min={type === "number" ? "0" : undefined}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
      {hint ? <span className="mt-2 block text-xs leading-5 text-slate-400">{hint}</span> : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block rounded-[20px] border border-white/8 bg-white/[0.035] p-3">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      <select
        className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 text-sm font-semibold text-white outline-none transition focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/15"
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
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300">
      <Info className="size-3 text-amber-200" />
      {text}
    </span>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "green" | "red" | "gold" | "slate";
}) {
  return (
    <div
      className={cn(
        "rounded-[22px] border p-4 ring-1",
        tone === "green" && "border-emerald-200/15 bg-emerald-300/[0.07] ring-emerald-200/10",
        tone === "red" && "border-rose-200/15 bg-rose-300/[0.07] ring-rose-200/10",
        tone === "gold" && "border-amber-200/18 bg-amber-300/[0.07] ring-amber-200/10",
        tone === "slate" && "border-white/10 bg-white/[0.04] ring-white/10",
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-sm leading-5 text-slate-400">{hint}</p> : null}
    </div>
  );
}

function AccountHealthBar({ result }: { result: Extract<PortfolioRiskResult, { ok: true }> }) {
  const marginLevel = Math.min(result.summary.normal.marginLevel, result.summary.temporary.marginLevel);
  const pct = clampPercent(Number.isFinite(marginLevel) ? marginLevel / 8 : 100);
  const status = result.summary.riskStatus;
  const tone = riskTone(status);

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Account Health</p>
          <p className="text-xs leading-5 text-slate-400">
            Цветът идва от по-слабия margin level между нормален и временен leverage.
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em]",
            tone === "emerald" && "border-emerald-200/20 bg-emerald-300/10 text-emerald-100",
            tone === "amber" && "border-amber-200/20 bg-amber-300/10 text-amber-100",
            tone === "orange" && "border-orange-200/20 bg-orange-300/10 text-orange-100",
            tone === "rose" && "border-rose-200/20 bg-rose-300/10 text-rose-100",
          )}
        >
          {riskLabel(status)}
        </span>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-950/55">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "emerald" && "bg-emerald-300/80",
            tone === "amber" && "bg-amber-300/85",
            tone === "orange" && "bg-orange-300/85",
            tone === "rose" && "bg-rose-300/85",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-slate-500">
        <span>Critical</span>
        <span>200%</span>
        <span>500%+</span>
      </div>
    </div>
  );
}

function MarginUsageBar({
  label,
  scenario,
  equity,
  currency,
}: {
  label: string;
  scenario: PortfolioScenarioSummary;
  equity: number;
  currency: string;
}) {
  const usedPct = equity > 0 ? clampPercent((scenario.usedMargin / equity) * 100) : 100;
  const stopOutPct = equity > 0 ? clampPercent((scenario.stopOutEquity / equity) * 100) : 100;
  const freePct = Math.max(0, 100 - usedPct);

  return (
    <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-slate-400">Margin level {formatPercent(scenario.marginLevel)}</p>
      </div>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-950/55">
        <div className="bg-rose-300/70" style={{ width: `${stopOutPct}%` }} />
        <div className="bg-amber-300/80" style={{ width: `${Math.max(0, usedPct - stopOutPct)}%` }} />
        <div className="bg-emerald-300/60" style={{ width: `${freePct}%` }} />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
        <span>Used {formatCurrency(scenario.usedMargin, currency)}</span>
        <span>Free {formatCurrency(scenario.freeMargin, currency)}</span>
        <span>Stop-out {formatCurrency(scenario.stopOutEquity, currency)}</span>
      </div>
    </div>
  );
}

function RiskWindowComparison({ result }: { result: Extract<PortfolioRiskResult, { ok: true }> }) {
  const { accountCurrency } = result.summary;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-[24px] border border-emerald-200/14 bg-emerald-300/[0.06] p-4">
        <p className="text-sm font-semibold text-emerald-100">
          Нормален fixed leverage 1:{formatNumber(result.profile.normalFixedLeverage, 0)}
        </p>
        <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
          <span>Used margin: {formatCurrency(result.summary.normal.usedMargin, accountCurrency)}</span>
          <span>Free margin: {formatCurrency(result.summary.normal.freeMargin, accountCurrency)}</span>
          <span>Margin level: {formatPercent(result.summary.normal.marginLevel)}</span>
          <span>
            Uniform drop: {formatPercent(result.summary.normal.uniformDropThresholdPercent)}
          </span>
        </div>
      </div>
      <div className="rounded-[24px] border border-amber-200/16 bg-amber-300/[0.07] p-4">
        <p className="text-sm font-semibold text-amber-100">
          Risk window leverage 1:{formatNumber(result.profile.temporaryFixedLeverage, 0)}
        </p>
        <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
          <span>Used margin: {formatCurrency(result.summary.temporary.usedMargin, accountCurrency)}</span>
          <span>Free margin: {formatCurrency(result.summary.temporary.freeMargin, accountCurrency)}</span>
          <span>Margin level: {formatPercent(result.summary.temporary.marginLevel)}</span>
          <span>
            Uniform drop: {formatPercent(result.summary.temporary.uniformDropThresholdPercent)}
          </span>
        </div>
      </div>
    </div>
  );
}

function AllocationChart({
  positions,
  currency,
}: {
  positions: PortfolioPositionAnalysis[];
  currency: string;
}) {
  if (positions.length === 0) {
    return (
      <div className="rounded-[24px] border border-white/8 bg-white/[0.035] p-4 text-sm text-slate-400">
        Няма позиции за allocation chart.
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-white/8 bg-white/[0.035] p-4">
      <p className="text-sm font-semibold text-white">Portfolio Allocation</p>
      <div className="mt-4 space-y-3">
        {positions.map((analysis) => (
          <div key={getPositionKey(analysis.position)}>
            <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">{analysis.position.symbol}</span>
              <span>
                {formatPercent(analysis.allocationPercent)} ·{" "}
                {formatCurrency(analysis.positionValueAccount, currency)}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-950/55">
              <div
                className="h-full rounded-full bg-amber-300/80"
                style={{ width: `${clampPercent(analysis.allocationPercent)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PositionCard({
  analysis,
  accountCurrency,
  onEdit,
  onDelete,
  deleting,
}: {
  analysis: PortfolioPositionAnalysis;
  accountCurrency: string;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const instrumentCurrency = analysis.position.instrumentCurrency;
  const tone = riskTone(analysis.riskBadge);

  return (
    <article className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{analysis.position.symbol}</h3>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-300">
              {directionLabel(analysis.position.direction)}
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-1 text-xs font-semibold",
                tone === "emerald" && "border-emerald-200/20 bg-emerald-300/10 text-emerald-100",
                tone === "amber" && "border-amber-200/20 bg-amber-300/10 text-amber-100",
                tone === "orange" && "border-orange-200/20 bg-orange-300/10 text-orange-100",
                tone === "rose" && "border-rose-200/20 bg-rose-300/10 text-rose-100",
              )}
            >
              {riskLabel(analysis.riskBadge)}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {analysis.position.quantity} акции · вход{" "}
            {formatCurrency(analysis.position.entryPrice, instrumentCurrency)}
            {analysis.position.currentPrice == null
              ? " · current = entry"
              : ` · current ${formatCurrency(analysis.basePrice, instrumentCurrency)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-amber-200/30 hover:bg-amber-300/10 hover:text-amber-100"
            onClick={onEdit}
            type="button"
          >
            <Edit3 className="size-4" />
          </button>
          <button
            className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-rose-200/30 hover:bg-rose-300/10 hover:text-rose-100"
            disabled={deleting}
            onClick={onDelete}
            type="button"
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Position value"
          value={formatCurrency(analysis.positionValueAccount, accountCurrency)}
          hint={formatCurrency(analysis.positionValueInstrument, instrumentCurrency)}
        />
        <MetricCard
          label="Margin 1:20 / 1:5"
          value={`${formatCurrency(analysis.normalUsedMargin, accountCurrency)} — ${formatCurrency(
            analysis.temporaryUsedMargin,
            accountCurrency,
          )}`}
          hint="Според leverage настройките на акаунта/позицията."
          tone="gold"
        />
        <MetricCard
          label="Auto close"
          value={`${formatCurrency(
            analysis.normalAutoClose.displayAutoClosePrice,
            instrumentCurrency,
          )} — ${formatCurrency(
            analysis.temporaryAutoClose.displayAutoClosePrice,
            instrumentCurrency,
          )}`}
          hint={
            analysis.normalAutoClose.autoCloseBelowZero ||
            analysis.temporaryAutoClose.autoCloseBelowZero
              ? "Теоретичният stop-out е под $0 при част от сценариите."
              : "Ако само тази позиция се движи срещу акаунта."
          }
          tone="red"
        />
        <MetricCard
          label="Буфер на акция"
          value={`${formatCurrency(
            analysis.normalAutoClose.bufferPerShareInstrument,
            instrumentCurrency,
          )} — ${formatCurrency(
            analysis.temporaryAutoClose.bufferPerShareInstrument,
            instrumentCurrency,
          )}`}
          hint="Нормален leverage — risk window leverage."
        />
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
        <span>1:20 normal: {formatCurrency(analysis.normalAutoClose.displayAutoClosePrice, instrumentCurrency)}</span>
        <span>1:5 open/close window: {formatCurrency(analysis.temporaryAutoClose.displayAutoClosePrice, instrumentCurrency)}</span>
      </div>
      {analysis.warnings.length > 0 ? (
        <div className="mt-3 rounded-2xl border border-rose-200/20 bg-rose-300/10 p-3 text-sm leading-6 text-rose-100">
          {analysis.warnings.join(" ")}
        </div>
      ) : null}
    </article>
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
      <div className="rounded-[22px] border border-rose-200/20 bg-rose-300/10 p-4 text-sm text-rose-100">
        {result.errors.join(" ")}
      </div>
    );
  }

  const survivesBoth = result.survivesNormal && result.survivesTemporary;

  return (
    <div className="rounded-[24px] border border-white/8 bg-white/[0.035] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{title}</p>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold",
            survivesBoth
              ? "border-emerald-200/20 bg-emerald-300/10 text-emerald-100"
              : "border-rose-200/20 bg-rose-300/10 text-rose-100",
          )}
        >
          {survivesBoth ? "Account survives" : "Stop-out risk"}
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Equity след сценария" value={formatCurrency(result.equityAfter, currency)} />
        <MetricCard label="Обща загуба" value={formatCurrency(result.totalLossAccount, currency)} tone={result.totalLossAccount > 0 ? "red" : "slate"} />
        <MetricCard
          label="Margin level 1:20 / 1:5"
          value={`${formatPercent(result.normalMarginLevel)} — ${formatPercent(result.temporaryMarginLevel)}`}
        />
      </div>
      {result.positions.length > 0 ? (
        <div className="mt-3 space-y-2 text-xs text-slate-400">
          {result.positions.map((position) => (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/8 bg-slate-950/25 px-3 py-2"
              key={position.positionId}
            >
              <span>{position.symbol} crash {formatNumber(position.crashPrice)}</span>
              <span>{formatCurrency(position.pnlAccount, currency)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
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

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-amber-200/15 bg-amber-300/[0.07] p-5 text-sm leading-6 text-amber-50">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-5 shrink-0" />
          <p>
            Portfolio Risk Manager пази данните по логнат потребител в Supabase. Въвеждаш реалните
            broker настройки, позиции и FX курс ръчно; модулът не се логва в брокера и не дърпа live
            цени автоматично.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[28px] border border-white/10 bg-[#10192d]/88 p-8 text-center text-slate-300">
          <Loader2 className="mx-auto size-8 animate-spin text-amber-200" />
          <p className="mt-3">Зареждам портфолио данните...</p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[24px] border border-rose-200/20 bg-rose-300/[0.08] p-5 text-sm leading-6 text-rose-100">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-[24px] border border-emerald-200/20 bg-emerald-300/[0.08] p-4 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      <SectionCard
        action={
          <button
            className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-200/20 bg-amber-300/12 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-amber-300/18 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving}
            onClick={() => void saveProfile()}
            type="button"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save account settings
          </button>
        }
        eyebrow="Account Settings"
        icon={WalletCards}
        title="Настройки на акаунта"
      >
        <div className="mt-5 grid gap-4 lg:grid-cols-4">
          <Field label="Account name" onChange={(value) => updateProfileField("accountName", value)} value={profileForm.accountName} />
          <Field label="Broker name" onChange={(value) => updateProfileField("brokerName", value)} value={profileForm.brokerName} />
          <Field label="Account balance" onChange={(value) => updateProfileField("balance", value)} type="number" value={profileForm.balance} />
          <Field label="Account currency" onChange={(value) => updateProfileField("accountCurrency", value)} value={profileForm.accountCurrency} />
          <Field label="Stop-out level %" onChange={(value) => updateProfileField("stopOutLevelPercent", value)} type="number" value={profileForm.stopOutLevelPercent} />
          <Field label="Margin call level %" onChange={(value) => updateProfileField("marginCallLevelPercent", value)} type="number" value={profileForm.marginCallLevelPercent} />
          <Field label="Normal fixed leverage" onChange={(value) => updateProfileField("normalFixedLeverage", value)} type="number" value={profileForm.normalFixedLeverage} />
          <Field label="Temporary fixed leverage" onChange={(value) => updateProfileField("temporaryFixedLeverage", value)} type="number" value={profileForm.temporaryFixedLeverage} />
          <Field
            hint={`Колко ${profileForm.accountCurrency || "EUR"} е 1 USD.`}
            label="FX rate USD to account"
            onChange={(value) => updateProfileField("fxRateInstrumentToAccount", value)}
            type="number"
            value={profileForm.fxRateInstrumentToAccount}
          />
          <Field
            hint="Използва се за симулация, без да променя реалния balance."
            label="Add funds simulation"
            onChange={(value) => updateProfileField("addedFundsSimulation", value)}
            type="number"
            value={profileForm.addedFundsSimulation}
          />
        </div>
        <p className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">
          Share/Stock CFD продуктите често използват fixed leverage, а не account leverage.
          Затова настрой нормален и временен leverage според спецификацията на твоя брокер. Ако
          current price не е попълнена в позицията, системата използва entry price, за да можеш да
          планираш сделка преди да я отвориш.
        </p>
      </SectionCard>

      {savedPortfolio ? (
        <SectionCard eyebrow="Portfolio Summary" icon={Gauge} title="Обобщение на акаунта">
          <div className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-4">
              <AccountHealthBar result={savedPortfolio} />
              <RiskWindowComparison result={savedPortfolio} />
              {savedPortfolio.summary.warnings.length > 0 ? (
                <div className="rounded-[22px] border border-rose-200/20 bg-rose-300/10 p-4 text-sm leading-6 text-rose-100">
                  {savedPortfolio.summary.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard label="Balance" value={formatCurrency(savedPortfolio.summary.balance, accountCurrency)} />
              <MetricCard label="Simulated balance" value={formatCurrency(savedPortfolio.summary.simulatedBalance, accountCurrency)} tone="gold" />
              <MetricCard label="Total position value" value={formatCurrency(savedPortfolio.summary.totalPositionValueAccount, accountCurrency)} />
              <MetricCard label="Unrealized P/L" value={formatCurrency(savedPortfolio.summary.totalUnrealizedPnLAccount, accountCurrency)} tone={savedPortfolio.summary.totalUnrealizedPnLAccount >= 0 ? "green" : "red"} />
              <MetricCard label="Normal used margin" value={formatCurrency(savedPortfolio.summary.normal.usedMargin, accountCurrency)} />
              <MetricCard label="Temporary used margin" value={formatCurrency(savedPortfolio.summary.temporary.usedMargin, accountCurrency)} tone="gold" />
              <MetricCard label="Stop-out equity 1:20 / 1:5" value={`${formatCurrency(savedPortfolio.summary.normal.stopOutEquity, accountCurrency)} — ${formatCurrency(savedPortfolio.summary.temporary.stopOutEquity, accountCurrency)}`} />
              <MetricCard label="Max loss before stop-out" value={`${formatCurrency(savedPortfolio.summary.normal.maxLossBeforeStopOut, accountCurrency)} — ${formatCurrency(savedPortfolio.summary.temporary.maxLossBeforeStopOut, accountCurrency)}`} tone={savedPortfolio.summary.temporary.maxLossBeforeStopOut >= 0 ? "green" : "red"} />
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <MarginUsageBar equity={savedPortfolio.summary.equity} label="Margin Usage · normal" scenario={savedPortfolio.summary.normal} currency={accountCurrency} />
            <MarginUsageBar equity={savedPortfolio.summary.equity} label="Margin Usage · risk window" scenario={savedPortfolio.summary.temporary} currency={accountCurrency} />
          </div>
          <div className="mt-5">
            <AllocationChart positions={savedPortfolio.positions} currency={accountCurrency} />
          </div>
        </SectionCard>
      ) : portfolio.ok ? null : (
        <div className="rounded-[24px] border border-rose-200/20 bg-rose-300/[0.08] p-5 text-sm leading-6 text-rose-100">
          {portfolio.errors.join(" ")}
        </div>
      )}

      <SectionCard eyebrow="Add Position" icon={Plus} title="Добави позиция">
        <div className="mt-5 grid gap-4 lg:grid-cols-4">
          <Field label="Symbol" onChange={(value) => updatePositionField("symbol", value)} value={positionForm.symbol} />
          <Field label="Asset name" onChange={(value) => updatePositionField("assetName", value)} value={positionForm.assetName} />
          <SelectField
            label="Direction"
            onChange={(value) => updatePositionField("direction", value)}
            value={positionForm.direction}
          >
            <option value="buy">BUY</option>
            <option value="sell">SELL</option>
          </SelectField>
          <Field label="Instrument currency" onChange={(value) => updatePositionField("instrumentCurrency", value)} value={positionForm.instrumentCurrency} />
          <Field label="Entry price" onChange={(value) => updatePositionField("entryPrice", value)} type="number" value={positionForm.entryPrice} />
          <Field
            hint="Остави празно за планирана позиция."
            label="Current price"
            onChange={(value) => updatePositionField("currentPrice", value)}
            type="number"
            value={positionForm.currentPrice}
          />
          <Field label="Quantity / shares" onChange={(value) => updatePositionField("quantity", value)} type="number" value={positionForm.quantity} />
          <Field
            hint="Остави празно, за да наследи акаунта."
            label="Normal leverage override"
            onChange={(value) => updatePositionField("normalFixedLeverage", value)}
            type="number"
            value={positionForm.normalFixedLeverage}
          />
          <Field
            hint="Остави празно, за да наследи акаунта."
            label="Temporary leverage override"
            onChange={(value) => updatePositionField("temporaryFixedLeverage", value)}
            type="number"
            value={positionForm.temporaryFixedLeverage}
          />
          <Field label="Notes" onChange={(value) => updatePositionField("notes", value)} value={positionForm.notes} />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07]"
            onClick={() => setPreviewRequested(true)}
            type="button"
          >
            <Activity className="size-4" />
            Preview impact
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-200/20 bg-amber-300/12 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-amber-300/18 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving}
            onClick={() => void savePosition()}
            type="button"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {editingId ? "Update position" : "Save position"}
          </button>
          {editingId ? (
            <button
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07]"
              onClick={() => {
                setEditingId(null);
                setPositionForm(emptyPositionForm());
                setPreviewRequested(false);
              }}
              type="button"
            >
              <X className="size-4" />
              Cancel edit
            </button>
          ) : null}
        </div>

        {previewPortfolio ? (
          <div className="mt-5 rounded-[24px] border border-amber-200/15 bg-amber-300/[0.07] p-4">
            <p className="text-sm font-semibold text-amber-100">Preview impact</p>
            {previewPortfolio.ok ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="New total value" value={formatCurrency(previewPortfolio.summary.totalPositionValueAccount, previewPortfolio.summary.accountCurrency)} />
                <MetricCard label="Used margin 1:20" value={formatCurrency(previewPortfolio.summary.normal.usedMargin, previewPortfolio.summary.accountCurrency)} />
                <MetricCard label="Used margin 1:5" value={formatCurrency(previewPortfolio.summary.temporary.usedMargin, previewPortfolio.summary.accountCurrency)} tone="gold" />
                <MetricCard label="Margin level 1:20 / 1:5" value={`${formatPercent(previewPortfolio.summary.normal.marginLevel)} — ${formatPercent(previewPortfolio.summary.temporary.marginLevel)}`} />
              </div>
            ) : (
              <p className="mt-2 text-sm text-rose-100">{previewPortfolio.errors.join(" ")}</p>
            )}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard eyebrow="Saved Positions" icon={BriefcaseBusiness} title="Запазени позиции">
        <div className="mt-5 space-y-4">
          {savedPortfolio && savedPortfolio.positions.length > 0 ? (
            savedPortfolio.positions.map((analysis) => (
              <PositionCard
                accountCurrency={accountCurrency}
                analysis={analysis}
                deleting={deletingId === analysis.position.id}
                key={analysis.position.id}
                onDelete={() => void deletePosition(analysis.position)}
                onEdit={() => startEdit(analysis.position)}
              />
            ))
          ) : (
            <div className="rounded-[24px] border border-white/8 bg-white/[0.035] p-5 text-sm leading-6 text-slate-400">
              Все още няма запазени позиции. Добави позиция, за да видиш auto-close диапазона,
              margin натоварването и allocation картината.
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Add Funds Simulator" icon={WalletCards} title="Симулатор за добавяне на пари">
        <div className="mt-5 grid gap-4 lg:grid-cols-[0.55fr_1fr]">
          <Field
            hint="Промяната се използва веднага в сметките и може да се запази."
            label="Add funds amount"
            onChange={(value) => updateProfileField("addedFundsSimulation", value)}
            type="number"
            value={profileForm.addedFundsSimulation}
          />
          <div className="rounded-[24px] border border-white/8 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">
            Добавянето на средства увеличава equity/balance и разширява буфера преди stop-out.
            Когато въведеш сума, всички резултати в обобщението, позициите и stress test-а се
            преизчисляват автоматично.
          </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Stress Test" icon={BarChart3} title="Стрес тест на портфейла">
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <div className="space-y-4">
            <Field
              hint="Пример: 10, 20, 30 или 50."
              label="Uniform drop %"
              onChange={setUniformDrop}
              type="number"
              value={uniformDrop}
            />
            <StressResultView currency={accountCurrency} result={uniformStress} title={`Uniform Drop Test · ${uniformDrop || 0}%`} />
          </div>
          <div className="space-y-4">
            <div className="rounded-[24px] border border-white/8 bg-white/[0.035] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">Custom Crash Price Test</p>
                <InfoHint text="Празно поле = текуща/входна цена" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {positions.length > 0 ? (
                  positions.map((position) => {
                    const key = getPositionKey(position);

                    return (
                      <Field
                        key={key}
                        label={`${position.symbol} crash price`}
                        onChange={(value) =>
                          setCrashPrices((current) => ({ ...current, [key]: value }))
                        }
                        type="number"
                        value={crashPrices[key] ?? ""}
                      />
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-400">Добави позиции, за да въведеш crash prices.</p>
                )}
              </div>
            </div>
            <StressResultView currency={accountCurrency} result={customStress} title="Custom Crash Scenario" />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
