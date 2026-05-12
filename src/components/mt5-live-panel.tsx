"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FileDown,
  FolderOpen,
  KeyRound,
  Loader2,
  MousePointerClick,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";

import { buildMt5EaDataUri, MT5_EA_FILE_NAME } from "@/lib/mt5-ea";
import type {
  Mt5Connector,
  Mt5ConnectorsResponse,
  Mt5CreatedConnectorResponse,
  Mt5LatestResponse,
} from "@/lib/mt5";
import { maskMt5AccountLogin } from "@/lib/mt5-portfolio-risk";
import { cn } from "@/lib/utils";

type LoadState =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: Mt5LatestResponse; error: null }
  | { status: "error"; data: null; error: string };

type Mt5ConnectorListResponse = Mt5ConnectorsResponse & {
  endpointUrl: string;
  webRequestUrl: string;
  downloadUrl: string;
};

type Mt5ConnectorSetup = {
  connector?: Mt5Connector;
  downloadUrl: string;
  endpointUrl: string;
  token?: string;
  webRequestUrl: string;
};

function formatDateTime(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value || "-";
  }

  return new Intl.DateTimeFormat("bg-BG", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function statusLabel(status: Mt5LatestResponse["status"]) {
  if (status === "live") {
    return "MT5 live";
  }

  if (status === "stale") {
    return "MT5 stale";
  }

  return "MT5 offline";
}

function statusTone(status: Mt5LatestResponse["status"]) {
  if (status === "live") {
    return "border-emerald-300/30 bg-emerald-300/12 text-emerald-100";
  }

  if (status === "stale") {
    return "border-amber-300/30 bg-amber-300/12 text-amber-100";
  }

  return "border-rose-300/30 bg-rose-300/12 text-rose-100";
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-white/12 bg-white/[0.025] p-6">
      <div className="flex items-start gap-3">
        <WifiOff className="mt-0.5 size-5 text-slate-400" />
        <div>
          <h3 className="text-sm font-semibold text-white">Няма получен MT5 snapshot.</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Когато MT5 терминалът работи и Expert Advisor-ът изпрати данни, статусът ще стане
            live. Реалните позиции и анализът се гледат в Portfolio Risk → Live MT5.
          </p>
        </div>
      </div>
    </div>
  );
}

function SetupValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.035] p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 break-all font-mono text-xs leading-5 text-slate-100">{value}</p>
    </div>
  );
}

function SetupMiniVisual({ type }: { type: "webrequest" | "file" | "refresh" | "live" }) {
  if (type === "webrequest") {
    return (
      <div className="h-28 rounded-lg border border-white/10 bg-slate-950/70 p-3 text-[10px] text-slate-300">
        <div className="mb-2 flex gap-1">
          <span className="size-2 rounded-full bg-rose-300/80" />
          <span className="size-2 rounded-full bg-amber-300/80" />
          <span className="size-2 rounded-full bg-emerald-300/80" />
        </div>
        <div className="rounded border border-white/10 bg-white/[0.04] p-2">
          <div className="mb-2 h-2 w-24 rounded bg-slate-500/60" />
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-3 text-emerald-200" />
            <span>Allow WebRequest</span>
          </div>
          <div className="mt-2 rounded bg-emerald-300/10 px-2 py-1 font-mono text-emerald-100">
            forex-site-chi.vercel.app
          </div>
        </div>
      </div>
    );
  }

  if (type === "file") {
    return (
      <div className="h-28 rounded-lg border border-white/10 bg-slate-950/70 p-3">
        <div className="flex h-full items-center justify-center">
          <div className="rounded-lg border border-amber-200/25 bg-amber-200/10 p-3 text-center">
            <FileDown className="mx-auto size-6 text-amber-100" />
            <p className="mt-2 font-mono text-[10px] text-amber-50">ForexSiteConnectorEA.mq5</p>
          </div>
        </div>
      </div>
    );
  }

  if (type === "refresh") {
    return (
      <div className="h-28 rounded-lg border border-white/10 bg-slate-950/70 p-3 text-[10px] text-slate-300">
        <div className="flex gap-3">
          <div className="w-28 rounded border border-white/10 bg-white/[0.04] p-2">
            <div className="flex items-center gap-1 text-slate-400">
              <FolderOpen className="size-3" />
              Experts
            </div>
            <div className="mt-2 rounded bg-emerald-300/10 px-2 py-1 text-emerald-100">
              ForexSiteConnectorEA
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <MousePointerClick className="size-7 text-emerald-100" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-28 rounded-lg border border-white/10 bg-slate-950/70 p-3">
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-100">
          <Wifi className="size-4" />
          MT5 live
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="h-8 rounded bg-white/[0.06]" />
          <div className="h-8 rounded bg-white/[0.06]" />
          <div className="h-8 rounded bg-white/[0.06]" />
        </div>
        <div className="rounded bg-emerald-300/10 px-2 py-1 text-[10px] text-emerald-100">
          HTTP 200 sync
        </div>
      </div>
    </div>
  );
}

function WizardStep({
  number,
  text,
  title,
  visual,
}: {
  number: number;
  text: string;
  title: string;
  visual: "webrequest" | "file" | "refresh" | "live";
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
      <SetupMiniVisual type={visual} />
      <div className="mt-3 flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-300/12 text-xs font-semibold text-emerald-100">
          {number}
        </span>
        <div>
          <h4 className="text-sm font-semibold text-white">{title}</h4>
          <p className="mt-1 text-xs leading-5 text-slate-400">{text}</p>
        </div>
      </div>
    </div>
  );
}

function Mt5SetupWizard({
  connectors,
  creating,
  error,
  loading,
  onCreate,
  setup,
}: {
  connectors: Mt5Connector[];
  creating: boolean;
  error: string | null;
  loading: boolean;
  onCreate: () => void;
  setup: Mt5ConnectorSetup | null;
}) {
  const latestConnector = connectors[0] ?? null;
  const readyEaDownloadHref = setup?.token
    ? buildMt5EaDataUri({
        endpointUrl: setup.endpointUrl,
        secretToken: setup.token,
      })
    : null;

  if (loading && !setup) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#0b1322]/82 p-4 text-sm text-slate-300">
        <Loader2 className="mr-2 inline size-4 animate-spin" />
        Зареждам MT5 връзките...
      </div>
    );
  }

  if (setup?.token) {
    return (
      <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
              <ShieldCheck className="size-4" />
              Готов EA файл за MT5
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Свали персоналния EA файл. Той вече съдържа правилния EndpointUrl и SecretToken,
              така че в MT5 не трябва да въвеждаш localhost или token ръчно.
            </p>
          </div>
          <a
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200/20 bg-emerald-200/10 px-3 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-200/15"
            download={MT5_EA_FILE_NAME}
            href={readyEaDownloadHref ?? setup.downloadUrl}
          >
            <Download className="size-4" />
            Download Ready MT5 Connector
          </a>
        </div>

        <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-white">
          <Settings2 className="size-4 text-emerald-100" />
          4 лесни стъпки
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <WizardStep
            number={1}
            text="В MT5 Options добави само сайта като разрешен URL."
            title="Разреши WebRequest"
            visual="webrequest"
          />
          <WizardStep
            number={2}
            text="Файлът вече е с твоя token и правилния live endpoint."
            title="Свали готовия файл"
            visual="file"
          />
          <WizardStep
            number={3}
            text="Постави го в MQL5/Experts, Refresh и double-click върху него."
            title="Refresh и double-click"
            visual="refresh"
          />
          <WizardStep
            number={4}
            text="При HTTP 200 сайтът показва акаунта, позициите и историята live."
            title="Гледай MT5 live"
            visual="live"
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <SetupValue label="EndpointUrl" value={setup.endpointUrl} />
          <SetupValue label="SecretToken" value={setup.token} />
          <SetupValue label="Allow WebRequest URL" value={setup.webRequestUrl} />
        </div>
        <p className="mt-3 text-xs leading-5 text-emerald-100/80">
          Запази SecretToken сега. От съображения за сигурност сайтът няма да го показва повторно.
        </p>
      </div>
    );
  }

  if (latestConnector && setup) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#0b1322]/82 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <KeyRound className="size-4 text-emerald-100" />
              MT5 връзка е създадена
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Ако EA-ът вече е добавен към MT5, live данните ще се появят автоматично. За нов
              терминал създай нов готов EA файл, защото SecretToken не се показва повторно.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={creating}
            onClick={onCreate}
            type="button"
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            Създай нов готов EA файл
          </button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <SetupValue label="EndpointUrl" value={setup.endpointUrl} />
          <SetupValue label="Saved token" value={latestConnector.tokenPreview} />
          <SetupValue label="Allow WebRequest URL" value={setup.webRequestUrl} />
        </div>
        {latestConnector.lastSeenAt ? (
          <p className="mt-3 text-xs text-slate-500">
            Последна активност: {formatDateTime(latestConnector.lastSeenAt)}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-rose-100">
            <AlertTriangle className="mr-1 inline size-4" />
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[#0b1322]/82 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <KeyRound className="size-4 text-amber-100" />
            Свържи MT5 акаунт
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Сайтът ще генерира персонален token и готови настройки за MT5 Expert Advisor-а.
            Няма website-side trade execution, само read/sync данни.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-sm font-semibold text-amber-50 transition hover:bg-amber-200/15 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={creating}
          onClick={onCreate}
          type="button"
        >
          {creating ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Свържи MT5 акаунт
        </button>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-rose-100">
          <AlertTriangle className="mr-1 inline size-4" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Mt5LivePanel({ onOpenLiveAnalysis }: { onOpenLiveAnalysis?: () => void }) {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    data: null,
    error: null,
  });
  const [connectors, setConnectors] = useState<Mt5Connector[]>([]);
  const [connectorSetup, setConnectorSetup] = useState<Mt5ConnectorSetup | null>(null);
  const [connectorsLoading, setConnectorsLoading] = useState(true);
  const [connectorError, setConnectorError] = useState<string | null>(null);
  const [creatingConnector, setCreatingConnector] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function loadConnectors() {
    setConnectorsLoading(true);

    try {
      const response = await fetch("/api/mt5/connectors", { cache: "no-store" });
      const data = (await response.json()) as
        | Mt5ConnectorListResponse
        | { ok: false; message?: string };

      if (!response.ok || !data.ok) {
        throw new Error("message" in data ? data.message : "MT5 connectors failed.");
      }

      setConnectors(data.connectors);
      setConnectorSetup((current) =>
        current?.token
          ? current
          : {
              downloadUrl: data.downloadUrl,
              endpointUrl: data.endpointUrl,
              webRequestUrl: data.webRequestUrl,
            },
      );
      setConnectorError(null);
    } catch (error) {
      setConnectorError(error instanceof Error ? error.message : String(error));
    } finally {
      setConnectorsLoading(false);
    }
  }

  async function createConnector() {
    setCreatingConnector(true);
    setConnectorError(null);

    try {
      const response = await fetch("/api/mt5/connectors", {
        body: JSON.stringify({ name: "MT5 акаунт" }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as
        | Mt5CreatedConnectorResponse
        | { ok: false; message?: string };

      if (!response.ok || !data.ok) {
        throw new Error("message" in data ? data.message : "MT5 connector create failed.");
      }

      setConnectors((current) => [
        data.connector,
        ...current.filter((connector) => connector.id !== data.connector.id),
      ]);
      setConnectorSetup({
        connector: data.connector,
        downloadUrl: data.downloadUrl,
        endpointUrl: data.endpointUrl,
        token: data.token,
        webRequestUrl: data.webRequestUrl,
      });
    } catch (error) {
      setConnectorError(error instanceof Error ? error.message : String(error));
    } finally {
      setCreatingConnector(false);
    }
  }

  async function loadLatest(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setRefreshing(true);
    }

    try {
      const response = await fetch("/api/mt5/latest", { cache: "no-store" });
      const data = (await response.json()) as Mt5LatestResponse | { ok: false; message?: string };

      if (!response.ok || !data.ok) {
        throw new Error("message" in data ? data.message : "MT5 latest failed.");
      }

      setState({
        status: "loaded",
        data,
        error: null,
      });
    } catch (error) {
      setState({
        status: "error",
        data: null,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (!options?.silent) {
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadLatest();
      void loadConnectors();
    }, 0);
    const interval = window.setInterval(() => {
      void loadLatest({ silent: true });
    }, 10000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, []);

  const latest = state.status === "loaded" ? state.data : null;
  const snapshot = latest?.snapshot?.payload ?? null;
  const currentStatus = latest?.status ?? "offline";

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-[#0b1322]/82 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                  statusTone(currentStatus),
                )}
              >
                {currentStatus === "live" ? <Wifi className="size-3.5" /> : null}
                {currentStatus === "stale" ? <Clock3 className="size-3.5" /> : null}
                {currentStatus === "offline" ? <WifiOff className="size-3.5" /> : null}
                {statusLabel(currentStatus)}
              </span>
              {latest?.snapshot ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                  <Server className="size-3.5" />
                  {latest.snapshot.server}
                </span>
              ) : null}
            </div>
            <h2 className="mt-4 text-xl font-semibold text-white">MT5 Live</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Тук са само връзката, статусът и настройките за MT5. Балансът, позициите и анализът
              са преместени в Portfolio Risk → Live MT5.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {latest?.snapshot ? (
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/12 px-3 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400/18 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!onOpenLiveAnalysis}
                onClick={onOpenLiveAnalysis}
                type="button"
              >
                <Activity className="size-4" />
                Виж Live анализа
              </button>
            ) : null}
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={refreshing}
              onClick={() => void loadLatest()}
              type="button"
            >
              {refreshing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh
            </button>
          </div>
        </div>

        {latest?.snapshot ? (
          <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="text-slate-500">Login</span>
              <p className="mt-1 font-semibold text-slate-200">
                {maskMt5AccountLogin(latest.snapshot.accountLogin)}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Broker</span>
              <p className="mt-1 font-semibold text-slate-200">
                {snapshot?.account.broker || snapshot?.account.company || "-"}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Last sync</span>
              <p className="mt-1 font-semibold text-slate-200">
                {formatDateTime(latest.snapshot.receivedAt)}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Terminal</span>
              <p className="mt-1 font-semibold text-slate-200">
                {snapshot?.terminal.name} build {snapshot?.terminal.build}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {state.status === "loading" ? (
        <div className="rounded-lg border border-white/10 bg-[#0b1322]/82 p-6 text-sm text-slate-300">
          <Loader2 className="mr-2 inline size-4 animate-spin" />
          Зареждам MT5 live данни...
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="rounded-lg border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
          <AlertTriangle className="mr-2 inline size-4" />
          {state.error}
        </div>
      ) : null}

      <Mt5SetupWizard
        connectors={connectors}
        creating={creatingConnector}
        error={connectorError}
        loading={connectorsLoading}
        onCreate={() => void createConnector()}
        setup={connectorSetup}
      />

      {latest && !snapshot ? <EmptyState /> : null}
    </section>
  );
}
