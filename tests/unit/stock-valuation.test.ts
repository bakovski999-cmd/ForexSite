import { describe, expect, test } from "vitest";

import {
  buildDefaultStockValuationInput,
  calculateFcfPerShareTtm,
  calculateHistoricalFcfAverage,
  calculateHistoricalMultipleSummary,
  calculateStockValuation,
  type HistoricalFreeCashFlowRow,
  type HistoricalMultipleRow,
  type HistoricalMultipleBenchmark,
  type HistoricalMultipleSeriesPoint,
  type StockValuationInput,
} from "@/lib/stock-valuation";

const screenshotHistoricalFcfRows: HistoricalFreeCashFlowRow[] = [
  { year: 2023, freeCashFlow: 4358, source: "Manual" },
  { year: 2022, freeCashFlow: 8502, source: "Manual" },
  { year: 2021, freeCashFlow: 3787, source: "Manual" },
  { year: 2020, freeCashFlow: 2786, source: "Manual" },
  { year: 2019, freeCashFlow: 1078, source: "Manual" },
  { year: 2018, freeCashFlow: -3, source: "Manual" },
  { year: 2017, freeCashFlow: -3476, source: "Manual" },
  { year: 2016, freeCashFlow: -1404.63, source: "Manual" },
  { year: 2015, freeCashFlow: -2159.35, source: "Manual" },
  { year: 2014, freeCashFlow: -1027.22, source: "Manual" },
  { year: 2013, freeCashFlow: 0.58, source: "Manual" },
];

const historicalPriceToFcfRows: HistoricalMultipleRow[] = [
  {
    year: 2025,
    numerator: 40,
    denominator: -2,
    multiple: -20,
    source: "Yahoo",
    asOf: "2025-12-31",
  },
  {
    year: 2024,
    numerator: 30,
    denominator: 2,
    multiple: 15,
    source: "Yahoo",
    asOf: "2024-12-31",
  },
  {
    year: 2023,
    numerator: 24,
    denominator: 3,
    multiple: 8,
    source: "Yahoo",
    asOf: "2023-12-31",
  },
  {
    year: 2022,
    numerator: 60,
    denominator: 2,
    multiple: 30,
    source: "Yahoo",
    asOf: "2022-12-31",
  },
];

const metaWorkbookInput: StockValuationInput = {
  ticker: "META",
  companyName: "Meta Platforms",
  currency: "USD",
  currentPrice: 609,
  marketCap: 1_540_000_000,
  sharesOutstanding: 2533659,
  finalWeights: {
    dcf10Years: 0.4,
    evEbitda: 0.3,
    pe: 0.15,
    dcfMultiple: 0.15,
  },
  models: {
    dcf10Years: {
      scenarios: [
        {
          id: "optimistic",
          label: "Best",
          weight: 0.25,
          baseFreeCashFlow: 44841000,
          discountRate: 0.1,
          growthNextFiveYears: 0.2,
          growthYearsFiveToTen: 0.15,
          perpetualGrowth: 0.03,
          marginOfSafety: 0.1,
        },
        {
          id: "base",
          label: "Average",
          weight: 0.5,
          baseFreeCashFlow: 44841000,
          discountRate: 0.1,
          growthNextFiveYears: 0.15,
          growthYearsFiveToTen: 0.1,
          perpetualGrowth: 0.03,
          marginOfSafety: 0.1,
        },
        {
          id: "worst",
          label: "Worst",
          weight: 0.25,
          baseFreeCashFlow: 44841000,
          discountRate: 0.1,
          growthNextFiveYears: 0.1,
          growthYearsFiveToTen: 0.05,
          perpetualGrowth: 0.03,
          marginOfSafety: 0.1,
        },
      ],
    },
    evEbitda: {
      scenarios: [
        {
          id: "optimistic",
          label: "Best",
          weight: 0.25,
          baseEbitda: 98399000,
          discountRate: 0.1,
          growthNextFiveYears: 0.19,
          growthYearsFiveToTen: 0.14,
          terminalMultiple: 18,
          marginOfSafety: 0.1,
        },
        {
          id: "base",
          label: "Average",
          weight: 0.5,
          baseEbitda: 98399000,
          discountRate: 0.1,
          growthNextFiveYears: 0.15,
          growthYearsFiveToTen: 0.1,
          terminalMultiple: 14,
          marginOfSafety: 0.1,
        },
        {
          id: "worst",
          label: "Worst",
          weight: 0.25,
          baseEbitda: 98399000,
          discountRate: 0.1,
          growthNextFiveYears: 0.1,
          growthYearsFiveToTen: 0.05,
          terminalMultiple: 11,
          marginOfSafety: 0.1,
        },
      ],
    },
    pe: {
      scenarios: [
        {
          id: "optimistic",
          label: "Best",
          weight: 0.2,
          baseMetricPerShare: 24.61,
          discountRate: 0.1,
          growthNextFiveYears: 0.2,
          growthYearsFiveToTen: 0.15,
          terminalMultiple: 29,
          marginOfSafety: 0.1,
        },
        {
          id: "base",
          label: "Average",
          weight: 0.5,
          baseMetricPerShare: 24.61,
          discountRate: 0.1,
          growthNextFiveYears: 0.15,
          growthYearsFiveToTen: 0.1,
          terminalMultiple: 24,
          marginOfSafety: 0.1,
        },
        {
          id: "worst",
          label: "Worst",
          weight: 0.3,
          baseMetricPerShare: 24.61,
          discountRate: 0.1,
          growthNextFiveYears: 0.1,
          growthYearsFiveToTen: 0.05,
          terminalMultiple: 18,
          marginOfSafety: 0.1,
        },
      ],
    },
    dcfMultiple: {
      scenarios: [
        {
          id: "optimistic",
          label: "Best",
          weight: 0.25,
          baseMetricPerShare: 17,
          discountRate: 0.1,
          growthNextFiveYears: 0.2,
          growthYearsFiveToTen: 0.15,
          terminalMultiple: 31,
          marginOfSafety: 0.1,
        },
        {
          id: "base",
          label: "Average",
          weight: 0.5,
          baseMetricPerShare: 17,
          discountRate: 0.1,
          growthNextFiveYears: 0.15,
          growthYearsFiveToTen: 0.1,
          terminalMultiple: 28,
          marginOfSafety: 0.1,
        },
        {
          id: "worst",
          label: "Worst",
          weight: 0.25,
          baseMetricPerShare: 17,
          discountRate: 0.1,
          growthNextFiveYears: 0.1,
          growthYearsFiveToTen: 0.05,
          terminalMultiple: 24,
          marginOfSafety: 0.1,
        },
      ],
    },
  },
};

describe("stock valuation workbook parity", () => {
  test("matches the META Google Sheet model outputs", () => {
    const result = calculateStockValuation(metaWorkbookInput);

    expect(result.models.dcf10Years.weightedFairValue).toBeCloseTo(490.745646, 6);
    expect(result.models.evEbitda.weightedFairValue).toBeCloseTo(647.087251, 6);
    expect(result.models.pe.weightedFairValue).toBeCloseTo(670.708786, 6);
    expect(result.models.dcfMultiple.weightedFairValue).toBeCloseTo(557.433992, 6);
    expect(result.weightedFairValue).toBeCloseTo(574.645851, 6);
    expect(result.signal).toBe("SELL");
  });

  test("calculates DCF and EV/EBITDA market cap panels like the workbook", () => {
    const result = calculateStockValuation(metaWorkbookInput);

    expect(result.models.dcf10Years.marketCap?.scenarios[0].intrinsicMarketCap).toBeCloseTo(
      1_963_055_641,
      0,
    );
    expect(
      result.models.dcf10Years.marketCap?.scenarios[0].weightedIntrinsicMarketCap,
    ).toBeCloseTo(490_763_910.3, 1);
    expect(result.models.dcf10Years.marketCap?.averageIntrinsicMarketCap).toBeCloseTo(
      1_243_382_123,
      0,
    );
    expect(result.models.dcf10Years.marketCap?.underOverValuedPercent).toBeCloseTo(
      -0.1926090113,
      10,
    );
    expect(result.models.dcf10Years.marketCap?.signal).toBe("SELL");

    expect(result.models.evEbitda.marketCap?.averageIntrinsicMarketCap).toBeCloseTo(
      1_639_498_438,
      0,
    );
    expect(result.models.evEbitda.marketCap?.underOverValuedPercent).toBeCloseTo(
      0.06460937544,
      10,
    );
    expect(result.models.evEbitda.marketCap?.signal).toBe("SELL");
  });

  test("handles missing, zero, sourced, and derived market cap inputs", () => {
    const zeroMarketCapResult = calculateStockValuation({
      ...metaWorkbookInput,
      marketCap: 0,
    });

    expect(zeroMarketCapResult.models.dcf10Years.marketCap?.averageIntrinsicMarketCap).toBeNull();
    expect(zeroMarketCapResult.models.dcf10Years.marketCap?.underOverValuedPercent).toBeNull();
    expect(zeroMarketCapResult.models.dcf10Years.marketCap?.signal).toBe("NEUTRAL");

    const sourcedMarketCapInput = buildDefaultStockValuationInput({
      ticker: "MCAP",
      currentPrice: 10,
      sharesOutstanding: 100,
      fields: {
        marketCap: { value: 1_234, source: "Alpha Vantage" },
      },
    });
    expect(sourcedMarketCapInput.marketCap).toBe(1_234);

    const derivedMarketCapResult = calculateStockValuation(
      buildDefaultStockValuationInput({
        ticker: "DERIVED",
        currentPrice: 10,
        sharesOutstanding: 100,
      }),
    );
    expect(derivedMarketCapResult.models.dcf10Years.marketCap?.marketCap).toBe(1_000);
  });

  test("recalculates final fair value when model weights change", () => {
    const result = calculateStockValuation({
      ...metaWorkbookInput,
      finalWeights: {
        dcf10Years: 1,
        evEbitda: 0,
        pe: 0,
        dcfMultiple: 0,
      },
    });

    expect(result.weightedFairValue).toBeCloseTo(490.745646, 6);
  });

  test("keeps missing auto data editable instead of failing the full calculation", () => {
    const input = buildDefaultStockValuationInput({ ticker: "META" });
    input.currentPrice = null;
    input.sharesOutstanding = null;
    input.models.dcf10Years.scenarios[0].baseFreeCashFlow = null;

    const result = calculateStockValuation(input);

    expect(result.weightedFairValue).toBeNull();
    expect(result.missingFields).toContain("sharesOutstanding");
    expect(result.missingFields).toContain(
      "models.dcf10Years.scenarios.optimistic.baseFreeCashFlow",
    );
  });

  test("keeps workbook default multiples instead of overwriting scenarios with market multiples", () => {
    const input = buildDefaultStockValuationInput({
      ticker: "GOOG",
      currentPrice: 381.54,
      sharesOutstanding: 5_456_000_000,
      fields: {
        currentPrice: { value: 381.54, source: "Yahoo" },
        sharesOutstanding: { value: 5_456_000_000, source: "Alpha Vantage" },
        freeCashFlow: { value: 64_429_000_000, source: "SEC TTM", asOf: "TTM 2026-03-31" },
        ebitda: { value: 123_166_000_000, source: "Alpha Vantage" },
        eps: { value: 13.11, source: "SEC TTM", asOf: "TTM 2026-03-31" },
        peRatio: { value: 55.35, source: "Alpha Vantage" },
        evToEbitda: { value: 22.4, source: "Alpha Vantage" },
        priceToFreeCashFlow: { value: 32.3, source: "Derived" },
      },
    });

    expect(input.models.evEbitda.scenarios.map((scenario) => scenario.terminalMultiple)).toEqual([
      18,
      14,
      11,
    ]);
    expect(input.models.pe.scenarios.map((scenario) => scenario.terminalMultiple)).toEqual([
      29,
      24,
      18,
    ]);
    expect(input.models.dcfMultiple.scenarios.map((scenario) => scenario.terminalMultiple)).toEqual([
      31,
      28,
      24,
    ]);
    expect(input.models.dcf10Years.scenarios[0].baseFreeCashFlow).toBe(64_429_000_000);
    expect(input.models.dcfMultiple.scenarios[0].baseMetricPerShare).toBeCloseTo(
      64_429_000_000 / 5_456_000_000,
      6,
    );
  });

  test("calculates FCF per share TTM from DCF average FCF and shares outstanding", () => {
    const input = buildDefaultStockValuationInput({
      ticker: "GOOG",
      currentPrice: 381.54,
      sharesOutstanding: 5_456_000_000,
      fields: {
        freeCashFlow: { value: 64_429_000_000, source: "SEC TTM", asOf: "TTM 2026-03-31" },
        sharesOutstanding: { value: 5_456_000_000, source: "Alpha Vantage" },
      },
    });

    const calculation = calculateFcfPerShareTtm(input);

    expect(calculation.freeCashFlow).toBe(64_429_000_000);
    expect(calculation.sharesOutstanding).toBe(5_456_000_000);
    expect(calculation.fcfPerShare).toBeCloseTo(11.808834, 6);
  });

  test("returns null FCF per share TTM when FCF or shares are missing", () => {
    const missingShares = buildDefaultStockValuationInput({
      ticker: "GOOG",
      fields: {
        freeCashFlow: { value: 64_429_000_000, source: "SEC TTM" },
      },
    });
    const missingFcf = buildDefaultStockValuationInput({
      ticker: "GOOG",
      sharesOutstanding: 5_456_000_000,
    });

    expect(calculateFcfPerShareTtm(missingShares).fcfPerShare).toBeNull();
    expect(calculateFcfPerShareTtm(missingFcf).fcfPerShare).toBeNull();
  });

  test("uses the current DCF 10 years average FCF when assumptions change", () => {
    const input = buildDefaultStockValuationInput({
      ticker: "GOOG",
      sharesOutstanding: 5_456_000_000,
      fields: {
        freeCashFlow: { value: 64_429_000_000, source: "SEC TTM" },
        sharesOutstanding: { value: 5_456_000_000, source: "Alpha Vantage" },
      },
    });
    const averageScenario = input.models.dcf10Years.scenarios.find(
      (scenario) => scenario.id === "base",
    );

    if (!averageScenario) {
      throw new Error("Missing DCF average scenario");
    }

    averageScenario.baseFreeCashFlow = 70_000_000_000;

    expect(calculateFcfPerShareTtm(input).fcfPerShare).toBeCloseTo(
      70_000_000_000 / 5_456_000_000,
      6,
    );
  });

  test("calculates historical 10 year FCF average and YoY percentage like the workbook calculator", () => {
    const input = buildDefaultStockValuationInput({
      ticker: "TEST",
      historicalFreeCashFlows: screenshotHistoricalFcfRows,
    });

    const calculation = calculateHistoricalFcfAverage(input);

    expect(calculation.rows).toHaveLength(11);
    expect(calculation.rows[0]).toMatchObject({
      label: "Year 10",
      year: 2023,
      freeCashFlow: 4358,
      growthLabel: "Y9 to Y10",
    });
    expect(calculation.rows[10]).toMatchObject({
      label: "Year 0",
      year: 2013,
      freeCashFlow: 0.58,
      growthLabel: null,
      growthPercent: null,
    });
    expect(calculation.rows[0].growthPercent).toBeCloseTo(-0.487414726, 6);
    expect(calculation.rows[4].growthPercent).toBeCloseTo(360.333333, 6);
    expect(calculation.averageFreeCashFlow).toBeCloseTo(1131.034545, 6);
    expect(calculation.averageGrowthPercent).toBeCloseTo(-141.026244, 6);
    expect(calculation.isPartialHistory).toBe(false);
    expect(calculation.missingRows).toBe(0);
  });

  test("historical FCF calculation treats zero or missing previous years as needs input", () => {
    const input = buildDefaultStockValuationInput({
      ticker: "TEST",
      historicalFreeCashFlows: [
        { year: 2023, freeCashFlow: 100, source: "Manual" },
        { year: 2022, freeCashFlow: 0, source: "Manual" },
        { year: 2021, freeCashFlow: null, source: "Manual" },
      ],
    });

    const calculation = calculateHistoricalFcfAverage(input);

    expect(calculation.rows[0].growthPercent).toBeNull();
    expect(calculation.rows[1].growthPercent).toBeNull();
    expect(calculation.averageFreeCashFlow).toBe(50);
    expect(calculation.averageGrowthPercent).toBeNull();
    expect(calculation.isPartialHistory).toBe(true);
    expect(calculation.missingRows).toBe(9);
  });

  test("historical multiple summary shows raw rows but applies only positive usable multiples", () => {
    const input = buildDefaultStockValuationInput({
      ticker: "INTC",
      fields: {
        priceToFreeCashFlow: { value: -17.21, source: "Derived" },
      },
    });
    input.historicalMultiples = {
      priceToFreeCashFlow: historicalPriceToFcfRows,
    };

    const summary = calculateHistoricalMultipleSummary(input, "priceToFreeCashFlow");

    expect(summary.rows).toHaveLength(4);
    expect(summary.rows[0]).toMatchObject({
      year: 2025,
      multiple: -20,
      usableForApply: false,
      ignoredReason: "negative-or-zero",
    });
    expect(summary.currentMultiple).toBe(-17.21);
    expect(summary.low).toBe(8);
    expect(summary.average).toBeCloseTo(17.666667, 6);
    expect(summary.high).toBe(30);
    expect(summary.applyValues).toEqual({
      optimistic: 30,
      base: expect.closeTo(17.666667, 6),
      worst: 8,
    });
    expect(summary.canApply).toBe(true);
  });

  test("historical multiple summary keeps up to 20 years and calculates period averages", () => {
    const rows = Array.from({ length: 22 }, (_, index): HistoricalMultipleRow => {
      const year = 2025 - index;
      const multiple = index + 1;

      return {
        year,
        numerator: multiple * 10,
        denominator: 10,
        multiple,
        source: "Derived",
        asOf: `${year}-12-31`,
      };
    });
    const input = buildDefaultStockValuationInput({
      ticker: "LONG",
      historicalMultiples: {
        evToEbitda: rows,
      },
    });

    const summary = calculateHistoricalMultipleSummary(input, "evToEbitda");

    expect(summary.rows).toHaveLength(20);
    expect(summary.rows.at(0)?.year).toBe(2025);
    expect(summary.rows.at(-1)?.year).toBe(2006);
    expect(summary.periodAverages).toEqual([
      { key: "TTM", label: "TTM", years: 1, average: 1, count: 1 },
      { key: "3Y", label: "3Y", years: 3, average: 2, count: 3 },
      { key: "5Y", label: "5Y", years: 5, average: 3, count: 5 },
      { key: "10Y", label: "10Y", years: 10, average: 5.5, count: 10 },
      { key: "15Y", label: "15Y", years: 15, average: 8, count: 15 },
      { key: "20Y", label: "20Y", years: 20, average: 10.5, count: 20 },
    ]);
  });

  test("historical multiple summary builds yearly editable rows from monthly series", () => {
    const seriesPoints: HistoricalMultipleSeriesPoint[] = [
      {
        date: "2024-01-31",
        year: 2024,
        numerator: 2_000,
        denominator: 100,
        multiple: 20,
        source: "Derived",
        asOf: "2023-12-31",
        needsReview: true,
        reviewReason: "Annual fundamentals are carried forward for this month.",
      },
      {
        date: "2024-02-29",
        year: 2024,
        numerator: 1_600,
        denominator: 100,
        multiple: 16,
        source: "Derived",
        asOf: "2023-12-31",
        needsReview: true,
        reviewReason: "Annual fundamentals are carried forward for this month.",
      },
      {
        date: "2024-03-31",
        year: 2024,
        numerator: 1_400,
        denominator: 100,
        multiple: 14,
        source: "Derived",
        asOf: "2023-12-31",
      },
      {
        date: "2024-04-30",
        year: 2024,
        numerator: 1_200,
        denominator: 0,
        multiple: null,
        source: "Derived",
        asOf: "2023-12-31",
      },
      {
        date: "2023-12-31",
        year: 2023,
        numerator: 1_000,
        denominator: 100,
        multiple: 10,
        source: "Derived",
        asOf: "2022-12-31",
      },
    ];
    const input = buildDefaultStockValuationInput({
      ticker: "META",
      fields: {
        evToEbitda: { value: 13.93, source: "Derived" },
      },
      historicalMultipleSeries: {
        evToEbitda: seriesPoints,
      },
    });

    const summary = calculateHistoricalMultipleSummary(input, "evToEbitda");

    expect(summary.seriesPoints).toHaveLength(5);
    expect(summary.rows).toHaveLength(2);
    expect(summary.rows[0]).toMatchObject({
      year: 2024,
      numerator: 1_400,
      denominator: 100,
      multiple: 14,
      usableForApply: true,
    });
    expect(summary.rows[1]).toMatchObject({
      year: 2023,
      numerator: 1_000,
      denominator: 100,
      multiple: 10,
      usableForApply: true,
    });
    expect(summary.low).toBe(10);
    expect(summary.average).toBe(12);
    expect(summary.high).toBe(14);
    expect(summary.canApply).toBe(true);
    expect(summary.applyValues).toEqual({
      optimistic: 14,
      base: 12,
      worst: 10,
    });
    expect(summary.periodAverages.find((period) => period.key === "TTM")).toMatchObject({
      average: expect.closeTo(15, 6),
      count: 4,
    });
  });

  test("historical multiple summary prefers available FinanceCharts benchmark data", () => {
    const financeChartsBenchmark: HistoricalMultipleBenchmark = {
      source: "FinanceCharts",
      sourceStatus: "available",
      currentMultiple: 8.21,
      low: 7.22,
      average: 13.11,
      high: 19.71,
      periodAverages: [
        { key: "TTM", label: "TTM", years: 1, average: 7.22, count: 1 },
        { key: "3Y", label: "3Y", years: 3, average: 12, count: 1 },
        { key: "5Y", label: "5Y", years: 5, average: 13.3, count: 1 },
        { key: "10Y", label: "10Y", years: 10, average: 13.11, count: 1 },
        { key: "15Y", label: "15Y", years: 15, average: 13.3, count: 1 },
        { key: "20Y", label: "20Y", years: 20, average: 12.45, count: 1 },
      ],
      seriesPoints: [
        {
          date: "2022-04-22",
          year: 2022,
          numerator: null,
          denominator: null,
          multiple: 19.71,
          source: "FinanceCharts",
          asOf: "2022-04-22",
        },
      ],
    };
    const input = buildDefaultStockValuationInput({
      ticker: "NVO",
      fields: {
        evToEbitda: { value: 2.9, source: "Derived" },
      },
      historicalMultipleSeries: {
        evToEbitda: [
          {
            date: "2024-01-31",
            year: 2024,
            numerator: 2_000,
            denominator: 1_000,
            multiple: 2,
            source: "Derived",
            asOf: "2023-12-31",
          },
        ],
      },
      historicalMultipleBenchmarks: {
        evToEbitda: financeChartsBenchmark,
      },
    });

    const summary = calculateHistoricalMultipleSummary(input, "evToEbitda");

    expect(summary.source).toBe("FinanceCharts");
    expect(summary.sourceStatus).toBe("available");
    expect(summary.currentMultiple).toBe(8.21);
    expect(summary.average).toBe(13.11);
    expect(summary.high).toBe(19.71);
    expect(summary.periodAverages.find((period) => period.key === "10Y")?.average).toBe(13.11);
    expect(summary.seriesPoints).toEqual(financeChartsBenchmark.seriesPoints);
    expect(summary.applyValues).toEqual({
      optimistic: 19.71,
      base: 13.11,
      worst: 7.22,
    });
  });

  test("historical multiple summary disables apply when no positive rows exist", () => {
    const input = buildDefaultStockValuationInput({ ticker: "LOSS" });
    input.historicalMultiples = {
      peRatio: [
        {
          year: 2025,
          numerator: 12,
          denominator: -1,
          multiple: -12,
          source: "Yahoo",
          asOf: "2025-12-31",
        },
        {
          year: 2024,
          numerator: 10,
          denominator: 0,
          multiple: null,
          source: "Yahoo",
          asOf: "2024-12-31",
        },
      ],
    };

    const summary = calculateHistoricalMultipleSummary(input, "peRatio");

    expect(summary.rows.map((row) => row.usableForApply)).toEqual([false, false]);
    expect(summary.low).toBeNull();
    expect(summary.average).toBeNull();
    expect(summary.high).toBeNull();
    expect(summary.applyValues).toBeNull();
    expect(summary.canApply).toBe(false);
  });

  test("historical multiple summary marks currency or ADR uncertain rows as needs review", () => {
    const input = buildDefaultStockValuationInput({ ticker: "NVO" });
    input.historicalMultiples = {
      peRatio: [
        {
          year: 2025,
          numerator: 45.8,
          denominator: 23.03,
          multiple: 1.99,
          source: "SEC IFRS",
          asOf: "2025-12-31",
          needsReview: true,
          reviewReason: "Price is USD ADR, denominator is DKK ordinary-share data.",
        },
        {
          year: 2024,
          numerator: 40,
          denominator: 4,
          multiple: 10,
          source: "Derived",
          asOf: "2024-12-31",
        },
      ],
    };

    const summary = calculateHistoricalMultipleSummary(input, "peRatio");

    expect(summary.rows[0].usableForApply).toBe(false);
    expect(summary.rows[0].ignoredReason).toBe("needs-review");
    expect(summary.rows[1].usableForApply).toBe(true);
    expect(summary.average).toBe(10);
    expect(summary.applyValues).toEqual({
      optimistic: 10,
      base: 10,
      worst: 10,
    });
  });
});
