"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BellRing,
  CalendarClock,
  Check,
  Clock3,
  Filter,
  Link2,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MetricCard } from "@/components/metric-card";
import { SectionCard } from "@/components/section-card";
import {
  buildAlertForEvent,
  calendarAlertStorageKey,
  evaluateCalendarAlerts,
  normalizeCalendarAlerts,
  type CalendarAlertSettings,
} from "@/lib/calendar-alerts";
import {
  calendarCurrencyOptions,
  calendarEventTypeLabels,
  calendarEventTypeOptions,
  calendarFilterStorageKey,
  calendarImpactLabels,
  calendarImpactOptions,
  filterCalendarEvents,
  getDefaultCalendarFilterState,
  getOpenCalendarFilterState,
  normalizeCalendarFilterState,
  type CalendarFilterState,
} from "@/lib/calendar-filters";
import { getPendingReleasedCalendarEvents } from "@/lib/calendar-history";
import {
  getCalendarEventDetail,
  getCalendarValuePanels,
  isStrongGoldCalendarEvent,
} from "@/lib/calendar-presentation";
import { formatSofiaDateKey, formatSofiaDay, formatSofiaTime } from "@/lib/format";
import type {
  CalendarEventType,
  CalendarImpact,
  CalendarRelevance,
  EconomicCalendarEvent,
  SignalDirection,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const relevanceLabels: Record<CalendarRelevance, string> = {
  direct: "Директно за злато",
  strong: "Силен макро ефект",
  context: "Контекст",
};

const directionLabels: Record<SignalDirection, string> = {
  bullish: "Подкрепя златото",
  bearish: "Натиск за златото",
  neutral: "Неутрално",
  mixed: "Зависи от резултата",
};

function impactClass(impact: CalendarImpact) {
  return {
    low: "border-slate-400/20 bg-slate-300/[0.08] text-slate-200",
    medium: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    high: "border-rose-300/30 bg-rose-300/[0.12] text-rose-100",
  }[impact];
}

function directionClass(direction: SignalDirection) {
  return {
    bullish: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    bearish: "border-rose-300/25 bg-rose-300/10 text-rose-100",
    neutral: "border-slate-300/20 bg-slate-300/[0.08] text-slate-200",
    mixed: "border-sky-300/25 bg-sky-300/10 text-sky-100",
  }[direction];
}

function DirectionIcon({ direction }: { direction: SignalDirection }) {
  if (direction === "bullish") {
    return <ArrowUpRight className="size-4" />;
  }

  if (direction === "bearish") {
    return <ArrowDownRight className="size-4" />;
  }

  return <ArrowRight className="size-4" />;
}

function StrongXauBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-300/14 px-2.5 py-1 text-xs font-semibold text-amber-100">
      <Zap className="size-3.5" />
      Силен XAU драйвер
    </span>
  );
}

function groupByDay(events: EconomicCalendarEvent[]) {
  return events.reduce<Record<string, EconomicCalendarEvent[]>>((groups, event) => {
    const key = formatSofiaDateKey(event.startsAt) || event.startsAt.slice(0, 10);
    groups[key] ??= [];
    groups[key].push(event);
    return groups;
  }, {});
}

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);

  if (!Number.isFinite(date.getTime())) {
    return dateKey;
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function todaySofiaDateKey() {
  return formatSofiaDateKey(new Date().toISOString()) || new Date().toISOString().slice(0, 10);
}

function TogglePill({
  checked,
  label,
  onClick,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-medium transition",
        checked
          ? "border-amber-300/38 bg-amber-300/14 text-amber-100"
          : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]",
      )}
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded border",
          checked ? "border-amber-200 bg-amber-200 text-slate-950" : "border-slate-500",
        )}
      >
        {checked ? <Check className="size-3" /> : null}
      </span>
      {label}
    </button>
  );
}

function CompactValueCells({ event }: { event: EconomicCalendarEvent }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {getCalendarValuePanels(event).map((panel) => (
        <div
          key={panel.key}
          className="min-w-0 rounded-xl border border-white/8 bg-white/[0.035] px-2.5 py-2"
        >
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            {panel.label}
          </p>
          <p className="mt-1 truncate text-sm font-semibold leading-5 text-white" title={panel.value}>
            {panel.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function FullValuePanels({ event }: { event: EconomicCalendarEvent }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {getCalendarValuePanels(event).map((panel) => (
        <div key={panel.key} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {panel.label}
          </p>
          <p className="mt-2 break-words text-lg font-semibold text-white">{panel.value}</p>
          {panel.hint ? <p className="mt-2 text-xs leading-5 text-slate-400">{panel.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

function CalendarEventDetailModal({
  event,
  onClose,
}: {
  event: EconomicCalendarEvent;
  onClose: () => void;
}) {
  const detail = getCalendarEventDetail(event);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/74 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`calendar-detail-${event.id}`}
        data-testid="calendar-event-detail"
        className="max-h-[min(88vh,860px)] w-full max-w-5xl overflow-y-auto rounded-[28px] border border-white/12 bg-[#10192d] p-5 shadow-[0_40px_120px_rgba(0,0,0,0.52)] md:p-6"
        onMouseDown={(item) => item.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
              <span>{formatSofiaDay(event.startsAt)}</span>
              <span>•</span>
              <span>{formatSofiaTime(event.startsAt)}</span>
              <span>•</span>
              <span>
                {event.country} / {event.currency}
              </span>
            </div>
            <h3 id={`calendar-detail-${event.id}`} className="mt-3 text-2xl font-semibold leading-tight text-white">
              {event.title}
            </h3>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full border px-2.5 py-1 text-xs", impactClass(event.impact))}>
                {calendarImpactLabels[event.impact]} impact
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-200">
                {calendarEventTypeLabels[event.eventType]}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-200">
                {relevanceLabels[event.relevance]}
              </span>
              {isStrongGoldCalendarEvent(event) ? <StrongXauBadge /> : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
            aria-label="Затвори"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5">
          <FullValuePanels event={event} />
        </div>

        <div className="mt-5 rounded-[22px] border border-amber-300/16 bg-amber-300/[0.055] p-4">
          <p className="text-sm font-semibold text-amber-100">Резултат спрямо очакването</p>
          <p className="mt-2 text-sm leading-7 text-slate-200">{detail.releaseAnalysis}</p>
          {event.actualUpdatedAt ? (
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Обновено: {event.actualUpdatedAt ? formatSofiaTime(event.actualUpdatedAt) : "-"}
            </p>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-[20px] border border-emerald-300/14 bg-emerald-300/[0.045] p-4">
            <p className="text-sm font-semibold text-emerald-100">Bullish сценарий</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">{event.scenarioBullish}</p>
          </div>
          <div className="rounded-[20px] border border-rose-300/14 bg-rose-300/[0.045] p-4">
            <p className="text-sm font-semibold text-rose-100">Bearish сценарий</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">{event.scenarioBearish}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
              <p className="text-sm font-semibold text-white">Какво означава тази новина</p>
              <p className="mt-2 text-sm leading-7 text-slate-300">{detail.meaning}</p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
              <p className="text-sm font-semibold text-white">Как влияе на златото</p>
              <p className="mt-2 text-sm leading-7 text-slate-300">{detail.goldImpact}</p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
              <p className="text-sm font-semibold text-white">Пример</p>
              <p className="mt-2 text-sm leading-7 text-slate-300">{detail.example}</p>
            </div>
          </div>

          <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
            <p className="text-sm font-semibold text-white">На какво влияе</p>
            <div className="mt-3 space-y-3">
              {detail.driverDetails.map((driver) => (
                <div key={driver.key} className="rounded-2xl border border-white/8 bg-[#0c1426]/70 p-3">
                  <p className="text-sm font-semibold text-amber-100">{driver.label}</p>
                  <p className="mt-1 text-xs leading-6 text-slate-400">{driver.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium",
              directionClass(event.expectedGoldImpact),
            )}
          >
            <DirectionIcon direction={event.expectedGoldImpact} />
            {directionLabels[event.expectedGoldImpact]}
          </div>
          {event.sourceUrl ? (
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/12 px-4 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/18"
            >
              <Link2 className="size-4" />
              Източник
            </a>
          ) : (
            <p className="text-sm text-slate-400">{event.source}</p>
          )}
        </div>
      </section>
    </div>
  );
}

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function readJsonStorage(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function CalendarBoard({ events }: { events: EconomicCalendarEvent[] }) {
  const router = useRouter();
  const [filters, setFilters] = useState<CalendarFilterState>(() => getDefaultCalendarFilterState());
  const [alerts, setAlerts] = useState<CalendarAlertSettings[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EconomicCalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => todaySofiaDateKey());
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setFilters(normalizeCalendarFilterState(readJsonStorage(calendarFilterStorageKey)));
      setAlerts(normalizeCalendarAlerts(readJsonStorage(calendarAlertStorageKey)));
      setHasLoadedStorage(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!hasLoadedStorage) {
      return;
    }

    window.localStorage.setItem(calendarFilterStorageKey, JSON.stringify(filters));
  }, [filters, hasLoadedStorage]);

  useEffect(() => {
    if (!hasLoadedStorage) {
      return;
    }

    window.localStorage.setItem(calendarAlertStorageKey, JSON.stringify(alerts));
  }, [alerts, hasLoadedStorage]);

  const sendBrowserNotification = useCallback((title: string, body: string) => {
    if (!("Notification" in window)) {
      setNotificationMessage("Този браузър не поддържа desktop известия. Алармата остава видима в сайта.");
      return;
    }

    if (Notification.permission !== "granted") {
      setNotificationMessage("Известията не са разрешени. Алармата остава запазена в сайта.");
      return;
    }

    new Notification(title, {
      body,
      tag: title,
    });
  }, []);

  useEffect(() => {
    const checkAlerts = () => {
      setAlerts((currentAlerts) => {
        const result = evaluateCalendarAlerts(events, currentAlerts);

        if (result.notifications.length) {
          for (const notification of result.notifications) {
            sendBrowserNotification(notification.title, notification.body);
          }
        }

        return result.nextAlerts;
      });
    };

    checkAlerts();
    const intervalId = window.setInterval(checkAlerts, 30_000);

    return () => window.clearInterval(intervalId);
  }, [events, sendBrowserNotification]);

  useEffect(() => {
    if (!selectedEvent) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedEvent(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedEvent]);

  useEffect(() => {
    let timeoutId: number | null = null;
    let cancelled = false;

    const scheduleNextCheck = (delayMs: number) => {
      timeoutId = window.setTimeout(checkForReleasedActuals, delayMs);
    };

    const checkForReleasedActuals = async () => {
      if (cancelled) {
        return;
      }

      const pendingReleasedEvents = getPendingReleasedCalendarEvents(events);

      if (!pendingReleasedEvents.length) {
        scheduleNextCheck(60_000);
        return;
      }

      const newestReleaseAgeMs = Math.min(
        ...pendingReleasedEvents.map((event) => Date.now() - new Date(event.startsAt).getTime()),
      );
      const nextDelayMs = newestReleaseAgeMs <= 30 * 60 * 1000 ? 60_000 : 5 * 60_000;

      try {
        const response = await fetch("/api/refresh", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ mode: "calendar-release" }),
        });

        if (response.ok) {
          router.refresh();
        }
      } finally {
        if (!cancelled) {
          scheduleNextCheck(nextDelayMs);
        }
      }
    };

    scheduleNextCheck(1500);

    return () => {
      cancelled = true;

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [events, router]);

  const requestNotificationAccess = useCallback(async () => {
    if (!("Notification" in window)) {
      setNotificationMessage("Този браузър не поддържа desktop известия. Алармата остава видима в сайта.");
      return;
    }

    if (Notification.permission === "granted") {
      setNotificationMessage("Известията са активни.");
      return;
    }

    if (Notification.permission === "denied") {
      setNotificationMessage("Известията са отказани от браузъра. Алармата остава видима в сайта.");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationMessage(
      permission === "granted"
        ? "Известията са активни."
        : "Известията не са разрешени. Алармата остава запазена в сайта.",
    );
  }, []);

  const visibleEvents = useMemo(() => filterCalendarEvents(events, filters), [events, filters]);
  const selectedDateEvents = useMemo(
    () =>
      visibleEvents.filter((event) => (formatSofiaDateKey(event.startsAt) || event.startsAt.slice(0, 10)) === selectedDate),
    [selectedDate, visibleEvents],
  );
  const groupedEvents = useMemo(() => groupByDay(selectedDateEvents), [selectedDateEvents]);
  const nextEvent = visibleEvents.find((event) => new Date(event.startsAt) >= new Date()) ?? visibleEvents[0];
  const highImpactCount = selectedDateEvents.filter((event) => event.impact === "high").length;
  const directCount = selectedDateEvents.filter((event) => event.relevance === "direct").length;
  const pendingReleasedCount = getPendingReleasedCalendarEvents(events).length;
  const alertsById = useMemo(() => new Map(alerts.map((alert) => [alert.eventId, alert])), [alerts]);

  const toggleImpactFilter = (impact: CalendarImpact) => {
    setFilters((current) => ({
      ...current,
      impacts: toggleValue(current.impacts, impact),
    }));
  };

  const toggleEventTypeFilter = (eventType: CalendarEventType) => {
    setFilters((current) => ({
      ...current,
      eventTypes: toggleValue(current.eventTypes, eventType),
    }));
  };

  const toggleCurrencyFilter = (currency: string) => {
    setFilters((current) => ({
      ...current,
      currencies: toggleValue(current.currencies, currency),
    }));
  };

  const upsertAlert = async (
    event: EconomicCalendarEvent,
    options: Pick<CalendarAlertSettings, "notifyBeforeMinutes" | "notifyOnPublish">,
  ) => {
    await requestNotificationAccess();

    setAlerts((currentAlerts) => {
      const nextAlerts = currentAlerts.filter((alert) => alert.eventId !== event.id);

      if (!options.notifyBeforeMinutes && !options.notifyOnPublish) {
        return nextAlerts;
      }

      return [
        ...nextAlerts,
        {
          ...buildAlertForEvent(event, options),
          beforeSentAt: currentAlerts.find((alert) => alert.eventId === event.id)?.beforeSentAt,
          publishSentActual: currentAlerts.find((alert) => alert.eventId === event.id)?.publishSentActual,
        },
      ];
    });
  };

  const removeAlert = (eventId: string) => {
    setAlerts((currentAlerts) => currentAlerts.filter((alert) => alert.eventId !== eventId));
    setActiveAlertId(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard
          label="Висок impact"
          value={String(highImpactCount)}
          hint="Събития с най-голям шанс да променят intraday режима"
          accent="red"
        />
        <MetricCard
          label="Директно за злато"
          value={String(directCount)}
          hint="Fed, инфлация, NFP и COT са най-важни за XAU"
          accent="gold"
        />
        <MetricCard
          label="Следващо събитие"
          value={nextEvent ? formatSofiaTime(nextEvent.startsAt) : "Няма"}
          hint={nextEvent ? nextEvent.title : "Няма заредени календарни данни"}
          accent="green"
        />
      </div>

      <SectionCard title="Филтър на календара" eyebrow="Персонален изглед">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsFilterOpen((value) => !value)}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/12 px-4 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/18"
          >
            <SlidersHorizontal className="size-4" />
            {isFilterOpen ? "Скрий филтрите" : "Покажи филтрите"}
          </button>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300">
            <Filter className="size-4 text-amber-100" />
            {visibleEvents.length} от {events.length} събития
          </div>
        </div>

        {isFilterOpen ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1.45fr_1fr]">
            <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">Expected impact</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {calendarImpactOptions.map((impact) => (
                  <TogglePill
                    key={impact}
                    checked={filters.impacts.includes(impact)}
                    label={calendarImpactLabels[impact]}
                    onClick={() => toggleImpactFilter(impact)}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    goldOnly: !current.goldOnly,
                  }))
                }
                className={cn(
                  "mt-4 flex w-full items-start gap-3 rounded-[18px] border p-3 text-left transition",
                  filters.goldOnly
                    ? "border-amber-300/40 bg-amber-300/14 text-amber-50"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border",
                    filters.goldOnly ? "border-amber-200 bg-amber-200 text-slate-950" : "border-slate-500",
                  )}
                >
                  {filters.goldOnly ? <Check className="size-3.5" /> : null}
                </span>
                <span>
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="size-4 text-amber-100" />
                    Gold / Само за злато
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">
                    Показва събитията, които най-често движат XAU през USD, Fed, инфлация и доходности.
                  </span>
                </span>
              </button>
            </div>

            <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">Тип събитие</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {calendarEventTypeOptions.map((eventType) => (
                  <TogglePill
                    key={eventType}
                    checked={filters.eventTypes.includes(eventType)}
                    label={calendarEventTypeLabels[eventType]}
                    onClick={() => toggleEventTypeFilter(eventType)}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">Валути / държави</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {calendarCurrencyOptions.map((currency) => (
                  <TogglePill
                    key={currency}
                    checked={filters.currencies.includes(currency)}
                    label={currency}
                    onClick={() => toggleCurrencyFilter(currency)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setFilters(getOpenCalendarFilterState())}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 text-sm font-medium text-white transition hover:bg-white/[0.09]"
          >
            <RotateCcw className="size-4" />
            Премахни филтър
          </button>
          <button
            type="button"
            onClick={() => setFilters(getDefaultCalendarFilterState())}
            className="inline-flex h-11 items-center rounded-full border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-slate-300 transition hover:bg-white/[0.07]"
          >
            Върни стандартния изглед
          </button>
        </div>
      </SectionCard>

      {notificationMessage ? (
        <div className="rounded-[22px] border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
          {notificationMessage}
        </div>
      ) : null}

      <SectionCard title="Календарен поток" eyebrow="История и предстоящи събития">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/8 bg-white/[0.03] p-3">
          <div>
            <p className="text-sm font-semibold text-white">{formatSofiaDay(`${selectedDate}T12:00:00.000Z`)}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {selectedDateEvents.length} събития по текущите филтри
              {pendingReleasedCount ? ` • ${pendingReleasedCount} чакат публикуван actual` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate((current) => shiftDateKey(current, -1))}
              className="inline-flex h-10 items-center rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08]"
            >
              Предишен ден
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(todaySofiaDateKey())}
              className="inline-flex h-10 items-center rounded-full border border-amber-300/25 bg-amber-300/12 px-3 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/18"
            >
              Днес
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate((current) => shiftDateKey(current, 1))}
              className="inline-flex h-10 items-center rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08]"
            >
              Следващ ден
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value || todaySofiaDateKey())}
              className="h-10 rounded-full border border-white/10 bg-[#0c1426] px-3 text-xs font-semibold text-slate-100 outline-none transition focus:border-amber-300/45"
            />
          </div>
        </div>

        <div className="space-y-5">
          {!events.length ? (
            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-6">
              <p className="text-base font-semibold text-white">Няма live календарни събития за тази седмица.</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Demo календарът е скрит. Натисни „Обнови“, за да се заредят live събития и последната история.
              </p>
            </div>
          ) : null}

          {events.length && !visibleEvents.length ? (
            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-6">
              <p className="text-base font-semibold text-white">Няма събития по тези филтри.</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Разшири impact, тип събитие или валута, за да се покажат повече новини.
              </p>
            </div>
          ) : null}

          {visibleEvents.length > 0 && !selectedDateEvents.length ? (
            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-6">
              <p className="text-base font-semibold text-white">Няма събития за избрания ден.</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Върни ден назад/напред или промени филтрите, за да видиш публикувани и предстоящи събития.
              </p>
            </div>
          ) : null}

          {Object.entries(groupedEvents).map(([day, dayEvents]) => (
            <div key={day} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-300/[0.12] text-amber-100">
                    <CalendarClock className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold capitalize text-white">{formatSofiaDay(day)}</p>
                    <p className="text-xs text-slate-400">{dayEvents.length} събития</p>
                  </div>
                </div>
              </div>

              <div className="hidden grid-cols-[74px_78px_minmax(220px,1fr)_minmax(270px,390px)_154px_48px] gap-3 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 xl:grid">
                <span>Час</span>
                <span>Валута</span>
                <span>Новина</span>
                <span>Стойности</span>
                <span>Посока</span>
                <span className="text-right">Аларма</span>
              </div>

              <div className="space-y-2">
                {dayEvents.map((event) => {
                  const alert = alertsById.get(event.id);
                  const settings =
                    alert ??
                    buildAlertForEvent(event, {
                      notifyBeforeMinutes: 10,
                      notifyOnPublish: true,
                    });

                  return (
                    <div key={event.id} className="relative">
                      <article
                        role="button"
                        tabIndex={0}
                        data-testid="calendar-event-row"
                        onClick={() => setSelectedEvent(event)}
                        onKeyDown={(keyboardEvent) => {
                          if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                            keyboardEvent.preventDefault();
                            setSelectedEvent(event);
                          }
                        }}
                        className="grid cursor-pointer gap-3 rounded-[18px] border border-white/8 bg-[#0c1426]/90 p-3 transition hover:border-amber-300/28 hover:bg-[#111c32] focus:outline-none focus:ring-2 focus:ring-amber-300/35 xl:grid-cols-[74px_78px_minmax(220px,1fr)_minmax(270px,390px)_154px_48px] xl:items-center"
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          <Clock3 className="size-4 text-amber-200" />
                          {formatSofiaTime(event.startsAt)}
                        </div>

                        <div className="text-xs font-medium text-slate-400">
                          <p className="text-slate-200">{event.currency}</p>
                          <p className="mt-0.5 truncate">{event.country}</p>
                        </div>

                        <div className="min-w-0">
                          <h2 className="truncate text-base font-semibold text-white" title={event.title}>
                            {event.title}
                          </h2>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", impactClass(event.impact))}>
                              {calendarImpactLabels[event.impact]} impact
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-200">
                              {calendarEventTypeLabels[event.eventType]}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-200">
                              {relevanceLabels[event.relevance]}
                            </span>
                            {isStrongGoldCalendarEvent(event) ? <StrongXauBadge /> : null}
                          </div>
                        </div>

                        <CompactValueCells event={event} />

                        <div
                          className={cn(
                            "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium xl:w-full xl:justify-center",
                            directionClass(event.expectedGoldImpact),
                          )}
                        >
                          <DirectionIcon direction={event.expectedGoldImpact} />
                          <span className="truncate">{directionLabels[event.expectedGoldImpact]}</span>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={(mouseEvent) => {
                              mouseEvent.stopPropagation();
                              setActiveAlertId((current) => (current === event.id ? null : event.id));
                            }}
                            className={cn(
                              "flex size-10 items-center justify-center rounded-full border text-xs font-semibold transition",
                              alert
                                ? "border-amber-300/35 bg-amber-300/14 text-amber-100"
                                : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]",
                            )}
                            aria-label={`${alert ? "Редактирай аларма" : "Добави аларма"} за ${event.title}`}
                          >
                            {alert ? <BellRing className="size-4" /> : <Bell className="size-4" />}
                          </button>
                        </div>
                      </article>

                      {activeAlertId === event.id ? (
                        <div className="absolute right-2 top-[calc(100%-4px)] z-20 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-amber-300/18 bg-[#121c31] p-3 shadow-[0_22px_60px_rgba(0,0,0,0.38)]">
                          <p className="text-sm font-semibold text-white">Аларма за събитието</p>
                          {!alert ? (
                            <button
                              type="button"
                              onClick={() =>
                                void upsertAlert(event, {
                                  notifyBeforeMinutes: 10,
                                  notifyOnPublish: true,
                                })
                              }
                              className="mt-3 inline-flex h-9 items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/14 px-3 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/20"
                            >
                              <BellRing className="size-4" />
                              Активирай аларма
                            </button>
                          ) : null}
                          <div className="mt-3 space-y-2">
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                              <input
                                type="checkbox"
                                checked={Boolean(settings.notifyBeforeMinutes)}
                                onChange={() =>
                                  void upsertAlert(event, {
                                    notifyBeforeMinutes: settings.notifyBeforeMinutes ? null : 10,
                                    notifyOnPublish: settings.notifyOnPublish,
                                  })
                                }
                                className="size-4 accent-amber-300"
                              />
                              10 минути преди събитието
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                              <input
                                type="checkbox"
                                checked={settings.notifyOnPublish}
                                onChange={() =>
                                  void upsertAlert(event, {
                                    notifyBeforeMinutes: settings.notifyBeforeMinutes,
                                    notifyOnPublish: !settings.notifyOnPublish,
                                  })
                                }
                                className="size-4 accent-amber-300"
                              />
                              При публикуван резултат
                            </label>
                          </div>
                          {alert ? (
                            <button
                              type="button"
                              onClick={() => removeAlert(event.id)}
                              className="mt-3 inline-flex h-9 items-center rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
                            >
                              Премахни алармата
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Как работи календарът сега" eyebrow="Данни">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold text-white">ForexFactory weekly export</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Седмичният export добавя реални economic събития с previous, forecast и actual полета.
            </p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold text-white">FRED, BLS и Fed слой</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Официалните източници пазят календара стабилен: FRED дава release dates, BLS
              добавя последни actual стойности, а Fed добавя FOMC решенията.
            </p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold text-white">Локални аларми</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Алармите и филтрите се пазят в този браузър. Desktop известията работят, когато сайтът е отворен.
            </p>
          </div>
        </div>
      </SectionCard>

      {selectedEvent ? (
        <CalendarEventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      ) : null}
    </div>
  );
}
