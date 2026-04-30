import { describe, expect, test } from "vitest";

import { buildDemoSnapshot } from "@/lib/data/demo-snapshot";
import { buildSignalRun } from "@/lib/scoring";

describe("signal scoring", () => {
  test("demo snapshot resolves to bullish bias", () => {
    const snapshot = buildDemoSnapshot();

    expect(snapshot.signal.bias).toBe("bullish");
    expect(snapshot.signal.bullishProbability).toBeGreaterThan(55);
    expect(snapshot.signal.contributions).toHaveLength(4);
  });

  test("bearish headlines can flip the signal", () => {
    const snapshot = buildDemoSnapshot();
    const bearishNews = snapshot.news.map((entry) => ({
      ...entry,
      analysis: {
        ...entry.analysis,
        impactDirection: "bearish" as const,
        directionalScore: -0.8,
      },
    }));

    const signal = buildSignalRun({
      news: bearishNews,
      cotSeries: snapshot.cotSeries,
      macroSeries: snapshot.macroSeries,
      price: {
        ...snapshot.price,
        weeklyChangePct: -3.2,
        monthlyChangePct: -5.8,
        regimeScore: -0.62,
        regime: "trend-down",
      },
    });

    expect(signal.bias).toBe("bearish");
    expect(signal.bullishProbability).toBeLessThan(45);
  });
});
