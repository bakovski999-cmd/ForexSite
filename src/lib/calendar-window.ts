import { addDays, startOfDay } from "date-fns";

export function getUpcomingCalendarWindow(now = new Date()) {
  const start = startOfDay(now);
  const end = addDays(start, 7);

  return { start, end };
}

export function isInUpcomingCalendarWindow(startsAt: string, now = new Date()) {
  const time = new Date(startsAt).getTime();
  const { start, end } = getUpcomingCalendarWindow(now);

  return time >= start.getTime() && time < end.getTime();
}
