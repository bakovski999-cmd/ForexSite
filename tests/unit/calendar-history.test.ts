import { describe, expect, test } from "vitest";

import {
  buildCalendarEventKey,
  getPendingReleasedCalendarEvents,
  mergeCalendarEvents,
} from "@/lib/calendar-history";
import type { EconomicCalendarEvent } from "@/lib/types";

const baseEvent: EconomicCalendarEvent = {
  id: "event-1",
  startsAt: "2026-04-30T12:30:00.000Z",
  country: "САЩ",
  currency: "USD",
  title: "Advance GDP q/q",
  impact: "high",
  eventType: "growth",
  relevance: "strong",
  previous: "1.4%",
  forecast: "2.2%",
  forecastStatus: "provided",
  source: "ForexFactory weekly export",
  affectedDrivers: ["usd", "nominal_yields", "risk"],
  expectedGoldImpact: "mixed",
  scenarioBullish: "По-слаб растеж може да помогне на златото.",
  scenarioBearish: "По-силен растеж може да натисне златото.",
  explanationBg: "GDP движи USD и доходностите.",
};

describe("calendar history", () => {
  test("uses a stable key independent from source order", () => {
    const first = buildCalendarEventKey(baseEvent);
    const second = buildCalendarEventKey({
      ...baseEvent,
      id: "event-from-different-index",
    });

    expect(first).toBe(second);
  });

  test("merge updates a past event with actual without losing history", () => {
    const merged = mergeCalendarEvents(
      [baseEvent],
      [
        {
          ...baseEvent,
          id: "fresh-event-1",
          actual: "2.0%",
          actualSource: "FRED / BEA official GDP",
          actualStatus: "published",
          expectedGoldImpact: "bullish",
        },
      ],
      new Date("2026-04-30T15:24:00.000Z"),
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "event-1",
      actual: "2.0%",
      actualSource: "FRED / BEA official GDP",
      actualStatus: "published",
      expectedGoldImpact: "bullish",
    });
  });

  test("pending release detection finds only recently released events without actual", () => {
    const now = new Date("2026-04-30T15:24:00.000Z");
    const pending = getPendingReleasedCalendarEvents(
      [
        baseEvent,
        {
          ...baseEvent,
          id: "future-event",
          startsAt: "2026-04-30T18:00:00.000Z",
        },
        {
          ...baseEvent,
          id: "published-event",
          actual: "2.0%",
        },
      ],
      now,
    );

    expect(pending.map((event) => event.id)).toEqual(["event-1"]);
  });
});
