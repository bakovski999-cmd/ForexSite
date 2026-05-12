import { describe, expect, test } from "vitest";

import {
  buildDefaultStockValuationInput,
  calculateStockValuation,
  type StockValuationInput,
} from "@/lib/stock-valuation";

const metaWorkbookInput: StockValuationInput = {
  ticker: "META",
  companyName: "Meta Platforms",
  currency: "USD",
  currentPrice: 609,
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
});
