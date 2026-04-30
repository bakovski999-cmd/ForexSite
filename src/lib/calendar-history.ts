import { isInCalendarHistoryWindow } from "@/lib/calendar-window";
import type { CalendarActualStatus, EconomicCalendarEvent } from "@/lib/types";

const releasePollingWindowMs = 8 * 60 * 60 * 1000;

function normalizeCalendarText(value: string | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buildCalendarEventKey(
  event: Pick<EconomicCalendarEvent, "country" | "currency" | "startsAt" | "title">,
) {
  const eventTime = new Date(event.startsAt);
  const startsAt = Number.isFinite(eventTime.getTime()) ? eventTime.toISOString() : event.startsAt;

  return [
    normalizeCalendarText(event.currency),
    normalizeCalendarText(event.country),
    normalizeCalendarText(event.title),
    startsAt,
  ].join("|");
}

export function getCalendarEventKey(event: EconomicCalendarEvent) {
  return event.calendarKey || buildCalendarEventKey(event);
}

export function getCalendarActualStatus(
  event: Pick<EconomicCalendarEvent, "actual" | "startsAt">,
  now = new Date(),
): CalendarActualStatus {
  if (event.actual) {
    return "published";
  }

  const startsAt = new Date(event.startsAt).getTime();

  if (Number.isFinite(startsAt) && startsAt <= now.getTime()) {
    return "source_pending";
  }

  return "pending";
}

function mergeEvent(
  previous: EconomicCalendarEvent | undefined,
  incoming: EconomicCalendarEvent,
  now: Date,
): EconomicCalendarEvent {
  const actual = incoming.actual ?? previous?.actual;
  const actualChanged = Boolean(incoming.actual && incoming.actual !== previous?.actual);
  const calendarKey = incoming.calendarKey ?? previous?.calendarKey ?? buildCalendarEventKey(incoming);

  return {
    ...previous,
    ...incoming,
    id: previous?.id ?? incoming.id,
    calendarKey,
    previous: incoming.previous ?? previous?.previous,
    forecast: incoming.forecast ?? previous?.forecast,
    forecastStatus: incoming.forecastStatus ?? previous?.forecastStatus,
    actual,
    actualSource: incoming.actual
      ? incoming.actualSource ?? incoming.source
      : previous?.actualSource ?? incoming.actualSource,
    actualUpdatedAt: incoming.actual
      ? incoming.actualUpdatedAt ?? (actualChanged ? now.toISOString() : previous?.actualUpdatedAt)
      : previous?.actualUpdatedAt ?? incoming.actualUpdatedAt,
    actualStatus: getCalendarActualStatus({ actual, startsAt: incoming.startsAt }, now),
    latestActual: incoming.latestActual ?? previous?.latestActual ?? incoming.previous,
    latestActualPeriod: incoming.latestActualPeriod ?? previous?.latestActualPeriod,
    expectedGoldImpact:
      incoming.actual || !previous?.actual ? incoming.expectedGoldImpact : previous.expectedGoldImpact,
  };
}

export function mergeCalendarEvents(
  previousEvents: EconomicCalendarEvent[],
  incomingEvents: EconomicCalendarEvent[],
  now = new Date(),
) {
  const eventsByKey = new Map<string, EconomicCalendarEvent>();

  for (const event of previousEvents) {
    const normalized = {
      ...event,
      calendarKey: event.calendarKey ?? buildCalendarEventKey(event),
      actualStatus: event.actualStatus ?? getCalendarActualStatus(event, now),
    };

    if (isInCalendarHistoryWindow(normalized.startsAt, now)) {
      eventsByKey.set(getCalendarEventKey(normalized), normalized);
    }
  }

  for (const event of incomingEvents) {
    const key = event.calendarKey ?? buildCalendarEventKey(event);
    const normalized = {
      ...event,
      calendarKey: key,
      actualStatus: event.actualStatus ?? getCalendarActualStatus(event, now),
    };

    if (isInCalendarHistoryWindow(normalized.startsAt, now)) {
      eventsByKey.set(key, mergeEvent(eventsByKey.get(key), normalized, now));
    }
  }

  return [...eventsByKey.values()].sort(
    (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );
}

export function getPendingReleasedCalendarEvents(events: EconomicCalendarEvent[], now = new Date()) {
  const nowMs = now.getTime();

  return events.filter((event) => {
    if (event.actual || event.actualStatus === "published") {
      return false;
    }

    const startsAt = new Date(event.startsAt).getTime();

    return (
      Number.isFinite(startsAt) &&
      startsAt <= nowMs &&
      nowMs - startsAt <= releasePollingWindowMs
    );
  });
}
