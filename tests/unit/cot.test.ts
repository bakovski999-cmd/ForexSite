import { describe, expect, test } from "vitest";

import { buildCotPositionRows, describeCotDelta } from "@/lib/cot";
import type { CotSnapshot } from "@/lib/types";

function makeSnapshot(overrides: Partial<CotSnapshot>): CotSnapshot {
  return {
    id: "combined-2026-04-21",
    reportDate: "2026-04-21",
    reportType: "combined",
    marketName: "GOLD - COMMODITY EXCHANGE INC.",
    openInterest: 1000,
    managedMoneyLong: 400,
    managedMoneyShort: 150,
    managedMoneyNet: 250,
    swapDealerNet: 0,
    producerNet: 0,
    otherReportablesNet: 0,
    weeklyDelta: 0,
    sourceUrl: "https://example.com/cot",
    ...overrides,
  };
}

describe("COT positioning helpers", () => {
  test("computes weekly changes and open-interest shares from latest-first snapshots", () => {
    const rows = buildCotPositionRows([
      makeSnapshot({
        id: "combined-2026-04-21",
        reportDate: "2026-04-21",
        openInterest: 1100,
        managedMoneyLong: 420,
        managedMoneyShort: 160,
        managedMoneyNet: 260,
        weeklyDelta: 30,
      }),
      makeSnapshot({
        id: "combined-2026-04-14",
        reportDate: "2026-04-14",
        openInterest: 1000,
        managedMoneyLong: 390,
        managedMoneyShort: 160,
        managedMoneyNet: 230,
      }),
    ]);

    expect(rows[0].changeLong).toBe(30);
    expect(rows[0].changeShort).toBe(0);
    expect(rows[0].changeNet).toBe(30);
    expect(rows[0].changeOpenInterest).toBe(100);
    expect(rows[0].longOpenInterestShare).toBeCloseTo(38.18, 2);
    expect(rows[0].shortOpenInterestShare).toBeCloseTo(14.55, 2);
  });

  test("uses parser-provided deltas when they are available", () => {
    const rows = buildCotPositionRows([
      makeSnapshot({
        managedMoneyLongDelta: -15,
        managedMoneyShortDelta: 7,
        openInterestDelta: -20,
        weeklyDelta: -22,
      }),
    ]);

    expect(rows[0].changeLong).toBe(-15);
    expect(rows[0].changeShort).toBe(7);
    expect(rows[0].changeNet).toBe(-22);
    expect(rows[0].changeOpenInterest).toBe(-20);
  });

  test("describes positive, negative and neutral positioning changes", () => {
    expect(describeCotDelta({ changeLong: 20, changeShort: 3, changeNet: 17 })).toContain(
      "се разширява",
    );
    expect(describeCotDelta({ changeLong: -5, changeShort: 18, changeNet: -23 })).toContain(
      "short експозиция",
    );
    expect(describeCotDelta({ changeLong: 0, changeShort: 0, changeNet: 0 })).toContain(
      "без седмична промяна",
    );
  });
});
