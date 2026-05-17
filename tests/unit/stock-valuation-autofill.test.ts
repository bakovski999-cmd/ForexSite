import { afterEach, describe, expect, test, vi } from "vitest";

import {
  extractMacrotrendsOriginalData,
  fetchValuationAutofill,
  mapIbkrSnapshot,
  mapAlphaVantageOverview,
  mapMacrotrendsCashFlow,
  mapSecCompanyFacts,
  mapYahooChartQuote,
  mapYahooFundamentalsTimeseries,
  mapYahooHistoricalPrices,
} from "@/lib/stock-valuation-autofill";

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    expect(mapped.historicalFreeCashFlows).toEqual([
      { year: 2024, freeCashFlow: 65_722_000_000, source: "Macrotrends", asOf: "2024-12-31" },
      { year: 2023, freeCashFlow: 43_847_000_000, source: "Macrotrends", asOf: "2023-12-31" },
    ]);
  });

  test("maps Macrotrends date-key annual rows into 11 historical FCF rows", () => {
    const rows = [
      {
        field_name: "Cash Flow From Operating Activities",
        ...Object.fromEntries(
          Array.from({ length: 11 }, (_, index) => {
            const year = 2025 - index;

            return [`${year}-12-31`, String(18_000 - index * 1_000)];
          }),
        ),
      },
      {
        field_name: "Net Change In Property, Plant, And Equipment",
        ...Object.fromEntries(
          Array.from({ length: 11 }, (_, index) => {
            const year = 2025 - index;

            return [`${year}-12-31`, String(-9_000 + index * 100)];
          }),
        ),
      },
    ];

    const mapped = mapMacrotrendsCashFlow(rows);

    expect(mapped.historicalFreeCashFlows).toHaveLength(11);
    expect(mapped.historicalFreeCashFlows?.[0]).toEqual({
      year: 2025,
      freeCashFlow: 9_000_000_000,
      source: "Macrotrends",
      asOf: "2025-12-31",
    });
    expect(mapped.freeCashFlow?.value).toBe(9_000_000_000);
    expect(mapped.freeCashFlow?.asOf).toBe("2025-12-31");
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

  test("maps Yahoo chart JSON to historical year-end prices", () => {
    const mapped = mapYahooHistoricalPrices({
      chart: {
        result: [
          {
            timestamp: [
              Math.floor(Date.parse("2024-12-30T00:00:00.000Z") / 1000),
              Math.floor(Date.parse("2024-12-31T00:00:00.000Z") / 1000),
              Math.floor(Date.parse("2025-12-31T00:00:00.000Z") / 1000),
            ],
            indicators: {
              quote: [
                {
                  close: [29, 30, 40],
                },
              ],
            },
          },
        ],
      },
    });

    expect(mapped).toEqual([
      { date: "2024-12-30", close: 29, source: "Yahoo" },
      { date: "2024-12-31", close: 30, source: "Yahoo" },
      { date: "2025-12-31", close: 40, source: "Yahoo" },
    ]);
  });

  test("maps Yahoo fundamentals timeseries to latest TTM valuation metrics", () => {
    const mapped = mapYahooFundamentalsTimeseries({
      timeseries: {
        result: [
          {
            meta: { symbol: ["NVO"], type: ["trailingFreeCashFlow"] },
            trailingFreeCashFlow: [
              {
                asOfDate: "2026-03-31",
                periodType: "TTM",
                currencyCode: "DKK",
                reportedValue: { raw: 30_890_000_000 },
              },
            ],
          },
          {
            meta: { symbol: ["NVO"], type: ["trailingEBITDA"] },
            trailingEBITDA: [
              {
                asOfDate: "2026-03-31",
                periodType: "TTM",
                currencyCode: "DKK",
                reportedValue: { raw: 179_890_000_000 },
              },
            ],
          },
          {
            meta: { symbol: ["NVO"], type: ["trailingDilutedEPS"] },
            trailingDilutedEPS: [
              {
                asOfDate: "2026-03-31",
                periodType: "TTM",
                currencyCode: "DKK",
                reportedValue: { raw: 27.41 },
              },
            ],
          },
          {
            meta: { symbol: ["NVO"], type: ["trailingDilutedAverageShares"] },
            trailingDilutedAverageShares: [
              {
                asOfDate: "2026-03-31",
                periodType: "TTM",
                currencyCode: "DKK",
                reportedValue: { raw: 4_443_773_479 },
              },
            ],
          },
        ],
      },
    });

    expect(mapped.fields.freeCashFlow).toEqual({
      value: 30_890_000_000,
      source: "Yahoo TTM",
      asOf: "TTM 2026-03-31",
    });
    expect(mapped.fields.ebitda?.value).toBe(179_890_000_000);
    expect(mapped.fields.eps?.value).toBe(27.41);
    expect(mapped.fields.sharesOutstanding).toEqual({
      value: 4_443_773_479,
      source: "Yahoo TTM",
      asOf: "TTM 2026-03-31",
    });
    expect(mapped.currency).toBe("DKK");
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

  test("normalizes SEC IFRS CompanyFacts key fields and historical rows", () => {
    const mapped = mapSecCompanyFacts({
      cik: 353278,
      entityName: "Novo Nordisk A/S",
      facts: {
        "ifrs-full": {
          CashFlowsFromUsedInOperatingActivities: {
            units: {
              DKK: [
                { start: "2025-01-01", end: "2025-12-31", fy: 2025, fp: "FY", form: "20-F", val: 119_102_000_000 },
                { start: "2024-01-01", end: "2024-12-31", fy: 2024, fp: "FY", form: "20-F", val: 120_968_000_000 },
              ],
            },
          },
          PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities: {
            units: {
              DKK: [
                { start: "2025-01-01", end: "2025-12-31", fy: 2025, fp: "FY", form: "20-F", val: 60_140_000_000 },
                { start: "2024-01-01", end: "2024-12-31", fy: 2024, fp: "FY", form: "20-F", val: 47_164_000_000 },
              ],
            },
          },
          DilutedEarningsLossPerShare: {
            units: {
              "DKK/shares": [
                { start: "2025-01-01", end: "2025-12-31", fy: 2025, fp: "FY", form: "20-F", val: 23.03 },
              ],
            },
          },
          NumberOfSharesOutstanding: {
            units: {
              shares: [
                { end: "2025-12-31", fy: 2025, fp: "FY", form: "20-F", val: 4_444_000_000 },
              ],
            },
          },
          ProfitLossFromOperatingActivities: {
            units: {
              DKK: [
                { start: "2025-01-01", end: "2025-12-31", fy: 2025, fp: "FY", form: "20-F", val: 127_658_000_000 },
              ],
            },
          },
          DepreciationAmortisationAndImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss: {
            units: {
              DKK: [
                { start: "2025-01-01", end: "2025-12-31", fy: 2025, fp: "FY", form: "20-F", val: 21_982_000_000 },
              ],
            },
          },
          CashAndCashEquivalents: {
            units: {
              DKK: [
                { end: "2025-12-31", fy: 2025, fp: "FY", form: "20-F", val: 26_464_000_000 },
              ],
            },
          },
          BondsIssuedUndiscountedCashFlows: {
            units: {
              DKK: [
                { end: "2025-12-31", fy: 2025, fp: "FY", form: "20-F", val: 145_041_000_000 },
              ],
            },
          },
        },
      },
    });

    expect(mapped.companyName?.value).toBe("Novo Nordisk A/S");
    expect(mapped.operatingCashFlow?.value).toBe(119_102_000_000);
    expect(mapped.operatingCashFlow?.source).toBe("SEC IFRS");
    expect(mapped.capitalExpenditures?.value).toBe(60_140_000_000);
    expect(mapped.freeCashFlow?.value).toBe(58_962_000_000);
    expect(mapped.freeCashFlow?.source).toBe("SEC IFRS");
    expect(mapped.eps?.value).toBe(23.03);
    expect(mapped.sharesOutstanding?.value).toBe(4_444_000_000);
    expect(mapped.ebitda?.value).toBe(149_640_000_000);
    expect(mapped.historicalFreeCashFlows).toEqual([
      { year: 2025, freeCashFlow: 58_962_000_000, source: "SEC IFRS", asOf: "FY 2025" },
      { year: 2024, freeCashFlow: 73_804_000_000, source: "SEC IFRS", asOf: "FY 2024" },
    ]);
  });

  test("maps IBKR snapshot values without requiring IBKR to be enabled", () => {
    const mapped = mapIbkrSnapshot({
      symbol: "NVO",
      companyName: "Novo Nordisk A/S",
      currency: "USD",
      lastPrice: 45.8,
      marketCap: 205_415_203_000,
      sharesOutstanding: 3_357_979_000,
      eps: 4.32,
      peRatio: 10.73,
    });

    expect(mapped.companyName?.source).toBe("IBKR");
    expect(mapped.currentPrice?.value).toBe(45.8);
    expect(mapped.marketCap?.source).toBe("IBKR");
    expect(mapped.eps?.value).toBe(4.32);
  });

  test("normalizes SEC annual cash-flow facts into 11 historical FCF rows", () => {
    const operatingCashFlow = Array.from({ length: 11 }, (_, index) => {
      const year = 2013 + index;

      return {
        start: `${year}-01-01`,
        end: `${year}-12-31`,
        fy: year,
        fp: "FY",
        form: "10-K",
        val: (100 + index) * 1_000_000,
      };
    });
    const capitalExpenditures = Array.from({ length: 11 }, (_, index) => {
      const year = 2013 + index;

      return {
        start: `${year}-01-01`,
        end: `${year}-12-31`,
        fy: year,
        fp: "FY",
        form: "10-K",
        val: (10 + index) * 1_000_000,
      };
    });

    const mapped = mapSecCompanyFacts({
      cik: 123,
      entityName: "History Corp",
      facts: {
        "us-gaap": {
          NetCashProvidedByUsedInOperatingActivities: {
            units: { USD: operatingCashFlow },
          },
          PaymentsToAcquirePropertyPlantAndEquipment: {
            units: { USD: capitalExpenditures },
          },
        },
      },
    });

    expect(mapped.historicalFreeCashFlows).toHaveLength(11);
    expect(mapped.historicalFreeCashFlows?.[0]).toEqual({
      year: 2023,
      freeCashFlow: 90_000_000,
      source: "SEC FY",
      asOf: "FY 2023",
    });
    expect(mapped.historicalFreeCashFlows?.[10]).toEqual({
      year: 2013,
      freeCashFlow: 90_000_000,
      source: "SEC FY",
      asOf: "FY 2013",
    });
  });

  test("normalizes SEC cash-flow facts to TTM instead of using the latest standalone quarter", () => {
    const mapped = mapSecCompanyFacts({
      cik: 1652044,
      entityName: "Alphabet Inc.",
      facts: {
        "us-gaap": {
          NetCashProvidedByUsedInOperatingActivities: {
            units: {
              USD: [
                {
                  start: "2026-01-01",
                  end: "2026-03-31",
                  fy: 2026,
                  fp: "Q1",
                  form: "10-Q",
                  val: 45_790_000_000,
                },
                {
                  start: "2025-01-01",
                  end: "2025-12-31",
                  fy: 2025,
                  fp: "FY",
                  form: "10-K",
                  val: 164_713_000_000,
                },
                {
                  start: "2025-01-01",
                  end: "2025-03-31",
                  fy: 2025,
                  fp: "Q1",
                  form: "10-Q",
                  val: 36_150_000_000,
                },
              ],
            },
          },
          PaymentsToAcquirePropertyPlantAndEquipment: {
            units: {
              USD: [
                {
                  start: "2026-01-01",
                  end: "2026-03-31",
                  fy: 2026,
                  fp: "Q1",
                  form: "10-Q",
                  val: 35_674_000_000,
                },
                {
                  start: "2025-01-01",
                  end: "2025-12-31",
                  fy: 2025,
                  fp: "FY",
                  form: "10-K",
                  val: 91_447_000_000,
                },
                {
                  start: "2025-01-01",
                  end: "2025-03-31",
                  fy: 2025,
                  fp: "Q1",
                  form: "10-Q",
                  val: 17_197_000_000,
                },
              ],
            },
          },
          EarningsPerShareDiluted: {
            units: {
              "USD/shares": [
                { start: "2026-01-01", end: "2026-03-31", fy: 2026, fp: "Q1", form: "10-Q", val: 5.11 },
                { start: "2025-01-01", end: "2025-12-31", fy: 2025, fp: "FY", form: "10-K", val: 10.81 },
                { start: "2025-01-01", end: "2025-03-31", fy: 2025, fp: "Q1", form: "10-Q", val: 2.81 },
              ],
            },
          },
        },
      },
    });

    expect(mapped.operatingCashFlow?.value).toBe(174_353_000_000);
    expect(mapped.capitalExpenditures?.value).toBe(109_924_000_000);
    expect(mapped.freeCashFlow?.value).toBe(64_429_000_000);
    expect(mapped.eps?.value).toBeCloseTo(13.11, 6);
    expect(mapped.freeCashFlow?.source).toBe("SEC TTM");
    expect(mapped.freeCashFlow?.asOf).toBe("TTM 2026-03-31");
  });

  test("falls back to latest SEC FY facts when TTM cannot be constructed", () => {
    const mapped = mapSecCompanyFacts({
      cik: 1652044,
      entityName: "Alphabet Inc.",
      facts: {
        "us-gaap": {
          NetCashProvidedByUsedInOperatingActivities: {
            units: {
              USD: [
                { end: "2026-03-31", fy: 2026, fp: "Q1", form: "10-Q", val: 45_790_000_000 },
                { end: "2025-12-31", fy: 2025, fp: "FY", form: "10-K", val: 164_713_000_000 },
              ],
            },
          },
          PaymentsToAcquirePropertyPlantAndEquipment: {
            units: {
              USD: [
                { end: "2026-03-31", fy: 2026, fp: "Q1", form: "10-Q", val: 35_674_000_000 },
                { end: "2025-12-31", fy: 2025, fp: "FY", form: "10-K", val: 91_447_000_000 },
              ],
            },
          },
        },
      },
    });

    expect(mapped.freeCashFlow?.value).toBe(73_266_000_000);
    expect(mapped.freeCashFlow?.source).toBe("SEC FY");
    expect(mapped.freeCashFlow?.asOf).toBe("FY 2025");
  });

  test("fetches GOOG autofill with normalized SEC TTM metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("query1.finance.yahoo.com")) {
          return {
            ok: true,
            json: async () => ({
              chart: {
                result: [
                  {
                    meta: {
                      currency: "USD",
                      longName: "Alphabet Inc.",
                      regularMarketPrice: 381.54,
                    },
                  },
                ],
              },
            }),
          };
        }

        if (url.endsWith("/company_tickers.json")) {
          return {
            ok: true,
            json: async () => ({
              "0": { cik_str: 1652044, ticker: "GOOG", title: "Alphabet Inc." },
            }),
          };
        }

        if (url.includes("/api/xbrl/companyfacts/CIK0001652044.json")) {
          return {
            ok: true,
            json: async () => ({
              cik: 1652044,
              entityName: "Alphabet Inc.",
              facts: {
                "us-gaap": {
                  NetCashProvidedByUsedInOperatingActivities: {
                    units: {
                      USD: [
                        { start: "2026-01-01", end: "2026-03-31", fy: 2026, fp: "Q1", form: "10-Q", val: 45_790_000_000 },
                        { start: "2025-01-01", end: "2025-12-31", fy: 2025, fp: "FY", form: "10-K", val: 164_713_000_000 },
                        { start: "2025-01-01", end: "2025-03-31", fy: 2025, fp: "Q1", form: "10-Q", val: 36_150_000_000 },
                      ],
                    },
                  },
                  PaymentsToAcquirePropertyPlantAndEquipment: {
                    units: {
                      USD: [
                        { start: "2026-01-01", end: "2026-03-31", fy: 2026, fp: "Q1", form: "10-Q", val: 35_674_000_000 },
                        { start: "2025-01-01", end: "2025-12-31", fy: 2025, fp: "FY", form: "10-K", val: 91_447_000_000 },
                        { start: "2025-01-01", end: "2025-03-31", fy: 2025, fp: "Q1", form: "10-Q", val: 17_197_000_000 },
                      ],
                    },
                  },
                  EarningsPerShareDiluted: {
                    units: {
                      "USD/shares": [
                        { start: "2026-01-01", end: "2026-03-31", fy: 2026, fp: "Q1", form: "10-Q", val: 5.11 },
                        { start: "2025-01-01", end: "2025-12-31", fy: 2025, fp: "FY", form: "10-K", val: 10.81 },
                        { start: "2025-01-01", end: "2025-03-31", fy: 2025, fp: "Q1", form: "10-Q", val: 2.81 },
                      ],
                    },
                  },
                  EntityCommonStockSharesOutstanding: {
                    units: {
                      shares: [
                        { end: "2026-03-31", fy: 2026, fp: "Q1", form: "10-Q", val: 5_456_000_000 },
                      ],
                    },
                  },
                },
              },
            }),
          };
        }

        if (url.includes("macrotrends.net")) {
          return {
            ok: true,
            text: async () => "<script>var originalData = [];</script>",
          };
        }

        throw new Error(`Unexpected fetch ${url}`);
      }),
    );

    const result = await fetchValuationAutofill("GOOG");

    expect(result.ok).toBe(true);
    expect(result.fields.freeCashFlow?.value).toBe(64_429_000_000);
    expect(result.fields.freeCashFlow?.source).toBe("SEC TTM");
    expect(result.input.ticker).toBe("GOOG");
    expect(result.input.companyName).toBe("Alphabet Inc.");
    expect(result.input.models.dcf10Years.scenarios[0].baseFreeCashFlow).toBe(64_429_000_000);
    expect(result.input.models.dcfMultiple.scenarios[0].baseMetricPerShare).toBeCloseTo(
      64_429_000_000 / 5_456_000_000,
      6,
    );
    expect(result.input.models.pe.scenarios[0].terminalMultiple).toBe(29);
    expect(result.input.historicalFreeCashFlows).toEqual([
      { year: 2025, freeCashFlow: 73_266_000_000, source: "SEC FY", asOf: "FY 2025" },
    ]);
    expect(result.warnings).toEqual([
      "Historical free cash flow history is partial; fill missing years manually.",
    ]);
  });

  test("fetches NVO autofill with Yahoo TTM metrics converted to quote currency", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("DKKUSD")) {
          return {
            ok: true,
            json: async () => ({
              chart: {
                result: [
                  {
                    meta: {
                      currency: "USD",
                      regularMarketPrice: 0.1556,
                    },
                  },
                ],
              },
            }),
          };
        }

        if (url.includes("fundamentals-timeseries")) {
          return {
            ok: true,
            json: async () => ({
              timeseries: {
                result: [
                  {
                    meta: { symbol: ["NVO"], type: ["trailingFreeCashFlow"] },
                    trailingFreeCashFlow: [
                      {
                        asOfDate: "2026-03-31",
                        periodType: "TTM",
                        currencyCode: "DKK",
                        reportedValue: { raw: 30_890_000_000 },
                      },
                    ],
                  },
                  {
                    meta: { symbol: ["NVO"], type: ["trailingEBITDA"] },
                    trailingEBITDA: [
                      {
                        asOfDate: "2026-03-31",
                        periodType: "TTM",
                        currencyCode: "DKK",
                        reportedValue: { raw: 179_890_000_000 },
                      },
                    ],
                  },
                  {
                    meta: { symbol: ["NVO"], type: ["trailingDilutedEPS"] },
                    trailingDilutedEPS: [
                      {
                        asOfDate: "2026-03-31",
                        periodType: "TTM",
                        currencyCode: "DKK",
                        reportedValue: { raw: 27.41 },
                      },
                    ],
                  },
                  {
                    meta: { symbol: ["NVO"], type: ["trailingDilutedAverageShares"] },
                    trailingDilutedAverageShares: [
                      {
                        asOfDate: "2026-03-31",
                        periodType: "TTM",
                        currencyCode: "DKK",
                        reportedValue: { raw: 4_443_773_479 },
                      },
                    ],
                  },
                ],
              },
            }),
          };
        }

        if (url.includes("query1.finance.yahoo.com") && url.includes("range=1d")) {
          return {
            ok: true,
            json: async () => ({
              chart: {
                result: [
                  {
                    meta: {
                      currency: "USD",
                      longName: "Novo Nordisk A/S",
                      regularMarketPrice: 45.8,
                    },
                  },
                ],
              },
            }),
          };
        }

        if (url.includes("query1.finance.yahoo.com") && url.includes("interval=1mo")) {
          return {
            ok: true,
            json: async () => ({
              chart: { result: [{ timestamp: [], indicators: { quote: [{ close: [] }] } }] },
            }),
          };
        }

        if (url.includes("alphavantage.co")) {
          return {
            ok: true,
            json: async () => ({
              Name: "Novo Nordisk A/S",
              Currency: "USD",
              MarketCapitalization: "205415203000",
              EBITDA: "173876003000",
              EPS: "4.32",
              PERatio: "10.73",
              EVToEBITDA: "7.85",
              SharesOutstanding: "3357979000",
            }),
          };
        }

        if (url.endsWith("/company_tickers.json")) {
          return {
            ok: true,
            json: async () => ({
              "0": { cik_str: 353278, ticker: "NVO", title: "NOVO NORDISK A S" },
            }),
          };
        }

        if (url.includes("/api/xbrl/companyfacts/CIK0000353278.json")) {
          return {
            ok: true,
            json: async () => ({
              cik: 353278,
              entityName: "Novo Nordisk A/S",
              facts: {
                "ifrs-full": {
                  CashFlowsFromUsedInOperatingActivities: {
                    units: {
                      DKK: [
                        { start: "2025-01-01", end: "2025-12-31", fy: 2025, fp: "FY", form: "20-F", val: 119_102_000_000 },
                      ],
                    },
                  },
                  PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities: {
                    units: {
                      DKK: [
                        { start: "2025-01-01", end: "2025-12-31", fy: 2025, fp: "FY", form: "20-F", val: 60_140_000_000 },
                      ],
                    },
                  },
                  DilutedEarningsLossPerShare: {
                    units: {
                      "DKK/shares": [
                        { start: "2025-01-01", end: "2025-12-31", fy: 2025, fp: "FY", form: "20-F", val: 23.03 },
                      ],
                    },
                  },
                  NumberOfSharesOutstanding: {
                    units: {
                      shares: [
                        { end: "2025-12-31", fy: 2025, fp: "FY", form: "20-F", val: 4_444_000_000 },
                      ],
                    },
                  },
                },
              },
            }),
          };
        }

        if (url.includes("macrotrends.net")) {
          return {
            ok: true,
            text: async () => `
              <script>
                var originalData = [
                  {"field_name":"Cash Flow From Operating Activities","2025-12-31":"18032.04000","2024-12-31":"17540.36000"},
                  {"field_name":"Net Change In Property, Plant, And Equipment","2025-12-31":"-9105.19600","2024-12-31":"-6838.78000"}
                ];
              </script>
            `,
          };
        }

        throw new Error(`Unexpected fetch ${url}`);
      }),
    );

    const result = await fetchValuationAutofill("NVO");

    expect(result.ok).toBe(true);
    expect(result.input.ticker).toBe("NVO");
    expect(result.input.currentPrice).toBe(45.8);
    expect(result.fields.operatingCashFlow?.source).toBe("SEC IFRS");
    expect(result.fields.freeCashFlow?.source).toBe("Yahoo TTM + FX");
    expect(result.fields.freeCashFlow?.value).toBeCloseTo(30_890_000_000 * 0.1556, 2);
    expect(result.fields.freeCashFlow?.original).toEqual({
      value: 30_890_000_000,
      currency: "DKK",
      unit: "total",
    });
    expect(result.fields.freeCashFlow?.fx).toEqual({
      from: "DKK",
      to: "USD",
      rate: 0.1556,
    });
    expect(result.fields.ebitda?.value).toBeCloseTo(179_890_000_000 * 0.1556, 2);
    expect(result.fields.ebitda?.original).toEqual({
      value: 179_890_000_000,
      currency: "DKK",
      unit: "total",
    });
    expect(result.fields.eps?.value).toBeCloseTo(27.41 * 0.1556, 6);
    expect(result.fields.eps?.original).toEqual({
      value: 27.41,
      currency: "DKK",
      unit: "perShare",
    });
    expect(result.fields.sharesOutstanding?.value).toBe(3_357_979_000);
    expect(result.fields.sharesOutstanding?.source).toBe("Alpha Vantage");
    expect(result.input.historicalFreeCashFlows).toEqual([
      { year: 2025, freeCashFlow: 8_926_844_000, source: "Macrotrends", asOf: "2025-12-31" },
      { year: 2024, freeCashFlow: 10_701_580_000, source: "Macrotrends", asOf: "2024-12-31" },
    ]);
    expect(result.input.models.dcf10Years.scenarios[0].baseFreeCashFlow).toBeCloseTo(
      30_890_000_000 * 0.1556,
      2,
    );
    expect(result.input.models.dcfMultiple.scenarios[0].baseMetricPerShare).toBeCloseTo(
      (30_890_000_000 * 0.1556) / 3_357_979_000,
      6,
    );
    expect(result.warnings).toContain("SEC IFRS found but needs FX normalization for direct USD valuation fields.");
    expect(result.warnings).toContain("Yahoo TTM metrics converted from DKK to USD.");
    expect(result.warnings).toContain("Macrotrends used for historical USD cash-flow rows.");
    expect(result.warnings).toContain("Historical multiples are partial; review currency and ADR ratio before applying.");
  });

  test("fetches historical multiples from SEC annual data and Yahoo year-end prices", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("query1.finance.yahoo.com") && url.includes("range=1d")) {
          return {
            ok: true,
            json: async () => ({
              chart: {
                result: [
                  {
                    meta: {
                      currency: "USD",
                      longName: "Test Corp",
                      regularMarketPrice: 42,
                    },
                  },
                ],
              },
            }),
          };
        }

        if (url.includes("query1.finance.yahoo.com") && url.includes("interval=1mo")) {
          return {
            ok: true,
            json: async () => ({
              chart: {
                result: [
                  {
                    timestamp: [
                      Math.floor(Date.parse("2024-12-31T00:00:00.000Z") / 1000),
                      Math.floor(Date.parse("2025-12-31T00:00:00.000Z") / 1000),
                    ],
                    indicators: {
                      quote: [
                        {
                          close: [30, 40],
                        },
                      ],
                    },
                  },
                ],
              },
            }),
          };
        }

        if (url.endsWith("/company_tickers.json")) {
          return {
            ok: true,
            json: async () => ({
              "0": { cik_str: 123456, ticker: "TEST", title: "Test Corp" },
            }),
          };
        }

        if (url.includes("/api/xbrl/companyfacts/CIK0000123456.json")) {
          return {
            ok: true,
            json: async () => ({
              cik: 123456,
              entityName: "Test Corp",
              facts: {
                "us-gaap": {
                  NetCashProvidedByUsedInOperatingActivities: {
                    units: {
                      USD: [
                        { start: "2025-01-01", end: "2025-12-31", fy: 2025, fp: "FY", form: "10-K", val: 900 },
                        { start: "2024-01-01", end: "2024-12-31", fy: 2024, fp: "FY", form: "10-K", val: 600 },
                      ],
                    },
                  },
                  PaymentsToAcquirePropertyPlantAndEquipment: {
                    units: {
                      USD: [
                        { start: "2025-01-01", end: "2025-12-31", fy: 2025, fp: "FY", form: "10-K", val: 100 },
                        { start: "2024-01-01", end: "2024-12-31", fy: 2024, fp: "FY", form: "10-K", val: 100 },
                      ],
                    },
                  },
                  EarningsPerShareDiluted: {
                    units: {
                      "USD/shares": [
                        { start: "2025-01-01", end: "2025-12-31", fy: 2025, fp: "FY", form: "10-K", val: 4 },
                        { start: "2024-01-01", end: "2024-12-31", fy: 2024, fp: "FY", form: "10-K", val: 3 },
                      ],
                    },
                  },
                  EntityCommonStockSharesOutstanding: {
                    units: {
                      shares: [
                        { end: "2025-12-31", fy: 2025, fp: "FY", form: "10-K", val: 100 },
                        { end: "2024-12-31", fy: 2024, fp: "FY", form: "10-K", val: 100 },
                      ],
                    },
                  },
                  EarningsBeforeInterestTaxesDepreciationAmortization: {
                    units: {
                      USD: [
                        { start: "2025-01-01", end: "2025-12-31", fy: 2025, fp: "FY", form: "10-K", val: 500 },
                        { start: "2024-01-01", end: "2024-12-31", fy: 2024, fp: "FY", form: "10-K", val: 400 },
                      ],
                    },
                  },
                  CashAndCashEquivalentsAtCarryingValue: {
                    units: {
                      USD: [
                        { end: "2025-12-31", fy: 2025, fp: "FY", form: "10-K", val: 50 },
                        { end: "2024-12-31", fy: 2024, fp: "FY", form: "10-K", val: 40 },
                      ],
                    },
                  },
                  LongTermDebtAndFinanceLeaseObligations: {
                    units: {
                      USD: [
                        { end: "2025-12-31", fy: 2025, fp: "FY", form: "10-K", val: 150 },
                        { end: "2024-12-31", fy: 2024, fp: "FY", form: "10-K", val: 140 },
                      ],
                    },
                  },
                },
              },
            }),
          };
        }

        if (url.includes("macrotrends.net")) {
          return {
            ok: true,
            text: async () => "<script>var originalData = [];</script>",
          };
        }

        throw new Error(`Unexpected fetch ${url}`);
      }),
    );

    const result = await fetchValuationAutofill("TEST");

    expect(result.input.historicalMultiples?.priceToFreeCashFlow).toEqual([
      {
        year: 2025,
        numerator: 40,
        denominator: 8,
        multiple: 5,
        source: "Derived",
        asOf: "2025-12-31",
      },
      {
        year: 2024,
        numerator: 30,
        denominator: 5,
        multiple: 6,
        source: "Derived",
        asOf: "2024-12-31",
      },
    ]);
    expect(result.input.historicalMultiples?.peRatio?.[0]).toMatchObject({
      year: 2025,
      numerator: 40,
      denominator: 4,
      multiple: 10,
    });
    expect(result.input.historicalMultiples?.evToEbitda?.[0]).toMatchObject({
      year: 2025,
      numerator: 4_100,
      denominator: 500,
      multiple: 8.2,
    });
    expect(result.input.historicalMultipleSeries?.evToEbitda).toEqual([
      {
        date: "2024-12-31",
        year: 2024,
        numerator: 3_100,
        denominator: 400,
        multiple: 7.75,
        source: "Derived",
        asOf: "2024-12-31",
      },
      {
        date: "2025-12-31",
        year: 2025,
        numerator: 4_100,
        denominator: 500,
        multiple: 8.2,
        source: "Derived",
        asOf: "2025-12-31",
      },
    ]);
  });

  test("fills historical P/FCF rows from selected FCF history when SEC cash-flow rows are unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("query1.finance.yahoo.com") && url.includes("range=1d")) {
          return {
            ok: true,
            json: async () => ({
              chart: {
                result: [
                  {
                    meta: {
                      currency: "USD",
                      longName: "FCF Corp",
                      regularMarketPrice: 42,
                    },
                  },
                ],
              },
            }),
          };
        }

        if (url.includes("query1.finance.yahoo.com") && url.includes("interval=1mo")) {
          return {
            ok: true,
            json: async () => ({
              chart: {
                result: [
                  {
                    timestamp: [
                      Math.floor(Date.parse("2024-12-31T00:00:00.000Z") / 1000),
                      Math.floor(Date.parse("2025-12-31T00:00:00.000Z") / 1000),
                    ],
                    indicators: {
                      quote: [
                        {
                          close: [30, 40],
                        },
                      ],
                    },
                  },
                ],
              },
            }),
          };
        }

        if (url.includes("query2.finance.yahoo.com/ws/fundamentals-timeseries")) {
          return {
            ok: true,
            json: async () => ({
              timeseries: {
                result: [
                  {
                    trailingDilutedAverageShares: [
                      {
                        asOfDate: "2025-12-31",
                        reportedValue: { raw: 100 },
                      },
                    ],
                  },
                ],
              },
            }),
          };
        }

        if (url.includes("alphavantage.co")) {
          return {
            ok: true,
            json: async () => ({ SharesOutstanding: "100" }),
          };
        }

        if (url.endsWith("/company_tickers.json")) {
          return {
            ok: true,
            json: async () => ({
              "0": { cik_str: 654321, ticker: "FCF", title: "FCF Corp" },
            }),
          };
        }

        if (url.includes("/api/xbrl/companyfacts/CIK0000654321.json")) {
          return {
            ok: true,
            json: async () => ({
              cik: 654321,
              entityName: "FCF Corp",
              facts: {
                "us-gaap": {
                  EntityCommonStockSharesOutstanding: {
                    units: {
                      shares: [
                        { end: "2025-12-31", form: "8-K", val: 100 },
                      ],
                    },
                  },
                  EarningsPerShareDiluted: {
                    units: {
                      "USD/shares": [
                        { start: "2025-01-01", end: "2025-12-31", fy: 2025, fp: "FY", form: "10-K", val: 4 },
                        { start: "2024-01-01", end: "2024-12-31", fy: 2024, fp: "FY", form: "10-K", val: 3 },
                      ],
                    },
                  },
                },
              },
            }),
          };
        }

        if (url.includes("macrotrends.net")) {
          return {
            ok: true,
            text: async () => `
              <script>
                var originalData = [
                  {"field_name":"Cash Flow From Operating Activities","2025":"1000","2024":"800"},
                  {"field_name":"Net Change In Property, Plant, And Equipment","2025":"-200","2024":"-300"}
                ];
              </script>
            `,
          };
        }

        if (url.includes("financecharts.com")) {
          return { ok: false, status: 403, text: async () => "" };
        }

        throw new Error(`Unexpected fetch ${url}`);
      }),
    );

    const result = await fetchValuationAutofill("FCF");

    expect(result.input.historicalFreeCashFlows).toEqual([
      { year: 2025, freeCashFlow: 800_000_000, source: "Macrotrends", asOf: "2025-12-31" },
      { year: 2024, freeCashFlow: 500_000_000, source: "Macrotrends", asOf: "2024-12-31" },
    ]);
    expect(result.input.historicalMultiples?.priceToFreeCashFlow).toEqual([
      {
        year: 2025,
        numerator: 40,
        denominator: 8_000_000,
        multiple: 0.000005,
        source: "Derived",
        asOf: "2025-12-31",
      },
      {
        year: 2024,
        numerator: 30,
        denominator: 5_000_000,
        multiple: 0.000006,
        source: "Derived",
        asOf: "2024-12-31",
      },
    ]);
  });
});
