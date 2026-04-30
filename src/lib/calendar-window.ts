import { addDays, startOfDay } from "date-fns";

export const calendarHistoryDays = 14;
export const calendarFutureDays = 14;

export function getUpcomingCalendarWindow(now = new Date()) {
  const start = startOfDay(now);
  const end = addDays(start, 7);

  return { start, end };
}

export function getCalendarHistoryWindow(now = new Date()) {
  const today = startOfDay(now);
  const start = addDays(today, -calendarHistoryDays);
  const end = addDays(today, calendarFutureDays + 1);

  return { start, end };
}

export function isInUpcomingCalendarWindow(startsAt: string, now = new Date()) {
  const time = new Date(startsAt).getTime();
  const { start, end } = getUpcomingCalendarWindow(now);

  return time >= start.getTime() && time < end.getTime();
}

export function isInCalendarHistoryWindow(startsAt: string, now = new Date()) {
  const time = new Date(startsAt).getTime();
  const { start, end } = getCalendarHistoryWindow(now);

  return time >= start.getTime() && time < end.getTime();
}
