"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  ChevronDown,
  DollarSign,
  Edit3,
  Info,
  Loader2,
  Plus,
  PlusCircle,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { AddLotDrawer } from "@/components/add-lot-drawer";
import { SellPositionDrawer } from "@/components/sell-position-drawer";
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
  type SavedPortfolioLot,
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

type LotForm = {
  id?: string;
  entryPrice: string;
  quantity: string;
  plannedExitPrice: string;
  sharesToSell: string;
  notes: string;
  displayOrder: string;
};

type ApiPortfolioResponse = {
  ok: boolean;
  message?: string;
  databaseReady?: boolean;
  profile?: AccountRiskProfile;
  positions?: SavedPortfolioPosition[];
  lot?: SavedPortfolioLot;
};

type HelpTopic =
  | "equity"
  | "freeMargin"
  | "exposure"
  | "riskMarginLevel"
  | "unrealizedPnl"
  | "stopOutBuffer"
  | "accountLoad"
  | "usedRiskMargin"
  | "capacityTo50"
  | "capacityTo100"
  | "stressLoss20"
  | "margin"
  | "autoClose"
  | "risk";

type HelpContent = {
  title: string;
  what: string;
  read: string;
  example: string;
};

type PortfolioWorkbenchTab = "positions" | "allocation" | "stress";

const HELP_CONTENT: Record<HelpTopic, HelpContent> = {
  equity: {
    title: "Equity",
    what: "Текущата стойност на акаунта след плаващата печалба или загуба и add funds simulation.",
    read: "Това е базата, срещу която се смята margin натоварването. Ако equity пада, акаунтът става по-натоварен.",
    example: "При €2,000 equity брокерът гледа margin level спрямо тези €2,000, не само спрямо първоначалния депозит.",
  },
  freeMargin: {
    title: "Free Margin",
    what: "Свободният буфер след използвания margin при risk-window leverage.",
    read: "Колкото по-високо е числото, толкова повече място има преди акаунтът да стане напрегнат. Това не е чиста печалба.",
    example: "€1,457 free margin означава, че има свободно място, но то може бързо да намалее при спад в позициите.",
  },
  exposure: {
    title: "Exposure",
    what: "Общата стойност на всички отворени позиции, превърната във валутата на акаунта.",
    read: "Това показва колко пазарен риск държиш. Не означава, че цялата сума е заключена като margin.",
    example: "€2,710 exposure означава, че портфолиото реагира като позиции за €2,710, дори margin-ът да е много по-малък.",
  },
  riskMarginLevel: {
    title: "Risk Margin Level",
    what: "Брокерският margin level при risk-window leverage: equity разделено на използвания margin.",
    read: "По-високо е по-спокойно. 500%+ е леко натоварване, около 300-500% е умерено, под 200% вече е опасно.",
    example: "368% означава, че акаунтът е умерено натоварен. Не е критично, но има смисъл да следиш буфера.",
  },
  unrealizedPnl: {
    title: "Unrealized P/L",
    what: "Текущата плаваща печалба или загуба от позициите.",
    read: "Положително число вдига equity, отрицателно го намалява. Докато позициите са отворени, сумата още не е реализирана.",
    example: "-€120 Unrealized P/L означава, че equity вече е с €120 по-ниско, ако затвориш на текущите цени.",
  },
  stopOutBuffer: {
    title: "Загуба до stop-out",
    what: "Приблизителната загуба, която акаунтът може да понесе преди stop-out зоната.",
    read: "Това е най-практичният буфер: колко още загуба има място да поеме акаунтът преди принудително затваряне.",
    example: "€1,891 buffer означава, че при още около €1,891 загуба акаунтът може да стигне stop-out условията.",
  },
  accountLoad: {
    title: "Account Load",
    what: "Процентът от equity, който е зает като risk margin при временно намален leverage.",
    read: "0-20% е спокойно, 20-50% е умерено, над 50% вече е тежко натоварване, а 100% е критична зона.",
    example: "27% load означава, че около една четвърт от equity вече е натоварена като risk margin.",
  },
  usedRiskMargin: {
    title: "Used Risk Margin",
    what: "Колко margin използват позициите при risk leverage сценария.",
    read: "Това е по-консервативното margin число. Колкото расте, толкова по-бързо пада свободният буфер.",
    example: "€542 used risk margin при €2,000 equity дава около 27% account load.",
  },
  capacityTo50: {
    title: "До 50% Load",
    what: "Колко допълнителен risk margin може да се добави преди акаунтът да стигне 50% натоварване.",
    read: "Това не е препоръка да го използваш докрай. То е ориентир колко място има до тежко натоварване.",
    example: "€457 до 50% load означава, че още €457 risk margin ще преместят акаунта към по-напрегната зона.",
  },
  capacityTo100: {
    title: "До 100% Load",
    what: "Колко допълнителен risk margin остава до пълно натоварване на equity.",
    read: "Колкото по-малко е числото, толкова по-близо е акаунтът до критична margin зона.",
    example: "€1,457 до 100% load означава, че при още толкова risk margin акаунтът би бил напълно натоварен.",
  },
  stressLoss20: {
    title: "20% Stress Loss",
    what: "Ориентировъчна загуба, ако всички позиции се преместят с 20% срещу портфолиото.",
    read: "Това е бърз sanity check. За по-точни сценарии използвай отделния Stress test tab.",
    example: "-€542 означава, че при 20% спад equity би намалял приблизително с €542.",
  },
  margin: {
    title: "Margin",
    what: "Колко от акаунта се заключва за позицията.",
    read: "Горното число е normal leverage. Долното/risk число е при временно намален leverage и е по-важно при stress сценарий.",
    example: "€131 / €525 означава, че нормално позицията заключва €131, но при risk leverage може да заключи €525.",
  },
  autoClose: {
    title: "Auto-close",
    what: "Ориентировъчна цена, при която акаунтът може да стигне stop-out, ако рискът се развие срещу позицията.",
    read: "Горното число е при normal leverage. Долното/risk число е при намален leverage и обикновено е по-консервативното.",
    example: "$154 / $173 при BUY означава, че risk-window сценарият може да доведе до stop-out по-рано.",
  },
  risk: {
    title: "Risk",
    what: "Кратка оценка по buffer и margin pressure за конкретната позиция или портфолио.",
    read: "Safe е спокойно, Moderate е наблюдавай, High risk е натоварено, Critical означава, че буферът е опасно малък.",
    example: "Safe не значи без риск. Значи, че спрямо текущите настройки позицията не притиска акаунта силно.",
  },
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

function emptyLotForm(displayOrder = 0, position?: SavedPortfolioPosition): LotForm {
  return {
    entryPrice: position ? String(position.entryPrice) : "",
    quantity: "",
    plannedExitPrice: "",
    sharesToSell: "",
    notes: "",
    displayOrder: String(displayOrder),
  };
}

function lotToForm(lot: SavedPortfolioLot): LotForm {
  return {
    id: lot.id,
    entryPrice: String(lot.entryPrice),
    quantity: String(lot.quantity),
    plannedExitPrice: lot.plannedExitPrice == null ? "" : String(lot.plannedExitPrice),
    sharesToSell: lot.sharesToSell == null ? "" : String(lot.sharesToSell),
    notes: lot.notes ?? "",
    displayOrder: String(lot.displayOrder ?? 0),
  };
}

function lotFormToPayload(form: LotForm, savedPositionId: string) {
  return {
    id: form.id,
    savedPositionId,
    entryPrice: parseAmount(form.entryPrice),
    quantity: parseAmount(form.quantity),
    plannedExitPrice: parseOptionalAmount(form.plannedExitPrice),
    sharesToSell: parseOptionalAmount(form.sharesToSell),
    notes: form.notes.trim() || null,
    displayOrder: parseAmount(form.displayOrder, 0),
  };
}

function getNewLotFormKey(positionId: string) {
  return `new:${positionId}`;
}

function getLotFormKey(positionId: string, lotId: string) {
  return `${positionId}:${lotId}`;
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

function riskLabelBg(status: "safe" | "moderate" | "high" | "critical") {
  if (status === "safe") {
    return "Спокоен риск";
  }

  if (status === "moderate") {
    return "Умерен риск";
  }

  if (status === "high") {
    return "Висок риск";
  }

  return "Критичен риск";
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

function getAccountLoadPercent(result: Extract<PortfolioRiskResult, { ok: true }>) {
  const equity = result.summary.equity;
  const riskUsedMargin = result.summary.temporary.usedMargin;

  if (!Number.isFinite(riskUsedMargin) || riskUsedMargin <= 0) {
    return 0;
  }

  if (!Number.isFinite(equity) || equity <= 0) {
    return 100;
  }

  return (riskUsedMargin / equity) * 100;
}

function getAccountLoadTone(loadPercent: number) {
  if (loadPercent >= 100) {
    return "rose";
  }

  if (loadPercent >= 50) {
    return "orange";
  }

  if (loadPercent >= 20) {
    return "amber";
  }

  return "emerald";
}

function getAccountLoadLabel(loadPercent: number) {
  if (loadPercent >= 100) {
    return "критично";
  }

  if (loadPercent >= 50) {
    return "тежко натоварване";
  }

  if (loadPercent >= 20) {
    return "умерено";
  }

  return "спокойно";
}

function getCapacityToLoad(result: Extract<PortfolioRiskResult, { ok: true }>, targetLoadPercent: number) {
  const equity = result.summary.equity;
  const usedMargin = result.summary.temporary.usedMargin;

  if (!Number.isFinite(equity) || equity <= 0 || !Number.isFinite(usedMargin)) {
    return 0;
  }

  return Math.max((equity * targetLoadPercent) / 100 - usedMargin, 0);
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

function HelpTrigger({
  topic,
  label,
  openHelp,
  onToggleHelp,
  className,
}: {
  topic: HelpTopic;
  label: string;
  openHelp: HelpTopic | null;
  onToggleHelp: (topic: HelpTopic) => void;
  className?: string;
}) {
  const active = openHelp === topic;

  return (
    <button
      aria-expanded={active}
      aria-label={`Обяснение за ${label}`}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold leading-none transition",
        active
          ? "border-amber-200/45 bg-amber-200/15 text-amber-100"
          : "border-white/15 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-slate-100",
        className,
      )}
      onClick={() => onToggleHelp(topic)}
      type="button"
    >
      !
    </button>
  );
}

function HelpPanel({
  content,
  className,
  onClose,
}: {
  content: HelpContent;
  className?: string;
  onClose?: () => void;
}) {
  return (
    <div
      className={cn(
        "max-h-[min(70vh,26rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-md border border-white/10 bg-slate-950/95 p-3 text-xs leading-5 text-slate-300 shadow-2xl shadow-black/45 backdrop-blur",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-white">{content.title}</p>
        {onClose ? (
          <button
            aria-label="Затвори обяснението"
            className="inline-flex size-5 shrink-0 items-center justify-center rounded border border-white/10 text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-100"
            onClick={onClose}
            type="button"
          >
            <X className="size-3" />
          </button>
        ) : null}
      </div>
      <div className="mt-2 space-y-2">
        <div>
          <p className="text-[10px] font-medium uppercase text-slate-500">Какво показва</p>
          <p>{content.what}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase text-slate-500">Как да го четеш</p>
          <p>{content.read}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase text-slate-500">Пример</p>
          <p>{content.example}</p>
        </div>
      </div>
    </div>
  );
}

function HelpLabel({
  label,
  topic,
  openHelp,
  onToggleHelp,
  align = "left",
}: {
  label: string;
  topic: HelpTopic;
  openHelp: HelpTopic | null;
  onToggleHelp: (topic: HelpTopic) => void;
  align?: "left" | "right";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        align === "right" && "justify-end",
      )}
    >
      {label}
      <HelpTrigger
        label={label}
        onToggleHelp={onToggleHelp}
        openHelp={openHelp}
        topic={topic}
      />
    </span>
  );
}

function SummaryCell({
  label,
  value,
  hint,
  tone = "slate",
  helpTopic,
  openHelp,
  onToggleHelp,
  helpAlign = "left",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "green" | "red" | "amber" | "slate";
  helpTopic?: HelpTopic;
  openHelp?: HelpTopic | null;
  onToggleHelp?: (topic: HelpTopic) => void;
  helpAlign?: "left" | "right";
}) {
  const helpContent = helpTopic && openHelp === helpTopic ? HELP_CONTENT[helpTopic] : null;

  return (
    <div className={cn("relative min-w-0 px-3 py-3", helpContent && "z-50")}>
      <div className="flex min-w-0 items-center gap-1">
        <p className="truncate text-[10px] font-medium uppercase text-slate-500">{label}</p>
        {helpTopic && openHelp !== undefined && onToggleHelp ? (
          <HelpTrigger
            label={label}
            onToggleHelp={onToggleHelp}
            openHelp={openHelp}
            topic={helpTopic}
          />
        ) : null}
      </div>
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
      {helpContent && helpTopic && onToggleHelp ? (
        <HelpPanel
          className={cn(
            "absolute top-full mt-1",
            helpAlign === "right" ? "right-3" : "left-3",
          )}
          content={helpContent}
          onClose={() => onToggleHelp(helpTopic)}
        />
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone = "slate",
  helpTopic,
  openHelp,
  onToggleHelp,
  helpAlign = "left",
  compact = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "green" | "red" | "amber" | "slate" | "cyan";
  helpTopic?: HelpTopic;
  openHelp: HelpTopic | null;
  onToggleHelp: (topic: HelpTopic) => void;
  helpAlign?: "left" | "right";
  compact?: boolean;
}) {
  const helpContent = helpTopic && openHelp === helpTopic ? HELP_CONTENT[helpTopic] : null;

  return (
    <div
      className={cn(
        "relative min-w-0 rounded-xl border border-white/10 bg-slate-950/20",
        compact ? "p-3" : "p-4",
        helpContent && "z-50",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        {helpTopic ? (
          <HelpTrigger
            label={label}
            onToggleHelp={onToggleHelp}
            openHelp={openHelp}
            topic={helpTopic}
          />
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 truncate font-bold text-white",
          compact ? "text-xl" : "text-2xl",
          tone === "green" && "text-emerald-300",
          tone === "red" && "text-rose-300",
          tone === "amber" && "text-amber-200",
          tone === "cyan" && "text-cyan-200",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 text-sm leading-6 text-slate-500">{hint}</p> : null}
      {helpContent && helpTopic ? (
        <HelpPanel
          className={cn(
            "absolute top-full mt-2",
            helpAlign === "right" ? "right-0" : "left-0",
          )}
          content={helpContent}
          onClose={() => onToggleHelp(helpTopic)}
        />
      ) : null}
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
  tone?: "slate" | "red" | "green";
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50",
        tone === "red" && "hover:border-rose-200/25 hover:bg-rose-300/10 hover:text-rose-100",
        tone === "green" && "hover:border-emerald-200/25 hover:bg-emerald-300/10 hover:text-emerald-100",
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

function getAllocationColor(index: number) {
  const colors = [
    "bg-cyan-300/85",
    "bg-emerald-300/85",
    "bg-amber-300/85",
    "bg-rose-300/80",
    "bg-indigo-300/80",
    "bg-slate-300/70",
  ];

  return colors[index % colors.length];
}

function PortfolioAllocationChart({
  positions,
  accountCurrency,
}: {
  positions: PortfolioPositionAnalysis[];
  accountCurrency: string;
}) {
  const sortedPositions = [...positions].sort((first, second) => {
    if (second.allocationPercent !== first.allocationPercent) {
      return second.allocationPercent - first.allocationPercent;
    }

    return second.positionValueAccount - first.positionValueAccount;
  });

  return (
    <section className="rounded-lg border border-white/10 bg-[#0b1322]/80">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-cyan-100/80">
            <BarChart3 className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white">Разпределение по позиции</h2>
            <p className="truncate text-xs text-slate-500">
              Текуща стойност като процент от portfolio exposure.
            </p>
          </div>
        </div>
        <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-400">
          {positions.length} позиции
        </span>
      </div>

      {sortedPositions.length === 0 ? (
        <div className="px-4 py-6 text-sm leading-6 text-slate-400">
          Добави позиции, за да видиш разпределението.
        </div>
      ) : (
        <div className="max-h-80 space-y-3 overflow-y-auto px-4 py-3">
          {sortedPositions.map((analysis, index) => {
            const position = analysis.position;
            const allocation = clampPercent(analysis.allocationPercent);
            const isLargest = index === 0;

            return (
              <div
                className={cn(
                  "rounded-md border px-3 py-2.5",
                  isLargest
                    ? "border-cyan-200/20 bg-cyan-300/[0.045]"
                    : "border-white/8 bg-white/[0.018]",
                )}
                key={position.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white">{position.symbol}</p>
                      {isLargest ? (
                        <span className="rounded-md border border-cyan-200/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-cyan-100">
                          най-голяма
                        </span>
                      ) : null}
                    </div>
                    {position.assetName ? (
                      <p className="mt-0.5 max-w-full truncate text-xs text-slate-500">
                        {position.assetName}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-left text-xs text-slate-400 sm:text-right">
                    <p className="font-semibold text-slate-100">
                      {formatPercent(analysis.allocationPercent)}
                    </p>
                    <p>
                      {formatNumber(position.quantity, 2)} акции ·{" "}
                      {formatCurrency(analysis.positionValueAccount, accountCurrency)}
                    </p>
                    {position.instrumentCurrency !== accountCurrency ? (
                      <p className="text-slate-500">
                        {formatCurrency(analysis.positionValueInstrument, position.instrumentCurrency)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-950/65">
                  <div
                    aria-label={`${position.symbol} ${formatPercent(analysis.allocationPercent)} от портфолиото`}
                    className={cn("h-full rounded-full", getAllocationColor(index))}
                    style={{ width: `${allocation}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PositionLotsPanel({
  analysis,
  accountCurrency,
  lotForms,
  savingLotId,
  deletingLotId,
  onLotFormChange,
  onSaveLot,
  onDeleteLot,
}: {
  analysis: PortfolioPositionAnalysis;
  accountCurrency: string;
  lotForms: Record<string, LotForm>;
  savingLotId: string | null;
  deletingLotId: string | null;
  onLotFormChange: (key: string, field: keyof LotForm, value: string) => void;
  onSaveLot: (position: SavedPortfolioPosition, formKey: string, lot?: SavedPortfolioLot) => void;
  onDeleteLot: (position: SavedPortfolioPosition, lot: SavedPortfolioLot) => void;
}) {
  const position = analysis.position;
  const instrumentCurrency = position.instrumentCurrency;
  const lots = position.lots ?? [];
  const newFormKey = getNewLotFormKey(position.id);
  const newForm =
    lotForms[newFormKey] ??
    emptyLotForm(lots.length, {
      ...position,
      entryPrice: analysis.basePrice,
    });
  const plannedSummary = analysis.plannedExitSummary;

  return (
    <div className="space-y-4 rounded-md border border-white/8 bg-slate-950/25 p-3">
      <div className="grid gap-3 text-xs sm:grid-cols-4">
        <div>
          <p className="text-slate-500">Общо акции</p>
          <p className="mt-0.5 font-semibold text-slate-100">
            {formatNumber(position.quantity, 2)}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Средна цена</p>
          <p className="mt-0.5 font-semibold text-slate-100">
            {formatCurrency(position.entryPrice, instrumentCurrency)}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Планирана продажба</p>
          <p className="mt-0.5 font-semibold text-slate-100">
            {plannedSummary
              ? formatCurrency(plannedSummary.totalPlannedSaleValueInstrument, instrumentCurrency)
              : "няма цел"}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Очаквана печалба</p>
          <p
            className={cn(
              "mt-0.5 font-semibold",
              plannedSummary && plannedSummary.totalPlannedProfitAccount < 0
                ? "text-rose-100"
                : "text-emerald-100",
            )}
          >
            {plannedSummary
              ? `${formatCurrency(
                  plannedSummary.totalPlannedProfitAccount,
                  accountCurrency,
                )} · ${formatCurrency(
                  plannedSummary.totalPlannedProfitInstrument,
                  instrumentCurrency,
                )}`
              : "добави цена на продажба"}
          </p>
        </div>
      </div>

      {lots.length === 0 ? (
        <p className="rounded-md border border-white/8 bg-white/[0.02] px-3 py-2 text-xs leading-5 text-slate-400">
          Няма добавени покупки. Добави покупки по-долу – те се включват в средната цена,
          експозицията и маржина. Докато няма покупки, сметката използва директно цената и
          количеството на позицията.
        </p>
      ) : (
        <div className="space-y-2">
          {lots.map((lot, index) => {
            const formKey = getLotFormKey(position.id, lot.id);
            const form = lotForms[formKey] ?? lotToForm(lot);
            const lotAnalysis = analysis.lotAnalyses.find((item) => item.lot.id === lot.id);
            const plannedProfit = lotAnalysis?.plannedProfitAccount;

            const lotName =
              lot.notes === "Начална позиция" ? "Начална позиция" : `Покупка ${index + 1}`;
            return (
              <div
                className="rounded-md border border-white/8 bg-white/[0.018] p-2"
                key={lot.id}
              >
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {lotName}
                </p>
                <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_1fr_minmax(8rem,1.2fr)_auto]">
                  <Field
                    label="Цена"
                    onChange={(value) => onLotFormChange(formKey, "entryPrice", value)}
                    type="number"
                    value={form.entryPrice}
                  />
                  <Field
                    label="Количество"
                    onChange={(value) => onLotFormChange(formKey, "quantity", value)}
                    type="number"
                    value={form.quantity}
                  />
                  <Field
                    label="Цена продажба"
                    onChange={(value) => onLotFormChange(formKey, "plannedExitPrice", value)}
                    type="number"
                    value={form.plannedExitPrice}
                  />
                  <Field
                    hint="Празно = цялото количество."
                    label="Бр. за продажба"
                    onChange={(value) => onLotFormChange(formKey, "sharesToSell", value)}
                    type="number"
                    value={form.sharesToSell}
                  />
                  <Field
                    label="Бележки"
                    onChange={(value) => onLotFormChange(formKey, "notes", value)}
                    value={form.notes}
                  />
                  <div className="flex items-end justify-between gap-2 md:justify-end">
                    <div className="pb-1 text-xs">
                      <p className="text-slate-500">Печалба</p>
                      <p
                        className={cn(
                          "font-semibold",
                          plannedProfit == null
                            ? "text-slate-400"
                            : plannedProfit < 0
                              ? "text-rose-100"
                              : "text-emerald-100",
                        )}
                      >
                        {plannedProfit == null
                          ? "—"
                          : formatCurrency(plannedProfit, accountCurrency)}
                      </p>
                    </div>
                    <IconButton
                      disabled={savingLotId === lot.id}
                      label={`Запази ${lotName}`}
                      onClick={() => onSaveLot(position, formKey, lot)}
                    >
                      {savingLotId === lot.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                    </IconButton>
                    <IconButton
                      disabled={deletingLotId === lot.id}
                      label={`Изтрий ${lotName}`}
                      onClick={() => onDeleteLot(position, lot)}
                      tone="red"
                    >
                      {deletingLotId === lot.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </IconButton>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-white/8 pt-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Нова покупка
        </p>
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_1fr_minmax(8rem,1.2fr)_auto]">
          <Field
            label="Цена"
            onChange={(value) => onLotFormChange(newFormKey, "entryPrice", value)}
            type="number"
            value={newForm.entryPrice}
          />
          <Field
            label="Количество"
            onChange={(value) => onLotFormChange(newFormKey, "quantity", value)}
            type="number"
            value={newForm.quantity}
          />
          <Field
            label="Цена продажба"
            onChange={(value) => onLotFormChange(newFormKey, "plannedExitPrice", value)}
            type="number"
            value={newForm.plannedExitPrice}
          />
          <Field
            hint="Празно = цялото количество."
            label="Бр. за продажба"
            onChange={(value) => onLotFormChange(newFormKey, "sharesToSell", value)}
            type="number"
            value={newForm.sharesToSell}
          />
          <Field
            label="Бележки"
            onChange={(value) => onLotFormChange(newFormKey, "notes", value)}
            value={newForm.notes}
          />
          <div className="flex items-end">
            <button
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-emerald-200/20 bg-emerald-300/10 px-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
              disabled={savingLotId === newFormKey}
              onClick={() => onSaveLot(position, newFormKey)}
              type="button"
            >
              {savingLotId === newFormKey ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Добави покупка
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PositionsTable({
  positions,
  accountCurrency,
  stopOutLossAccount,
  onEdit,
  onDelete,
  onAddLot,
  onSell,
  deletingId,
  expandedPositionId,
  lotForms,
  savingLotId,
  deletingLotId,
  onTogglePosition,
  onLotFormChange,
  onSaveLot,
  onDeleteLot,
  openHelp,
  onToggleHelp,
}: {
  positions: PortfolioPositionAnalysis[];
  accountCurrency: string;
  stopOutLossAccount: number;
  onEdit: (position: SavedPortfolioPosition) => void;
  onDelete: (position: SavedPortfolioPosition) => void;
  onAddLot: (position: SavedPortfolioPosition) => void;
  onSell: (position: SavedPortfolioPosition) => void;
  deletingId: string | null;
  expandedPositionId: string | null;
  lotForms: Record<string, LotForm>;
  savingLotId: string | null;
  deletingLotId: string | null;
  onTogglePosition: (position: SavedPortfolioPosition) => void;
  onLotFormChange: (key: string, field: keyof LotForm, value: string) => void;
  onSaveLot: (position: SavedPortfolioPosition, formKey: string, lot?: SavedPortfolioLot) => void;
  onDeleteLot: (position: SavedPortfolioPosition, lot: SavedPortfolioLot) => void;
  openHelp: HelpTopic | null;
  onToggleHelp: (topic: HelpTopic) => void;
}) {
  const tableHelpTopic =
    openHelp === "margin" || openHelp === "autoClose" || openHelp === "risk" ? openHelp : null;

  return (
    <section className="relative rounded-lg border border-white/10 bg-[#0b1322]/80">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-white">Позиции</h2>
          <p className="text-xs text-slate-500">
            Ръчни цени, margin и stop-out по всяка позиция.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex flex-wrap items-center gap-1 lg:hidden">
            <button
              className="inline-flex h-7 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[11px] font-medium text-slate-300"
              onClick={() => onToggleHelp("margin")}
              type="button"
            >
              Margin
              <span
                className={cn(
                  "inline-flex size-4 items-center justify-center rounded-full border text-[10px] font-bold leading-none",
                  openHelp === "margin"
                    ? "border-amber-200/45 bg-amber-200/15 text-amber-100"
                    : "border-white/15 bg-white/[0.03] text-slate-400",
                )}
              >
                !
              </span>
            </button>
            <button
              className="inline-flex h-7 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[11px] font-medium text-slate-300"
              onClick={() => onToggleHelp("autoClose")}
              type="button"
            >
              Auto-close
              <span
                className={cn(
                  "inline-flex size-4 items-center justify-center rounded-full border text-[10px] font-bold leading-none",
                  openHelp === "autoClose"
                    ? "border-amber-200/45 bg-amber-200/15 text-amber-100"
                    : "border-white/15 bg-white/[0.03] text-slate-400",
                )}
              >
                !
              </span>
            </button>
            <button
              className="inline-flex h-7 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[11px] font-medium text-slate-300"
              onClick={() => onToggleHelp("risk")}
              type="button"
            >
              Risk
              <span
                className={cn(
                  "inline-flex size-4 items-center justify-center rounded-full border text-[10px] font-bold leading-none",
                  openHelp === "risk"
                    ? "border-amber-200/45 bg-amber-200/15 text-amber-100"
                    : "border-white/15 bg-white/[0.03] text-slate-400",
                )}
              >
                !
              </span>
            </button>
          </div>
          <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-400">
            {positions.length} позиции
          </span>
        </div>
      </div>

      {tableHelpTopic ? (
        <HelpPanel
          className="absolute right-4 top-16 z-50"
          content={HELP_CONTENT[tableHelpTopic]}
          onClose={() => onToggleHelp(tableHelpTopic)}
        />
      ) : null}

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
                  <th className="px-3 py-2 text-right font-medium">
                    <HelpLabel
                      align="right"
                      label="Margin"
                      onToggleHelp={onToggleHelp}
                      openHelp={openHelp}
                      topic="margin"
                    />
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    <HelpLabel
                      align="right"
                      label="Auto-close"
                      onToggleHelp={onToggleHelp}
                      openHelp={openHelp}
                      topic="autoClose"
                    />
                  </th>
                  <th className="px-3 py-2 font-medium">
                    <HelpLabel
                      label="Risk"
                      onToggleHelp={onToggleHelp}
                      openHelp={openHelp}
                      topic="risk"
                    />
                  </th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {positions.map((analysis) => {
                  const position = analysis.position;
                  const instrumentCurrency = position.instrumentCurrency;
                  const isExpanded = expandedPositionId === position.id;

                  return (
                    <Fragment key={position.id}>
                      <tr className="align-top text-slate-300">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-white">{position.symbol}</p>
                          {position.assetName ? (
                            <p className="mt-0.5 max-w-36 truncate text-xs text-slate-500">
                              {position.assetName}
                            </p>
                          ) : null}
                          {position.lots && position.lots.length > 0 ? (
                            <p className="mt-1 text-[11px] text-cyan-100/75">
                              {position.lots.length} покупки · ср. цена
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-md border border-white/10 px-2 py-1 text-xs">
                            {directionLabel(position.direction)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {formatNumber(position.quantity, 2)}
                        </td>
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
                            {formatCurrency(analysis.positionValueInstrument, instrumentCurrency)} ·{" "}
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
                          <p className="text-xs text-slate-500">
                            loss ~{formatCurrency(stopOutLossAccount, accountCurrency)}
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
                            <IconButton
                              label={`${isExpanded ? "Скрий" : "Покажи"} покупките за ${position.symbol}`}
                              onClick={() => onTogglePosition(position)}
                            >
                              <ChevronDown
                                className={cn("size-4 transition", isExpanded && "rotate-180")}
                              />
                            </IconButton>
                            <IconButton label={`Добави лот към ${position.symbol}`} onClick={() => onAddLot(position)}>
                              <PlusCircle className="size-4" />
                            </IconButton>
                            <IconButton label={`Продай от ${position.symbol}`} onClick={() => onSell(position)} tone="green">
                              <DollarSign className="size-4" />
                            </IconButton>
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
                      {isExpanded ? (
                        <tr>
                          <td className="px-4 pb-4" colSpan={9}>
                            <PositionLotsPanel
                              accountCurrency={accountCurrency}
                              analysis={analysis}
                              deletingLotId={deletingLotId}
                              lotForms={lotForms}
                              onDeleteLot={onDeleteLot}
                              onLotFormChange={onLotFormChange}
                              onSaveLot={onSaveLot}
                              savingLotId={savingLotId}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 p-3 lg:hidden">
            {positions.map((analysis) => {
              const position = analysis.position;
              const instrumentCurrency = position.instrumentCurrency;
              const isExpanded = expandedPositionId === position.id;

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
                      <IconButton
                        label={`${isExpanded ? "Скрий" : "Покажи"} лотове за ${position.symbol}`}
                        onClick={() => onTogglePosition(position)}
                      >
                        <ChevronDown
                          className={cn("size-4 transition", isExpanded && "rotate-180")}
                        />
                      </IconButton>
                      <IconButton label={`Добави лот към ${position.symbol}`} onClick={() => onAddLot(position)}>
                        <PlusCircle className="size-4" />
                      </IconButton>
                      <IconButton label={`Продай от ${position.symbol}`} onClick={() => onSell(position)} tone="green">
                        <DollarSign className="size-4" />
                      </IconButton>
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
                      <p className="text-[11px] text-slate-500">
                        {formatCurrency(analysis.positionValueInstrument, instrumentCurrency)} ·{" "}
                        {formatPercent(analysis.allocationPercent)}
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
                      <p className="text-[11px] text-slate-500">
                        loss ~{formatCurrency(stopOutLossAccount, accountCurrency)}
                      </p>
                    </div>
                  </div>
                  {analysis.warnings.length > 0 ? (
                    <p className="mt-3 text-xs leading-5 text-rose-200">
                      {analysis.warnings.join(" ")}
                    </p>
                  ) : null}
                  {isExpanded ? (
                    <div className="mt-3">
                      <PositionLotsPanel
                        accountCurrency={accountCurrency}
                        analysis={analysis}
                        deletingLotId={deletingLotId}
                        lotForms={lotForms}
                        onDeleteLot={onDeleteLot}
                        onLotFormChange={onLotFormChange}
                        onSaveLot={onSaveLot}
                        savingLotId={savingLotId}
                      />
                    </div>
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

function RiskMetricRow({
  label,
  value,
  tone = "slate",
  helpTopic,
  openHelp,
  onToggleHelp,
}: {
  label: string;
  value: string;
  tone?: "slate" | "green" | "red" | "amber";
  helpTopic?: HelpTopic;
  openHelp?: HelpTopic | null;
  onToggleHelp?: (topic: HelpTopic) => void;
}) {
  const showHelp = helpTopic && openHelp === helpTopic;

  return (
    <div className="relative flex items-center justify-between gap-3 border-b border-white/8 py-2 last:border-b-0">
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        {label}
        {helpTopic && onToggleHelp ? (
          <HelpTrigger
            label={label}
            onToggleHelp={onToggleHelp}
            openHelp={openHelp ?? null}
            topic={helpTopic}
          />
        ) : null}
      </span>
      <span
        className={cn(
          "text-sm font-semibold text-slate-300",
          tone === "green" && "text-emerald-300",
          tone === "red" && "text-rose-300",
          tone === "amber" && "text-amber-200",
        )}
      >
        {value}
      </span>
      {showHelp && helpTopic && onToggleHelp ? (
        <HelpPanel
          className="absolute left-0 top-full z-50 mt-2"
          content={HELP_CONTENT[helpTopic]}
          onClose={() => onToggleHelp(helpTopic)}
        />
      ) : null}
    </div>
  );
}

function RiskGaugeSidebar({
  portfolio,
  accountCurrency,
  accountLoadPercent,
  capacityTo50,
  capacityTo100,
  stressLoss20,
  openHelp,
  onToggleHelp,
}: {
  portfolio: Extract<PortfolioRiskResult, { ok: true }>;
  accountCurrency: string;
  accountLoadPercent: number;
  capacityTo50: number;
  capacityTo100: number;
  stressLoss20: number;
  openHelp: HelpTopic | null;
  onToggleHelp: (topic: HelpTopic) => void;
}) {
  const marker = clampPercent(accountLoadPercent);
  const angle = Math.PI * (1 - marker / 100);
  const needleX = 120 + Math.cos(angle) * 72;
  const needleY = 118 - Math.sin(angle) * 72;
  const tone = getAccountLoadTone(accountLoadPercent);
  const riskMargin = portfolio.summary.temporary.marginLevel;

  return (
    <aside className="border-b border-white/10 bg-[#0b1322]/80 p-4 lg:border-b-0 lg:border-r">
      <div className="mx-auto max-w-sm">
        <div className="rounded-xl border border-white/10 bg-slate-950/20 px-4 pb-4 pt-5">
          <div className="relative mx-auto h-44 w-full max-w-[17rem]">
            <svg aria-label="Account load gauge" className="h-full w-full" viewBox="0 0 240 155">
              <path
                d="M36 118 A84 84 0 0 1 83 43"
                fill="none"
                stroke="rgba(116,228,176,0.72)"
                strokeLinecap="round"
                strokeWidth="18"
              />
              <path
                d="M83 43 A84 84 0 0 1 157 43"
                fill="none"
                stroke="rgba(245,207,88,0.78)"
                strokeLinecap="round"
                strokeWidth="18"
              />
              <path
                d="M157 43 A84 84 0 0 1 204 118"
                fill="none"
                stroke="rgba(251,113,133,0.68)"
                strokeLinecap="round"
                strokeWidth="18"
              />
              <line
                stroke="rgba(255,255,255,0.92)"
                strokeLinecap="round"
                strokeWidth="5"
                x1="120"
                x2={needleX}
                y1="118"
                y2={needleY}
              />
              <circle
                cx="120"
                cy="118"
                fill="#0b1322"
                r="11"
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="3"
              />
              <circle cx="120" cy="118" fill="rgba(255,255,255,0.88)" r="3" />
            </svg>
            <div className="absolute inset-x-0 bottom-0 text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] font-semibold text-slate-300">
                <span className="size-1.5 rounded-full bg-emerald-300" />
                0-20
                <span className="size-1.5 rounded-full bg-amber-300" />
                20-50
                <span className="size-1.5 rounded-full bg-rose-300" />
                50-100
              </span>
            </div>
          </div>

          <div className="relative text-center">
            <div className="flex items-center justify-center gap-2">
              <p className="text-5xl font-black tracking-tight text-white">
                {formatPercent(accountLoadPercent)}
              </p>
              <HelpTrigger
                label="Account load"
                onToggleHelp={onToggleHelp}
                openHelp={openHelp}
                topic="accountLoad"
              />
            </div>
            <p
              className={cn(
                "mt-2 text-2xl font-black",
                tone === "emerald" && "text-emerald-300",
                tone === "amber" && "text-amber-200",
                tone === "orange" && "text-orange-200",
                tone === "rose" && "text-rose-300",
              )}
            >
              {riskLabelBg(portfolio.summary.riskStatus)}
            </p>
            <p className="mt-1 text-sm text-slate-500">Account load при risk leverage</p>
            {openHelp === "accountLoad" ? (
              <HelpPanel
                className="absolute left-1/2 z-50 mt-2 -translate-x-1/2"
                content={HELP_CONTENT.accountLoad}
                onClose={() => onToggleHelp("accountLoad")}
              />
            ) : null}
          </div>

          <div className="mt-5">
            <div className="relative h-2 overflow-hidden rounded-full bg-slate-950/60">
              <div className="flex h-full">
                <span className="basis-[20%] bg-emerald-300/75" />
                <span className="basis-[30%] bg-amber-300/80" />
                <span className="flex-1 bg-orange-300/75" />
              </div>
              <span
                className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.55)]"
                style={{ left: `${marker}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-slate-500">
              <span>0%</span>
              <span>20%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3">
          <KpiCard
            helpTopic="stopOutBuffer"
            hint="загуба, която акаунтът може да понесе приблизително"
            label="Загуба до stop-out"
            onToggleHelp={onToggleHelp}
            openHelp={openHelp}
            value={formatCurrency(portfolio.summary.temporary.maxLossBeforeStopOut, accountCurrency)}
          />
          <KpiCard
            helpTopic="stressLoss20"
            hint="примерен спад върху всички позиции"
            label="20% Stress Loss"
            onToggleHelp={onToggleHelp}
            openHelp={openHelp}
            tone="red"
            value={Number.isFinite(stressLoss20) ? `-${formatCurrency(stressLoss20, accountCurrency)}` : "няма позиции"}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <KpiCard
              compact
              helpTopic="capacityTo50"
              hint="допълнителен risk margin до тежка зона"
              label="До 50% load"
              onToggleHelp={onToggleHelp}
              openHelp={openHelp}
              tone="amber"
              value={formatCurrency(capacityTo50, accountCurrency)}
            />
            <KpiCard
              compact
              helpTopic="capacityTo100"
              hint="допълнителен risk margin до критична зона"
              label="До 100% load"
              onToggleHelp={onToggleHelp}
              openHelp={openHelp}
              tone="red"
              value={formatCurrency(capacityTo100, accountCurrency)}
            />
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/20 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Account snapshot
            </p>
            <StatusBadge status={portfolio.summary.riskStatus} />
          </div>
          <RiskMetricRow
            label="Equity"
            helpTopic="equity"
            onToggleHelp={onToggleHelp}
            openHelp={openHelp}
            value={formatCurrency(portfolio.summary.equity, accountCurrency)}
          />
          <RiskMetricRow
            label="Free margin"
            helpTopic="freeMargin"
            onToggleHelp={onToggleHelp}
            openHelp={openHelp}
            tone={portfolio.summary.temporary.freeMargin >= 0 ? "green" : "red"}
            value={formatCurrency(portfolio.summary.temporary.freeMargin, accountCurrency)}
          />
          <RiskMetricRow
            label="Used risk margin"
            helpTopic="usedRiskMargin"
            onToggleHelp={onToggleHelp}
            openHelp={openHelp}
            value={formatCurrency(portfolio.summary.temporary.usedMargin, accountCurrency)}
          />
          <RiskMetricRow
            label="Margin level"
            helpTopic="riskMarginLevel"
            onToggleHelp={onToggleHelp}
            openHelp={openHelp}
            tone={riskMargin >= 200 ? "green" : "amber"}
            value={formatPercent(riskMargin)}
          />
          <RiskMetricRow
            label="Exposure"
            helpTopic="exposure"
            onToggleHelp={onToggleHelp}
            openHelp={openHelp}
            value={formatCurrency(portfolio.summary.totalPositionValueAccount, accountCurrency)}
          />
          <RiskMetricRow
            label="Unrealized P/L"
            helpTopic="unrealizedPnl"
            onToggleHelp={onToggleHelp}
            openHelp={openHelp}
            tone={portfolio.summary.totalUnrealizedPnLAccount >= 0 ? "green" : "red"}
            value={formatCurrency(portfolio.summary.totalUnrealizedPnLAccount, accountCurrency)}
          />
        </div>
      </div>
    </aside>
  );
}

function ActionPill({
  children,
  onClick,
  tone = "slate",
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "slate" | "blue" | "green";
}) {
  return (
    <button
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition",
        tone === "slate" &&
          "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]",
        tone === "blue" &&
          "border-blue-300/20 bg-blue-400/15 text-blue-100 hover:bg-blue-400/20",
        tone === "green" &&
          "border-emerald-300/20 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/20",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function PositionCards({
  positions,
  accountCurrency,
  stopOutLossAccount,
  openHelp,
  onToggleHelp,
  onEdit,
  onDelete,
  onAddLot,
  onSell,
  deletingId,
  expandedPositionId,
  lotForms,
  savingLotId,
  deletingLotId,
  onTogglePosition,
  onLotFormChange,
  onSaveLot,
  onDeleteLot,
}: {
  positions: PortfolioPositionAnalysis[];
  accountCurrency: string;
  stopOutLossAccount: number;
  openHelp: HelpTopic | null;
  onToggleHelp: (topic: HelpTopic) => void;
  onEdit: (position: SavedPortfolioPosition) => void;
  onDelete: (position: SavedPortfolioPosition) => void;
  onAddLot: (position: SavedPortfolioPosition) => void;
  onSell: (position: SavedPortfolioPosition) => void;
  deletingId: string | null;
  expandedPositionId: string | null;
  lotForms: Record<string, LotForm>;
  savingLotId: string | null;
  deletingLotId: string | null;
  onTogglePosition: (position: SavedPortfolioPosition) => void;
  onLotFormChange: (key: string, field: keyof LotForm, value: string) => void;
  onSaveLot: (position: SavedPortfolioPosition, formKey: string, lot?: SavedPortfolioLot) => void;
  onDeleteLot: (position: SavedPortfolioPosition, lot: SavedPortfolioLot) => void;
}) {
  if (positions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.015] px-4 py-8 text-center text-sm text-slate-400">
        Все още няма позиции. Използвай “Нова позиция”, за да добавиш първата.
      </div>
    );
  }

  const tableHelpTopic =
    openHelp === "margin" || openHelp === "autoClose" || openHelp === "risk" ? openHelp : null;

  return (
    <section className="relative rounded-xl border border-white/10 bg-slate-950/15">
      {tableHelpTopic ? (
        <HelpPanel
          className="absolute right-3 top-12 z-50"
          content={HELP_CONTENT[tableHelpTopic]}
          onClose={() => onToggleHelp(tableHelpTopic)}
        />
      ) : null}

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="border-b border-white/10 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-bold">Symbol</th>
              <th className="px-3 py-3 font-bold">Side</th>
              <th className="px-3 py-3 text-right font-bold">Qty</th>
              <th className="px-3 py-3 text-right font-bold">Value</th>
              <th className="px-3 py-3 text-right font-bold">
                <HelpLabel
                  align="right"
                  label="Margin"
                  onToggleHelp={onToggleHelp}
                  openHelp={openHelp}
                  topic="margin"
                />
              </th>
              <th className="px-3 py-3 text-right font-bold">
                <HelpLabel
                  align="right"
                  label="Auto-close"
                  onToggleHelp={onToggleHelp}
                  openHelp={openHelp}
                  topic="autoClose"
                />
              </th>
              <th className="px-3 py-3 font-bold">
                <HelpLabel
                  label="Risk"
                  onToggleHelp={onToggleHelp}
                  openHelp={openHelp}
                  topic="risk"
                />
              </th>
              <th className="px-4 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {positions.map((analysis) => {
              const position = analysis.position;
              const lots = position.lots ?? [];
              const isExpanded = expandedPositionId === position.id;
              const instrumentCurrency = position.instrumentCurrency;

              return (
                <Fragment key={position.id}>
                  <tr className="align-middle text-slate-300">
                    <td className="px-4 py-4">
                      <button
                        className="group text-left"
                        onClick={() => onTogglePosition(position)}
                        type="button"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base font-black text-white group-hover:text-cyan-100">
                            {position.symbol}
                          </span>
                          <ChevronDown
                            className={cn(
                              "size-4 text-slate-500 transition group-hover:text-slate-200",
                              isExpanded && "rotate-180",
                            )}
                          />
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {lots.length} {lots.length === 1 ? "лот" : "лота"} ·{" "}
                          {formatPercent(analysis.allocationPercent)} allocation
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-4">
                      <span className="inline-flex min-w-20 justify-center rounded-md border border-emerald-200/20 bg-emerald-300/10 px-2 py-1 text-xs font-black text-emerald-200">
                        {directionLabel(position.direction)}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right font-bold text-white">
                      {formatNumber(position.quantity, 2)}
                    </td>
                    <td className="px-3 py-4 text-right">
                      <p className="font-bold text-white">
                        {formatCurrency(analysis.positionValueAccount, accountCurrency)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatCurrency(analysis.positionValueInstrument, instrumentCurrency)}
                      </p>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <p className="font-bold text-white">
                        {formatCurrency(analysis.normalUsedMargin, accountCurrency)}
                      </p>
                      <p className="text-xs font-semibold text-amber-200">
                        {formatCurrency(analysis.temporaryUsedMargin, accountCurrency)} risk
                      </p>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <p className="font-bold text-rose-300">
                        {formatCurrency(
                          analysis.temporaryAutoClose.displayAutoClosePrice,
                          instrumentCurrency,
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        loss ~{formatCurrency(stopOutLossAccount, accountCurrency)}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <StatusBadge status={analysis.riskBadge} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <ActionPill onClick={() => onAddLot(position)} tone="blue">
                          <PlusCircle className="size-4" />
                          Лот
                        </ActionPill>
                        <ActionPill onClick={() => onSell(position)} tone="green">
                          <DollarSign className="size-4" />
                          Продай
                        </ActionPill>
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
                  {isExpanded ? (
                    <tr>
                      <td className="px-4 pb-4" colSpan={8}>
                        <PositionLotsPanel
                          accountCurrency={accountCurrency}
                          analysis={analysis}
                          deletingLotId={deletingLotId}
                          lotForms={lotForms}
                          onDeleteLot={onDeleteLot}
                          onLotFormChange={onLotFormChange}
                          onSaveLot={onSaveLot}
                          savingLotId={savingLotId}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 p-3 lg:hidden">
        {positions.map((analysis) => {
          const position = analysis.position;
          const lots = position.lots ?? [];
          const isExpanded = expandedPositionId === position.id;
          const instrumentCurrency = position.instrumentCurrency;

          return (
            <article
              className="rounded-lg border border-white/10 bg-white/[0.025] p-3"
              key={position.id}
            >
              <div className="flex items-start justify-between gap-3">
                <button className="min-w-0 text-left" onClick={() => onTogglePosition(position)} type="button">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-white">{position.symbol}</p>
                    <span className="rounded-md border border-emerald-200/20 bg-emerald-300/10 px-2 py-0.5 text-xs font-bold text-emerald-200">
                      {directionLabel(position.direction)}
                    </span>
                    <StatusBadge status={analysis.riskBadge} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {lots.length} {lots.length === 1 ? "лот" : "лота"} ·{" "}
                    {formatPercent(analysis.allocationPercent)} allocation
                  </p>
                </button>
                <IconButton
                  label={`${isExpanded ? "Скрий" : "Покажи"} лотовете за ${position.symbol}`}
                  onClick={() => onTogglePosition(position)}
                >
                  <ChevronDown className={cn("size-4 transition", isExpanded && "rotate-180")} />
                </IconButton>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-500">Qty</p>
                  <p className="font-semibold text-white">{formatNumber(position.quantity, 2)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Value</p>
                  <p className="font-semibold text-white">
                    {formatCurrency(analysis.positionValueAccount, accountCurrency)}
                  </p>
                  <p className="text-slate-500">
                    {formatCurrency(analysis.positionValueInstrument, instrumentCurrency)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Margin risk</p>
                  <p className="font-semibold text-amber-200">
                    {formatCurrency(analysis.temporaryUsedMargin, accountCurrency)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Auto-close</p>
                  <p className="font-semibold text-rose-300">
                    {formatCurrency(
                      analysis.temporaryAutoClose.displayAutoClosePrice,
                      instrumentCurrency,
                    )}
                  </p>
                  <p className="text-slate-500">
                    loss ~{formatCurrency(stopOutLossAccount, accountCurrency)}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <ActionPill onClick={() => onAddLot(position)} tone="blue">
                  <PlusCircle className="size-4" />
                  Лот
                </ActionPill>
                <ActionPill onClick={() => onSell(position)} tone="green">
                  <DollarSign className="size-4" />
                  Продай
                </ActionPill>
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

              {isExpanded ? (
                <div className="mt-3">
                  <PositionLotsPanel
                    accountCurrency={accountCurrency}
                    analysis={analysis}
                    deletingLotId={deletingLotId}
                    lotForms={lotForms}
                    onDeleteLot={onDeleteLot}
                    onLotFormChange={onLotFormChange}
                    onSaveLot={onSaveLot}
                    savingLotId={savingLotId}
                  />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
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
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewRequested, setPreviewRequested] = useState(false);
  const [uniformDrop, setUniformDrop] = useState("20");
  const [crashPrices, setCrashPrices] = useState<Record<string, string>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stressOpen, setStressOpen] = useState(false);
  const [openHelp, setOpenHelp] = useState<HelpTopic | null>(null);
  const [activeWorkbenchTab, setActiveWorkbenchTab] = useState<PortfolioWorkbenchTab>("positions");
  const [positionEditorOpen, setPositionEditorOpen] = useState(false);
  const [expandedPositionId, setExpandedPositionId] = useState<string | null>(null);
  const [lotForms, setLotForms] = useState<Record<string, LotForm>>({});
  const [savingLotId, setSavingLotId] = useState<string | null>(null);
  const [deletingLotId, setDeletingLotId] = useState<string | null>(null);
  const [addLotTarget, setAddLotTarget] = useState<SavedPortfolioPosition | null>(null);
  const [sellTarget, setSellTarget] = useState<SavedPortfolioPosition | null>(null);

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
  const quickStress20 = useMemo(
    () => calculateUniformDropStress(profile, positions, 20),
    [positions, profile],
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
      setWarning(null);

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
        applyApiNotice(data);
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

  function togglePositionDetails(position: SavedPortfolioPosition) {
    setExpandedPositionId((current) => (current === position.id ? null : position.id));
    setLotForms((current) => {
      const next = { ...current };
      const lots = position.lots ?? [];

      lots.forEach((lot) => {
        const key = getLotFormKey(position.id, lot.id);

        if (!next[key]) {
          next[key] = lotToForm(lot);
        }
      });

      const newKey = getNewLotFormKey(position.id);

      if (!next[newKey]) {
        next[newKey] = emptyLotForm(lots.length, {
          ...position,
          entryPrice: position.currentPrice ?? position.entryPrice,
        });
      }

      return next;
    });
  }

  function updateLotForm(key: string, field: keyof LotForm, value: string) {
    setLotForms((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? emptyLotForm()),
        [field]: value,
      },
    }));
  }

  function applyApiNotice(data: ApiPortfolioResponse) {
    setWarning(data.databaseReady === false && data.message ? data.message : null);
  }

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setWarning(null);
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
      applyApiNotice(data);
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
    setWarning(null);
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
      applyApiNotice(data);
      setPositionForm(emptyPositionForm());
      setEditingId(null);
      setPositionEditorOpen(false);
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
    setWarning(null);
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
      applyApiNotice(data);
      setMessage("Позицията е изтрита.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    } finally {
      setDeletingId(null);
    }
  }

  async function saveLot(
    position: SavedPortfolioPosition,
    formKey: string,
    lot?: SavedPortfolioLot,
  ) {
    const form = lotForms[formKey] ?? (lot ? lotToForm(lot) : emptyLotForm());
    const requestId = lot?.id ?? formKey;

    setSavingLotId(requestId);
    setError(null);
    setWarning(null);
    setMessage(null);

    try {
      const payload = lotFormToPayload({ ...form, id: lot?.id }, position.id);
      const response = await fetch("/api/portfolio-risk", {
        body: JSON.stringify({
          action: lot ? "update-lot" : "create-lot",
          lot: payload,
        }),
        headers: { "Content-Type": "application/json" },
        method: lot ? "PATCH" : "POST",
      });
      const data = (await response.json()) as ApiPortfolioResponse;

      if (!response.ok || !data.ok || !data.profile) {
        throw new Error(data.message ?? "Lot failed to save.");
      }

      setProfileForm(profileToForm(data.profile));
      setPositions(data.positions ?? []);
      applyApiNotice(data);
      setLotForms((current) => {
        const next = { ...current };

        if (data.lot) {
          next[getLotFormKey(position.id, data.lot.id)] = lotToForm(data.lot);
        }

        if (!lot) {
          next[formKey] = emptyLotForm((position.lots ?? []).length + 1, {
            ...position,
            entryPrice: position.currentPrice ?? position.entryPrice,
          });
        }

        return next;
      });
      setExpandedPositionId(position.id);
      setMessage(lot ? "Лотът е обновен." : "Лотът е добавен.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSavingLotId(null);
    }
  }

  async function deleteLot(position: SavedPortfolioPosition, lot: SavedPortfolioLot) {
    setDeletingLotId(lot.id);
    setError(null);
    setWarning(null);
    setMessage(null);

    try {
      const params = new URLSearchParams({
        action: "delete-lot",
        positionId: position.id,
        lotId: lot.id,
      });
      const response = await fetch(`/api/portfolio-risk?${params.toString()}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as ApiPortfolioResponse;

      if (!response.ok || !data.ok || !data.profile) {
        throw new Error(data.message ?? "Lot failed to delete.");
      }

      setProfileForm(profileToForm(data.profile));
      setPositions(data.positions ?? []);
      applyApiNotice(data);
      setLotForms((current) => {
        const next = { ...current };
        delete next[getLotFormKey(position.id, lot.id)];
        return next;
      });
      setExpandedPositionId(position.id);
      setMessage("Лотът е изтрит.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    } finally {
      setDeletingLotId(null);
    }
  }

  function startEdit(position: SavedPortfolioPosition) {
    setEditingId(position.id);
    setPositionForm(positionToForm(position));
    setPreviewRequested(true);
    setPositionEditorOpen(true);
  }

  function toggleHelp(topic: HelpTopic) {
    setOpenHelp((current) => (current === topic ? null : topic));
  }

  const savedPortfolio = portfolio.ok ? portfolio : null;
  const accountCurrency = savedPortfolio?.summary.accountCurrency ?? profile.accountCurrency;
  const accountLoadPercent = savedPortfolio ? getAccountLoadPercent(savedPortfolio) : 0;
  const accountLoadMarkerPct = clampPercent(accountLoadPercent);
  const accountLoadLabelPct = Math.min(92, Math.max(8, accountLoadMarkerPct));
  const accountLoadTone = getAccountLoadTone(accountLoadPercent);
  const capacityTo50 = savedPortfolio ? getCapacityToLoad(savedPortfolio, 50) : 0;
  const capacityTo100 = savedPortfolio ? getCapacityToLoad(savedPortfolio, 100) : 0;
  const quickStressLoss20 = quickStress20.ok ? quickStress20.totalLossAccount : Number.NaN;

  function handleDrawerSaved(updatedPositions: SavedPortfolioPosition[]) {
    setPositions(updatedPositions);
    setMessage("Данните са записани.");
  }

  return (
    <div className="space-y-4">
      <section className="hidden rounded-lg border border-white/10 bg-[#0b1322]/80">
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
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500">Account load:</span>
                <span
                  className={cn(
                    "font-semibold",
                    accountLoadTone === "emerald" && "text-emerald-100",
                    accountLoadTone === "amber" && "text-amber-100",
                    accountLoadTone === "orange" && "text-orange-100",
                    accountLoadTone === "rose" && "text-rose-100",
                  )}
                >
                  {formatPercent(accountLoadPercent)}
                </span>
                <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-slate-400">
                  {getAccountLoadLabel(accountLoadPercent)}
                </span>
              </div>
              <div className="relative pt-6">
                <span
                  className="absolute top-0 -translate-x-1/2 rounded-md border border-white/10 bg-slate-950/80 px-2 py-0.5 text-[10px] font-medium text-slate-200"
                  style={{ left: `${accountLoadLabelPct}%` }}
                >
                  Ти си тук
                </span>
                <div className="relative h-2 overflow-hidden rounded-full bg-slate-950/55">
                  <div className="flex h-full">
                    <span className="h-full basis-[20%] bg-emerald-300/80" />
                    <span className="h-full basis-[30%] bg-amber-300/85" />
                    <span className="h-full flex-1 bg-orange-300/85" />
                  </div>
                  <span className="absolute right-0 top-0 h-full w-1 bg-rose-300/90" />
                  <span
                    className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.55)]"
                    style={{ left: `${accountLoadMarkerPct}%` }}
                  />
                </div>
                <div className="relative mt-1 h-4 text-[10px] text-slate-500">
                  <span className="absolute left-0">0%</span>
                  <span className="absolute left-[20%] -translate-x-1/2">20%</span>
                  <span className="absolute left-1/2 -translate-x-1/2">50%</span>
                  <span className="absolute right-0">100%</span>
                </div>
              </div>
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
                helpTopic="equity"
                label="Equity"
                onToggleHelp={toggleHelp}
                openHelp={openHelp}
                value={formatCurrency(savedPortfolio.summary.equity, accountCurrency)}
              />
              <SummaryCell
                helpTopic="freeMargin"
                label="Free margin"
                onToggleHelp={toggleHelp}
                openHelp={openHelp}
                tone={savedPortfolio.summary.temporary.freeMargin >= 0 ? "green" : "red"}
                value={formatCurrency(savedPortfolio.summary.temporary.freeMargin, accountCurrency)}
              />
              <SummaryCell
                helpTopic="exposure"
                label="Exposure"
                onToggleHelp={toggleHelp}
                openHelp={openHelp}
                value={formatCurrency(
                  savedPortfolio.summary.totalPositionValueAccount,
                  accountCurrency,
                )}
              />
              <SummaryCell
                helpTopic="riskMarginLevel"
                label="Risk margin level"
                helpAlign="right"
                onToggleHelp={toggleHelp}
                openHelp={openHelp}
                tone={savedPortfolio.summary.temporary.marginLevel >= 200 ? "green" : "amber"}
                value={formatPercent(savedPortfolio.summary.temporary.marginLevel)}
              />
              <SummaryCell
                helpTopic="unrealizedPnl"
                label="Unrealized P/L"
                helpAlign="right"
                onToggleHelp={toggleHelp}
                openHelp={openHelp}
                tone={savedPortfolio.summary.totalUnrealizedPnLAccount >= 0 ? "green" : "red"}
                value={formatCurrency(
                  savedPortfolio.summary.totalUnrealizedPnLAccount,
                  accountCurrency,
                )}
              />
              <SummaryCell
                helpTopic="stopOutBuffer"
                label="Загуба до stop-out"
                helpAlign="right"
                onToggleHelp={toggleHelp}
                openHelp={openHelp}
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

      {warning ? (
        <div className="rounded-lg border border-amber-200/20 bg-amber-300/[0.08] p-4 text-sm leading-6 text-amber-100">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <p>{warning}</p>
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

      {savedPortfolio ? (
        <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0b1322]/80 shadow-2xl shadow-black/20">
          <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.025] px-4 py-3">
            <span className="size-2.5 rounded-full bg-rose-400" />
            <span className="size-2.5 rounded-full bg-amber-300" />
            <span className="size-2.5 rounded-full bg-emerald-400" />
            <span className="ml-3 min-w-0 flex-1 rounded-md bg-white/[0.045] px-3 py-1.5 text-xs text-slate-500">
              /risk-calculator
            </span>
          </div>

          <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-white">Portfolio Risk</h2>
                <span className="text-sm text-slate-500">
                  {profileForm.brokerName || "Broker"} · {accountCurrency}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Управление на позиции, лотове, продажби и account load.
              </p>
            </div>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-blue-300/20 bg-blue-500 px-4 text-sm font-bold text-white transition hover:bg-blue-400"
              onClick={() => {
                setEditingId(null);
                setPositionForm(emptyPositionForm());
                setPreviewRequested(false);
                setPositionEditorOpen(true);
                setActiveWorkbenchTab("positions");
              }}
              type="button"
            >
              <Plus className="size-4" />
              Нова позиция
            </button>
          </div>

          <div className="grid gap-3 border-b border-white/10 p-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              compact
              helpTopic="equity"
              label="Equity"
              onToggleHelp={toggleHelp}
              openHelp={openHelp}
              value={formatCurrency(savedPortfolio.summary.equity, accountCurrency)}
            />
            <KpiCard
              compact
              helpTopic="freeMargin"
              label="Free margin"
              onToggleHelp={toggleHelp}
              openHelp={openHelp}
              tone={savedPortfolio.summary.temporary.freeMargin >= 0 ? "green" : "red"}
              value={formatCurrency(savedPortfolio.summary.temporary.freeMargin, accountCurrency)}
            />
            <KpiCard
              compact
              helpTopic="exposure"
              label="Exposure"
              onToggleHelp={toggleHelp}
              openHelp={openHelp}
              value={formatCurrency(
                savedPortfolio.summary.totalPositionValueAccount,
                accountCurrency,
              )}
            />
            <KpiCard
              compact
              helpAlign="right"
              helpTopic="riskMarginLevel"
              label="Risk margin level"
              onToggleHelp={toggleHelp}
              openHelp={openHelp}
              tone={savedPortfolio.summary.temporary.marginLevel >= 200 ? "green" : "amber"}
              value={formatPercent(savedPortfolio.summary.temporary.marginLevel)}
            />
            <KpiCard
              compact
              helpAlign="right"
              helpTopic="unrealizedPnl"
              label="Unrealized P/L"
              onToggleHelp={toggleHelp}
              openHelp={openHelp}
              tone={savedPortfolio.summary.totalUnrealizedPnLAccount >= 0 ? "green" : "red"}
              value={formatCurrency(
                savedPortfolio.summary.totalUnrealizedPnLAccount,
                accountCurrency,
              )}
            />
          </div>

          <div className="grid min-w-0 lg:grid-cols-[360px_minmax(0,1fr)]">
            <RiskGaugeSidebar
              accountCurrency={accountCurrency}
              accountLoadPercent={accountLoadPercent}
              capacityTo50={capacityTo50}
              capacityTo100={capacityTo100}
              onToggleHelp={toggleHelp}
              openHelp={openHelp}
              portfolio={savedPortfolio}
              stressLoss20={quickStressLoss20}
            />

            <div className="min-w-0">
              <div className="min-h-[26rem] p-4">
                {activeWorkbenchTab === "positions" ? (
                  <div className="space-y-4">
                    <PositionCards
                      accountCurrency={accountCurrency}
                      deletingLotId={deletingLotId}
                      deletingId={deletingId}
                      expandedPositionId={expandedPositionId}
                      lotForms={lotForms}
                      onAddLot={(position) => setAddLotTarget(position)}
                      onDeleteLot={(position, lot) => void deleteLot(position, lot)}
                      onDelete={(position) => void deletePosition(position)}
                      onEdit={startEdit}
                      onLotFormChange={updateLotForm}
                      onSaveLot={(position, formKey, lot) => void saveLot(position, formKey, lot)}
                      onSell={(position) => setSellTarget(position)}
                      onToggleHelp={toggleHelp}
                      onTogglePosition={togglePositionDetails}
                      openHelp={openHelp}
                      positions={savedPortfolio.positions}
                      savingLotId={savingLotId}
                      stopOutLossAccount={savedPortfolio.summary.temporary.maxLossBeforeStopOut}
                    />

                    {positionEditorOpen ? (
                      <div className="rounded-lg border border-white/10 bg-slate-950/20 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-bold text-white">
                              {editingId ? "Редакция на позиция" : "Нова позиция"}
                            </h3>
                            <p className="mt-1 text-xs text-slate-500">
                              Основни настройки за символ, цена, количество и leverage.
                            </p>
                          </div>
                          <button
                            aria-label="Затвори редактора"
                            className="inline-flex size-8 items-center justify-center rounded-md border border-white/10 text-slate-400 hover:bg-white/[0.06] hover:text-white"
                            onClick={() => {
                              setPositionEditorOpen(false);
                              setEditingId(null);
                              setPositionForm(emptyPositionForm());
                              setPreviewRequested(false);
                            }}
                            type="button"
                          >
                            <X className="size-4" />
                          </button>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                            className="sm:col-span-2 xl:col-span-3"
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
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-blue-300/20 bg-blue-500 px-3 text-sm font-bold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={saving}
                            onClick={() => void savePosition()}
                            type="button"
                          >
                            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                            {editingId ? "Update" : "Save"}
                          </button>
                        </div>

                        {previewPortfolio ? (
                          <div className="mt-4 grid gap-2 rounded-md border border-white/8 bg-white/[0.018] p-3 text-xs sm:grid-cols-4">
                            {previewPortfolio.ok ? (
                              <>
                                <SummaryCell
                                  label="Exposure"
                                  value={formatCurrency(
                                    previewPortfolio.summary.totalPositionValueAccount,
                                    previewPortfolio.summary.accountCurrency,
                                  )}
                                />
                                <SummaryCell
                                  label="Margin risk"
                                  value={formatCurrency(
                                    previewPortfolio.summary.temporary.usedMargin,
                                    previewPortfolio.summary.accountCurrency,
                                  )}
                                />
                                <SummaryCell
                                  label="Level normal"
                                  value={formatPercent(previewPortfolio.summary.normal.marginLevel)}
                                />
                                <SummaryCell
                                  label="Level risk"
                                  value={formatPercent(previewPortfolio.summary.temporary.marginLevel)}
                                />
                              </>
                            ) : (
                              <p className="sm:col-span-4 text-rose-100">
                                {previewPortfolio.errors.join(" ")}
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {activeWorkbenchTab === "allocation" ? (
                  <PortfolioAllocationChart
                    accountCurrency={accountCurrency}
                    positions={savedPortfolio.positions}
                  />
                ) : null}

                {activeWorkbenchTab === "stress" ? (
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
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-3">
                {[
                  ["positions", `Positions (${savedPortfolio.positions.length})`],
                  ["allocation", "Allocation"],
                  ["stress", "Stress test"],
                ].map(([tab, label]) => (
                  <button
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-semibold transition",
                      activeWorkbenchTab === tab
                        ? "border-blue-300/30 bg-blue-400/15 text-blue-100"
                        : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-100",
                    )}
                    key={tab}
                    onClick={() => {
                      setActiveWorkbenchTab(tab as PortfolioWorkbenchTab);
                      setSettingsOpen(false);
                    }}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
                <button
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-semibold transition",
                    settingsOpen
                      ? "border-amber-200/25 bg-amber-300/10 text-amber-100"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-100",
                  )}
                  onClick={() => setSettingsOpen((current) => !current)}
                  type="button"
                >
                  Account settings
                </button>
                <button
                  className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-slate-400 hover:text-slate-100"
                  onClick={() => {
                    setSettingsOpen(true);
                  }}
                  type="button"
                >
                  Add funds симулация
                </button>
              </div>

              {settingsOpen ? (
                <div className="border-t border-white/10 p-4">
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
                      label="Add funds"
                      onChange={(value) => updateProfileField("addedFundsSimulation", value)}
                      type="number"
                      value={profileForm.addedFundsSimulation}
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
                  <div className="mt-4 flex justify-end border-t border-white/8 pt-3">
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
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <div className="hidden">
        <div className="min-w-0 space-y-4">
          <PortfolioAllocationChart
            accountCurrency={accountCurrency}
            positions={savedPortfolio?.positions ?? []}
          />

          <PositionsTable
            accountCurrency={accountCurrency}
            deletingLotId={deletingLotId}
            deletingId={deletingId}
            expandedPositionId={expandedPositionId}
            lotForms={lotForms}
            onAddLot={(position) => setAddLotTarget(position)}
            onDeleteLot={(position, lot) => void deleteLot(position, lot)}
            onDelete={(position) => void deletePosition(position)}
            onEdit={startEdit}
            onLotFormChange={updateLotForm}
            onSaveLot={(position, formKey, lot) => void saveLot(position, formKey, lot)}
            onSell={(position) => setSellTarget(position)}
            onToggleHelp={toggleHelp}
            onTogglePosition={togglePositionDetails}
            openHelp={openHelp}
            positions={savedPortfolio?.positions ?? []}
            savingLotId={savingLotId}
            stopOutLossAccount={savedPortfolio?.summary.temporary.maxLossBeforeStopOut ?? Number.NaN}
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

        <aside className="min-w-0 self-start rounded-lg border border-white/10 bg-[#0b1322]/90 p-4 xl:sticky xl:top-6">
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

      {addLotTarget ? (
        <AddLotDrawer
          accountCurrency={accountCurrency}
          fxRate={profile.fxRateInstrumentToAccount}
          onClose={() => setAddLotTarget(null)}
          onSaved={handleDrawerSaved}
          position={addLotTarget}
          positions={positions}
          profile={profile}
        />
      ) : null}

      {sellTarget ? (
        <SellPositionDrawer
          accountCurrency={accountCurrency}
          fxRate={profile.fxRateInstrumentToAccount}
          onClose={() => setSellTarget(null)}
          onSaved={handleDrawerSaved}
          position={sellTarget}
        />
      ) : null}
    </div>
  );
}
