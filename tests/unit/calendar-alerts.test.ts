import { describe, expect, test } from "vitest";

import {
  buildAlertForEvent,
  evaluateCalendarAlerts,
  normalizeCalendarAlerts,
} from "@/lib/calendar-alerts";
import type { EconomicCalendarEvent } from "@/lib/types";

const baseEvent: EconomicCalendarEvent = {
  id: "event-1",
  startsAt: "2026-04-29T18:00:00.000Z",
  country: "САЩ",
  currency: "USD",
  title: "Federal Funds Rate",
  impact: "high",
  eventType: "central_bank",
  relevance: "direct",
  forecast: "3.75%",
  source: "ForexFactory weekly export",
  affectedDrivers: ["fed", "real_yields", "nominal_yields", "usd"],
  expectedGoldImpact: "mixed",
  scenarioBullish: "По-мек тон помага на златото.",
  scenarioBearish: "По-твърд тон натиска златото.",
  explanationBg: "Fed движи USD и реалните доходности.",
};

describe("calendar alerts", () => {
  test("normalizes only valid saved alerts", () => {
    expect(
      normalizeCalendarAlerts([
        buildAlertForEvent(baseEvent, {
          notifyBeforeMinutes: 10,
          notifyOnPublish: true,
        }),
        { eventId: "broken" },
      ]),
    ).toHaveLength(1);
  });

  test("fires a before-event alert once", () => {
    const alert = buildAlertForEvent(baseEvent, {
      notifyBeforeMinutes: 10,
      notifyOnPublish: true,
    });
    const first = evaluateCalendarAlerts(
      [baseEvent],
      [alert],
      Date.parse("2026-04-29T17:51:00.000Z"),
    );
    const second = evaluateCalendarAlerts(
      [baseEvent],
      first.nextAlerts,
      Date.parse("2026-04-29T17:52:00.000Z"),
    );

    expect(first.notifications).toHaveLength(1);
    expect(first.notifications[0].kind).toBe("before");
    expect(second.notifications).toHaveLength(0);
  });

  test("fires a publish alert when actual appears after refresh", () => {
    const alert = buildAlertForEvent(baseEvent, {
      notifyBeforeMinutes: null,
      notifyOnPublish: true,
    });
    const eventWithActual = {
      ...baseEvent,
      actual: "3.75%",
    };
    const first = evaluateCalendarAlerts([eventWithActual], [alert], Date.parse("2026-04-29T18:00:10.000Z"));
    const second = evaluateCalendarAlerts([eventWithActual], first.nextAlerts, Date.parse("2026-04-29T18:00:40.000Z"));

    expect(first.notifications).toHaveLength(1);
    expect(first.notifications[0]).toMatchObject({
      kind: "published",
      eventId: baseEvent.id,
    });
    expect(second.notifications).toHaveLength(0);
  });
});
