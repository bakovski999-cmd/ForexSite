import { describe, expect, test } from "vitest";

import { getUpcomingCalendarWindow, isInUpcomingCalendarWindow } from "@/lib/calendar-window";

describe("calendar week window", () => {
  test("uses a rolling seven-day window from the current day", () => {
    const now = new Date("2026-04-27T09:15:00.000Z");
    const window = getUpcomingCalendarWindow(now);

    expect(window.start.toISOString()).toBe("2026-04-26T21:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-05-03T21:00:00.000Z");
  });

  test("keeps events inside the next seven days only", () => {
    const now = new Date("2026-04-27T09:15:00.000Z");

    expect(isInUpcomingCalendarWindow("2026-04-27T12:30:00.000Z", now)).toBe(true);
    expect(isInUpcomingCalendarWindow("2026-05-03T20:59:00.000Z", now)).toBe(true);
    expect(isInUpcomingCalendarWindow("2026-05-03T21:00:00.000Z", now)).toBe(false);
    expect(isInUpcomingCalendarWindow("2026-04-26T20:59:00.000Z", now)).toBe(false);
  });
});
