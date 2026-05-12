import { describe, expect, test } from "vitest";

import {
  extractMacrotrendsOriginalData,
  mapAlphaVantageOverview,
  mapMacrotrendsCashFlow,
  mapSecCompanyFacts,
  mapYahooChartQuote,
} from "@/lib/stock-valuation-autofill";

describe("stock valuation autofill parsers", () => {
  test("extracts Macrotrends originalData and maps free cash flow in dollars", () => {
    const html = `
      <script>
        var originalData = [
          {"field_name":"<a>Cash Flow From Operating Activities</a>","2024":"91328","2023":"71113"},
          {"field_name":"Net Change In Property, Plant, And Equipment","2024":"-25606","2023":"-27266"}
        ];
      </script>
    `;

    const rows = extractMacrotrendsOriginalData(html);
    const mapped = mapMacrotrendsCashFlow(rows);

    expect(rows).toHaveLength(2);
    expect(mapped.operatingCashFlow?.value).toBe(91_328_000_000);
    expect(mapped.capitalExpenditures?.value).toBe(-25_606_000_000);
    expect(mapped.freeCashFlow?.value).toBe(65_722_000_000);
    expect(mapped.freeCashFlow?.source).toBe("Macrotrends");
  });

  test("maps Yahoo chart JSON to current price only", () => {
    const mapped = mapYahooChartQuote({
      chart: {
        result: [
          {
            meta: {
              currency: "USD",
              longName: "Meta Platforms, Inc.",
              regularMarketPrice: 609.35,
              symbol: "META",
            },
          },
        ],
      },
    });

    expect(mapped.currentPrice?.value).toBe(609.35);
    expect(mapped.currentPrice?.source).toBe("Yahoo");
    expect(mapped.companyName?.value).toBe("Meta Platforms, Inc.");
    expect(mapped.financialStatements).toBeUndefined();
  });

  test("normalizes Alpha Vantage overview valuation fields", () => {
    const mapped = mapAlphaVantageOverview({
      Symbol: "META",
      Name: "Meta Platforms Inc.",
      MarketCapitalization: "1540000000000",
      EBITDA: "98399000000",
      EPS: "24.61",
      PERatio: "24.75",
      EVToEBITDA: "16.2",
      SharesOutstanding: "2533659000",
    });

    expect(mapped.companyName?.value).toBe("Meta Platforms Inc.");
    expect(mapped.marketCap?.value).toBe(1_540_000_000_000);
    expect(mapped.ebitda?.value).toBe(98_399_000_000);
    expect(mapped.eps?.value).toBe(24.61);
    expect(mapped.peRatio?.value).toBe(24.75);
    expect(mapped.evToEbitda?.value).toBe(16.2);
    expect(mapped.sharesOutstanding?.value).toBe(2_533_659_000);
  });

  test("normalizes SEC CompanyFacts key fields", () => {
    const mapped = mapSecCompanyFacts({
      cik: 1326801,
      entityName: "Meta Platforms, Inc.",
      facts: {
        "us-gaap": {
          NetCashProvidedByUsedInOperatingActivities: {
            units: {
              USD: [
                { end: "2024-12-31", fy: 2024, fp: "FY", form: "10-K", val: 91_328_000_000 },
              ],
            },
          },
          PaymentsToAcquirePropertyPlantAndEquipment: {
            units: {
              USD: [
                { end: "2024-12-31", fy: 2024, fp: "FY", form: "10-K", val: 25_606_000_000 },
              ],
            },
          },
          EarningsPerShareDiluted: {
            units: {
              "USD/shares": [
                { end: "2024-12-31", fy: 2024, fp: "FY", form: "10-K", val: 24.61 },
              ],
            },
          },
          EntityCommonStockSharesOutstanding: {
            units: {
              shares: [
                {
                  end: "2024-12-31",
                  fy: 2024,
                  fp: "FY",
                  form: "10-K",
                  val: 2_533_659_000,
                },
              ],
            },
          },
        },
      },
    });

    expect(mapped.companyName?.value).toBe("Meta Platforms, Inc.");
    expect(mapped.operatingCashFlow?.value).toBe(91_328_000_000);
    expect(mapped.capitalExpenditures?.value).toBe(25_606_000_000);
    expect(mapped.freeCashFlow?.value).toBe(65_722_000_000);
    expect(mapped.eps?.value).toBe(24.61);
    expect(mapped.sharesOutstanding?.value).toBe(2_533_659_000);
  });
});
