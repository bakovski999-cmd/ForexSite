import { describe, expect, test } from "vitest";

import {
  buildCotPositionAnalysis,
  buildCotPositionRows,
  describeCotDelta,
  getCotChangeTone,
} from "@/lib/cot";
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
    expect(rows[0].previousReportDate).toBe("2026-04-14");
    expect(rows[0].previousLong).toBe(390);
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

  test("colors COT change values by mathematical sign", () => {
    expect(getCotChangeTone(622)).toBe("positive");
    expect(getCotChangeTone(-2730)).toBe("negative");
    expect(getCotChangeTone(0)).toBe("neutral");
  });

  test("builds a detailed Bulgarian COT comparison analysis", () => {
    const row = buildCotPositionRows([
      makeSnapshot({
        id: "combined-2026-04-21",
        reportDate: "2026-04-21",
        openInterest: 556894,
        managedMoneyLong: 125908,
        managedMoneyShort: 30410,
        managedMoneyNet: 95498,
        weeklyDelta: -3352,
      }),
      makeSnapshot({
        id: "combined-2026-04-14",
        reportDate: "2026-04-14",
        openInterest: 565169,
        managedMoneyLong: 128638,
        managedMoneyShort: 29788,
        managedMoneyNet: 98850,
      }),
    ])[0];
    const analysis = buildCotPositionAnalysis(row);

    expect(analysis.comparisonLabel).toContain("21.04.2026");
    expect(analysis.comparisonLabel).toContain("14.04.2026");
    expect(analysis.bias).toBe("cooling");
    expect(analysis.longAnalysis).toContain("Long позициите");
    expect(analysis.shortAnalysis).toContain("Short позициите");
    expect(analysis.conclusion).toContain("златото все още има спекулативна long подкрепа");
  });
});
