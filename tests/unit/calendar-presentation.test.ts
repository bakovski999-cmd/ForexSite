import { describe, expect, test } from "vitest";

import {
  getCalendarEventDetail,
  getGoldNewsImpactScore,
  getCalendarValuePanels,
  isStrongGoldCalendarEvent,
  isStrongGoldNews,
  pendingActualLabel,
  unavailableFreeForecastLabel,
} from "@/lib/calendar-presentation";
import type { EconomicCalendarEvent } from "@/lib/types";

const baseEvent: EconomicCalendarEvent = {
  id: "event-1",
  startsAt: "2026-05-12T12:30:00.000Z",
  country: "САЩ",
  currency: "USD",
  title: "Consumer Price Index (CPI)",
  impact: "high",
  eventType: "inflation",
  relevance: "direct",
  forecastStatus: "unavailable_free",
  latestActual: "3.5%",
  latestActualPeriod: "март 2026",
  source: "FRED + BLS official data",
  affectedDrivers: ["inflation", "fed", "real_yields", "usd"],
  expectedGoldImpact: "mixed",
  scenarioBullish: "По-слаб резултат помага на златото.",
  scenarioBearish: "По-силен резултат тежи на златото.",
  explanationBg: "Инфлацията движи Fed очакванията.",
};

describe("calendar presentation", () => {
  test("keeps pending actual separate from latest official value", () => {
    const panels = getCalendarValuePanels(baseEvent);

    expect(panels.find((panel) => panel.key === "latest")?.value).toBe("3.5%");
    expect(panels.find((panel) => panel.key === "forecast")?.value).toBe(
      unavailableFreeForecastLabel,
    );
    expect(panels.find((panel) => panel.key === "actual")?.value).toBe(pendingActualLabel);
  });

  test("explains Fed calendar events through rates, USD and real yields", () => {
    const detail = getCalendarEventDetail({
      ...baseEvent,
      title: "Federal Funds Rate",
      eventType: "central_bank",
      affectedDrivers: ["fed", "real_yields", "nominal_yields", "usd"],
    });

    expect(detail.goldImpact).toContain("реални доходности");
    expect(detail.goldImpact).toContain("USD");
    expect(detail.goldImpact).toContain("лихви");
  });

  test("explains inflation events through Fed expectations and the real-yield channel", () => {
    const detail = getCalendarEventDetail(baseEvent);

    expect(detail.meaning).toContain("Fed очакванията");
    expect(detail.goldImpact).toContain("real-yield");
  });

  test("explains employment events through USD, yields and risk sentiment", () => {
    const detail = getCalendarEventDetail({
      ...baseEvent,
      title: "Non-Farm Employment Change",
      eventType: "employment",
      affectedDrivers: ["fed", "usd", "nominal_yields", "risk"],
    });

    expect(detail.goldImpact).toContain("USD");
    expect(detail.goldImpact).toContain("доходности");
    expect(detail.goldImpact).toContain("risk sentiment");
  });

  test("flags strong gold calendar and news drivers", () => {
    expect(isStrongGoldCalendarEvent({ impact: "high", relevance: "direct" })).toBe(true);
    expect(isStrongGoldCalendarEvent({ impact: "high", relevance: "strong" })).toBe(true);
    expect(isStrongGoldCalendarEvent({ impact: "medium", relevance: "direct" })).toBe(false);

    expect(
      isStrongGoldNews({
        confidence: 0.72,
        directionalScore: -0.58,
        impactDirection: "bearish",
      }),
    ).toBe(true);
    expect(
      isStrongGoldNews({
        confidence: 0.8,
        directionalScore: 0,
        impactDirection: "neutral",
      }),
    ).toBe(false);
    expect(
      getGoldNewsImpactScore({
        confidence: 0.75,
        directionalScore: 0.4,
        impactDirection: "bullish",
      }),
    ).toBeCloseTo(0.3);
  });
});
