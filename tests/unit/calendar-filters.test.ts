import { describe, expect, test } from "vitest";

import {
  filterCalendarEvents,
  getDefaultCalendarFilterState,
  inferCalendarEventType,
  normalizeCalendarFilterState,
} from "@/lib/calendar-filters";
import type { EconomicCalendarEvent } from "@/lib/types";

function makeEvent(overrides: Partial<EconomicCalendarEvent>): EconomicCalendarEvent {
  return {
    id: "event",
    startsAt: "2026-04-29T18:00:00.000Z",
    country: "САЩ",
    currency: "USD",
    title: "Federal Funds Rate",
    impact: "high",
    eventType: "central_bank",
    relevance: "direct",
    source: "ForexFactory weekly export",
    affectedDrivers: ["fed", "real_yields", "nominal_yields", "usd"],
    expectedGoldImpact: "mixed",
    scenarioBullish: "По-мек тон помага на златото.",
    scenarioBearish: "По-твърд тон натиска златото.",
    explanationBg: "Fed движи USD и реалните доходности.",
    ...overrides,
  };
}

describe("calendar filters", () => {
  test("infers event types from common calendar titles", () => {
    expect(inferCalendarEventType("Consumer Price Index y/y")).toBe("inflation");
    expect(inferCalendarEventType("FOMC Statement")).toBe("central_bank");
    expect(inferCalendarEventType("Nonfarm Payrolls")).toBe("employment");
    expect(inferCalendarEventType("10-y Bond Auction")).toBe("bonds");
    expect(inferCalendarEventType("Building Permits")).toBe("housing");
  });

  test("filters events by impact, event type and currency", () => {
    const events = [
      makeEvent({ id: "usd-fed", currency: "USD", impact: "high", eventType: "central_bank" }),
      makeEvent({ id: "eur-cpi", currency: "EUR", impact: "high", eventType: "inflation" }),
      makeEvent({ id: "usd-low", currency: "USD", impact: "low", eventType: "misc" }),
    ];
    const filters = {
      ...getDefaultCalendarFilterState(),
      impacts: ["high"],
      eventTypes: ["central_bank"],
      currencies: ["USD"],
    };

    expect(filterCalendarEvents(events, filters).map((event) => event.id)).toEqual(["usd-fed"]);
  });

  test("gold-only keeps direct and strong gold-relevant events", () => {
    const events = [
      makeEvent({ id: "direct-fed", relevance: "direct", impact: "high", eventType: "central_bank" }),
      makeEvent({ id: "strong-cpi", relevance: "strong", impact: "medium", eventType: "inflation" }),
      makeEvent({
        id: "context-housing",
        relevance: "context",
        impact: "low",
        eventType: "housing",
        affectedDrivers: ["risk"],
      }),
    ];
    const filters = {
      ...getDefaultCalendarFilterState(),
      impacts: ["high", "medium", "low"],
      goldOnly: true,
    };

    expect(filterCalendarEvents(events, filters).map((event) => event.id)).toEqual([
      "direct-fed",
      "strong-cpi",
    ]);
  });

  test("gold-only false preserves the normal filter result and old saved filters", () => {
    const event = makeEvent({
      id: "context-housing",
      relevance: "context",
      impact: "low",
      eventType: "housing",
      affectedDrivers: ["risk"],
    });
    const filters = {
      ...getDefaultCalendarFilterState(),
      impacts: ["low"],
      eventTypes: ["housing"],
      goldOnly: false,
    };

    expect(filterCalendarEvents([event], filters).map((item) => item.id)).toEqual(["context-housing"]);
    expect(
      normalizeCalendarFilterState({
        impacts: ["high"],
        eventTypes: ["central_bank"],
        currencies: ["USD"],
      }).goldOnly,
    ).toBe(false);
  });
});
