import { describe, expect, test } from "vitest";

import {
  emptyActualLabel,
  getCalendarDirectionPresentation,
  getCalendarEventDetail,
  getGoldNewsImpactScore,
  getCalendarValuePanels,
  isStrongGoldCalendarEvent,
  isStrongGoldNews,
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
    expect(panels.find((panel) => panel.key === "forecast")?.value).toBe(emptyActualLabel);
    expect(panels.find((panel) => panel.key === "actual")?.value).toBe(emptyActualLabel);
  });

  test("keeps compact actual empty after release while detail explains source checks", () => {
    const event = {
      ...baseEvent,
      actualStatus: "source_pending",
    } satisfies EconomicCalendarEvent;
    const panels = getCalendarValuePanels({
      ...baseEvent,
      actualStatus: "source_pending",
    });
    const detail = getCalendarEventDetail(event);

    expect(panels.find((panel) => panel.key === "actual")?.value).toBe(emptyActualLabel);
    expect(detail.releaseAnalysis).toContain("клетката остава празна");
  });

  test("does not show fake actuals for unsupported speech events", () => {
    const event = {
      ...baseEvent,
      title: "President Trump Speaks",
      eventType: "speeches",
      actualStatus: "source_pending",
      forecastStatus: "not_applicable",
    } satisfies EconomicCalendarEvent;
    const panels = getCalendarValuePanels(event);
    const detail = getCalendarEventDetail(event);

    expect(panels.find((panel) => panel.key === "actual")?.value).toBe(emptyActualLabel);
    expect(detail.releaseAnalysis).toContain("няма надеждно публикувана стойност");
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

  test("adds post-release analysis when actual is published", () => {
    const detail = getCalendarEventDetail({
      ...baseEvent,
      forecast: "2.2%",
      forecastStatus: "provided",
      actual: "2.0%",
      actualSource: "FRED / BEA official GDP",
      expectedGoldImpact: "bullish",
    });

    expect(detail.releaseAnalysis).toContain("2.0%");
    expect(detail.releaseAnalysis).toContain("под очакването");
    expect(detail.releaseAnalysis).toContain("FRED / BEA official GDP");
  });

  test("shows equal actual and forecast as within expectations", () => {
    const direction = getCalendarDirectionPresentation({
      ...baseEvent,
      forecast: "3.75%",
      actual: "3.75%",
      expectedGoldImpact: "neutral",
    });
    const detail = getCalendarEventDetail({
      ...baseEvent,
      forecast: "3.75%",
      forecastStatus: "provided",
      actual: "3.75%",
      expectedGoldImpact: "neutral",
    });

    expect(direction).toEqual({
      direction: "neutral",
      label: "В рамките на очакването",
    });
    expect(detail.releaseAnalysis).toContain("в рамките на очакването");
  });

  test("colors comparable calendar values by gold impact while keeping forecast neutral", () => {
    const panels = getCalendarValuePanels({
      ...baseEvent,
      title: "Advance GDP q/q",
      eventType: "growth",
      previous: "1.4%",
      forecast: "2.2%",
      forecastStatus: "provided",
      actual: "2.0%",
      expectedGoldImpact: "bullish",
    });

    expect(panels.find((panel) => panel.key === "latest")?.tone).toBe("bullish");
    expect(panels.find((panel) => panel.key === "forecast")?.tone).toBe("neutral");
    expect(panels.find((panel) => panel.key === "actual")?.tone).toBe("bullish");
  });

  test("keeps expected values neutral and colors hotter wage data as bearish", () => {
    const panels = getCalendarValuePanels({
      ...baseEvent,
      title: "Employment Cost Index q/q",
      eventType: "employment",
      previous: "0.7%",
      forecast: "0.8%",
      forecastStatus: "provided",
      actual: "0.9%",
      expectedGoldImpact: "bearish",
    });

    expect(panels.find((panel) => panel.key === "latest")?.tone).toBe("bullish");
    expect(panels.find((panel) => panel.key === "forecast")?.tone).toBe("neutral");
    expect(panels.find((panel) => panel.key === "actual")?.tone).toBe("bearish");
  });

  test("marks published FOMC text events as tone-driven", () => {
    const event: EconomicCalendarEvent = {
      ...baseEvent,
      title: "FOMC Statement",
      eventType: "central_bank",
      actual: "Публикувано",
      actualStatus: "published",
      actualSource: "ForexFactory weekly export",
      expectedGoldImpact: "mixed",
    };
    const direction = getCalendarDirectionPresentation(event);
    const detail = getCalendarEventDetail(event);

    expect(direction).toEqual({
      direction: "mixed",
      label: "Тонът е решаващ",
    });
    expect(detail.releaseAnalysis).toContain("няма числова actual стойност");
    expect(detail.releaseAnalysis).toContain("тона");
  });

  test("marks published ECB statement events as tone-driven", () => {
    const event: EconomicCalendarEvent = {
      ...baseEvent,
      country: "EUR",
      currency: "EUR",
      title: "Monetary Policy Statement",
      eventType: "central_bank",
      actual: "Публикувано",
      actualStatus: "published",
      actualSource: "European Central Bank",
      expectedGoldImpact: "mixed",
    };

    expect(getCalendarDirectionPresentation(event)).toEqual({
      direction: "mixed",
      label: "Тонът е решаващ",
    });
    expect(getCalendarEventDetail(event).releaseAnalysis).toContain("European Central Bank");
  });

  test("marks published FRED package releases as data bundles", () => {
    const event: EconomicCalendarEvent = {
      ...baseEvent,
      title: "Gross Domestic Product (GDP)",
      eventType: "growth",
      actual: "Публикувано",
      actualStatus: "published",
      actualSource: "FRED release calendar",
      expectedGoldImpact: "mixed",
      forecastStatus: "not_applicable",
    };
    const panels = getCalendarValuePanels(event);
    const direction = getCalendarDirectionPresentation(event);
    const detail = getCalendarEventDetail(event);

    expect(panels.find((panel) => panel.key === "forecast")?.value).toBe("-");
    expect(direction).toEqual({
      direction: "mixed",
      label: "Пакет от данни",
    });
    expect(detail.releaseAnalysis).toContain("няма една обща actual стойност");
    expect(detail.releaseAnalysis).toContain("конкретните редове");
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
