import type { EconomicCalendarEvent } from "@/lib/types";

export type CalendarAlertSettings = {
  eventId: string;
  title: string;
  startsAt: string;
  notifyBeforeMinutes: number | null;
  notifyOnPublish: boolean;
  beforeSentAt?: string;
  publishSentActual?: string;
  lastActual?: string;
};

export type CalendarAlertNotification = {
  eventId: string;
  kind: "before" | "published";
  title: string;
  body: string;
};

export const calendarAlertStorageKey = "gold-calendar-alerts:v1";

export function normalizeCalendarAlerts(candidate: unknown): CalendarAlertSettings[] {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate.filter((item): item is CalendarAlertSettings => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const alert = item as CalendarAlertSettings;
    const notifyBeforeMinutes =
      alert.notifyBeforeMinutes === null ||
      (typeof alert.notifyBeforeMinutes === "number" && alert.notifyBeforeMinutes > 0);

    return (
      typeof alert.eventId === "string" &&
      typeof alert.title === "string" &&
      typeof alert.startsAt === "string" &&
      notifyBeforeMinutes &&
      typeof alert.notifyOnPublish === "boolean"
    );
  });
}

function formatAlertTime(startsAt: string) {
  const date = new Date(startsAt);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("bg-BG", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Sofia",
  }).format(date);
}

export function buildAlertForEvent(
  event: EconomicCalendarEvent,
  options: Pick<CalendarAlertSettings, "notifyBeforeMinutes" | "notifyOnPublish">,
): CalendarAlertSettings {
  return {
    eventId: event.id,
    title: event.title,
    startsAt: event.startsAt,
    notifyBeforeMinutes: options.notifyBeforeMinutes,
    notifyOnPublish: options.notifyOnPublish,
    lastActual: event.actual,
  };
}

export function evaluateCalendarAlerts(
  events: EconomicCalendarEvent[],
  alerts: CalendarAlertSettings[],
  nowMs = Date.now(),
) {
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const notifications: CalendarAlertNotification[] = [];
  const nextAlerts = alerts.map((alert) => {
    const event = eventsById.get(alert.eventId);

    if (!event) {
      return alert;
    }

    let nextAlert = {
      ...alert,
      title: event.title,
      startsAt: event.startsAt,
    };

    const eventTime = Date.parse(event.startsAt);

    if (
      nextAlert.notifyBeforeMinutes &&
      !nextAlert.beforeSentAt &&
      Number.isFinite(eventTime) &&
      nowMs >= eventTime - nextAlert.notifyBeforeMinutes * 60_000 &&
      nowMs <= eventTime
    ) {
      const sentAt = new Date(nowMs).toISOString();
      notifications.push({
        eventId: event.id,
        kind: "before",
        title: `Предстояща новина: ${event.title}`,
        body: `Започва в ${formatAlertTime(event.startsAt)}. Остават около ${nextAlert.notifyBeforeMinutes} минути.`,
      });
      nextAlert = {
        ...nextAlert,
        beforeSentAt: sentAt,
      };
    }

    if (
      nextAlert.notifyOnPublish &&
      event.actual &&
      event.actual !== nextAlert.lastActual &&
      event.actual !== nextAlert.publishSentActual
    ) {
      notifications.push({
        eventId: event.id,
        kind: "published",
        title: `Публикувана новина: ${event.title}`,
        body: `Нов факт: ${event.actual}${event.forecast ? ` | Очаквана: ${event.forecast}` : ""}`,
      });
      nextAlert = {
        ...nextAlert,
        lastActual: event.actual,
        publishSentActual: event.actual,
      };
    }

    return nextAlert;
  });

  return {
    notifications,
    nextAlerts,
  };
}
