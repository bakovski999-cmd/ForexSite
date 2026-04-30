import type { CalendarEventType, CalendarImpact, EconomicCalendarEvent } from "@/lib/types";

export type CalendarFilterState = {
  impacts: CalendarImpact[];
  eventTypes: CalendarEventType[];
  currencies: string[];
  goldOnly: boolean;
};

export const calendarFilterStorageKey = "gold-calendar-filters:v1";

export const calendarImpactOptions = ["high", "medium", "low"] as const satisfies CalendarImpact[];

export const calendarEventTypeOptions = [
  "growth",
  "inflation",
  "employment",
  "central_bank",
  "bonds",
  "housing",
  "consumer_surveys",
  "business_surveys",
  "speeches",
  "misc",
] as const satisfies CalendarEventType[];

export const calendarCurrencyOptions = [
  "AUD",
  "CAD",
  "CHF",
  "CNY",
  "EUR",
  "GBP",
  "JPY",
  "NZD",
  "USD",
] as const;

export const calendarImpactLabels: Record<CalendarImpact, string> = {
  high: "Висок",
  medium: "Среден",
  low: "Нисък",
};

export const calendarEventTypeLabels: Record<CalendarEventType, string> = {
  growth: "Растеж",
  inflation: "Инфлация",
  employment: "Заетост",
  central_bank: "Централни банки",
  bonds: "Облигации",
  housing: "Жилища",
  consumer_surveys: "Потребителски анкети",
  business_surveys: "Бизнес анкети",
  speeches: "Речи",
  misc: "Други",
};

export function getDefaultCalendarFilterState(): CalendarFilterState {
  return {
    impacts: ["high", "medium"],
    eventTypes: [...calendarEventTypeOptions],
    currencies: [...calendarCurrencyOptions],
    goldOnly: false,
  };
}

export function getOpenCalendarFilterState(): CalendarFilterState {
  return {
    impacts: [...calendarImpactOptions],
    eventTypes: [...calendarEventTypeOptions],
    currencies: [...calendarCurrencyOptions],
    goldOnly: false,
  };
}

function normalizeSelection<T extends string>(candidate: unknown, allowed: readonly T[], fallback: T[]) {
  if (!Array.isArray(candidate)) {
    return fallback;
  }

  const allowedSet = new Set(allowed);
  const normalized = candidate.filter((item): item is T => typeof item === "string" && allowedSet.has(item as T));

  return normalized.length ? normalized : fallback;
}

export function normalizeCalendarFilterState(candidate: unknown): CalendarFilterState {
  const fallback = getDefaultCalendarFilterState();

  if (!candidate || typeof candidate !== "object") {
    return fallback;
  }

  const value = candidate as Partial<CalendarFilterState>;

  return {
    impacts: normalizeSelection(value.impacts, calendarImpactOptions, fallback.impacts),
    eventTypes: normalizeSelection(value.eventTypes, calendarEventTypeOptions, fallback.eventTypes),
    currencies: normalizeSelection(value.currencies, calendarCurrencyOptions, fallback.currencies),
    goldOnly: value.goldOnly === true,
  };
}

export function isGoldRelevantCalendarEvent(event: EconomicCalendarEvent) {
  if (event.relevance === "direct" || event.relevance === "strong") {
    return true;
  }

  if (event.currency === "USD" && event.impact !== "low") {
    return true;
  }

  return (
    event.eventType === "central_bank" ||
    event.eventType === "inflation" ||
    event.eventType === "employment" ||
    event.eventType === "bonds"
  );
}

export function filterCalendarEvents(events: EconomicCalendarEvent[], filters: CalendarFilterState) {
  const impactSet = new Set(filters.impacts);
  const typeSet = new Set(filters.eventTypes);
  const currencySet = new Set(filters.currencies);

  return events.filter(
    (event) =>
      impactSet.has(event.impact) &&
      typeSet.has(event.eventType) &&
      currencySet.has(event.currency) &&
      (!filters.goldOnly || isGoldRelevantCalendarEvent(event)),
  );
}

export function inferCalendarEventType(title: string): CalendarEventType {
  const text = title.toLowerCase();

  if (/(fed|fomc|rate decision|interest rate|policy rate|central bank|monetary policy|ecb|boj|boe|boc|rba|rbnz|snb)/.test(text)) {
    return "central_bank";
  }

  if (/(cpi|pce|ppi|inflation|prices|price index|earnings|wages)/.test(text)) {
    return "inflation";
  }

  if (/(payroll|nonfarm|non-farm|employment|unemployment|jobless|claims|jolts|labor|labour)/.test(text)) {
    return "employment";
  }

  if (/(treasury|yield|auction|bond|gilt|bund|note)/.test(text)) {
    return "bonds";
  }

  if (/(housing|home|hpi|building permits|building approvals|mortgage|house price|starts)/.test(text)) {
    return "housing";
  }

  if (/(consumer confidence|consumer sentiment|gfk|retail sales|personal spending|personal income)/.test(text)) {
    return "consumer_surveys";
  }

  if (/(pmi|ism|manufacturing|services|business confidence|business climate|industrial production|factory|durable goods|orders|inventories)/.test(text)) {
    return "business_surveys";
  }

  if (/(speaks|speech|testifies|testimony|press conference|statement)/.test(text)) {
    return "speeches";
  }

  if (/(gdp|gross domestic product|trade balance|current account|leading index|productivity)/.test(text)) {
    return "growth";
  }

  return "misc";
}
