import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { StockValuationPanel } from "@/components/stock-valuation-panel";
import {
  buildDefaultStockValuationInput,
  type HistoricalFreeCashFlowRow,
  type HistoricalMultipleBenchmark,
  type HistoricalMultipleRow,
  type HistoricalMultipleSeriesPoint,
} from "@/lib/stock-valuation";

vi.mock("@/components/charts/base-chart", () => ({
  BaseChart: ({ height }: { height?: number }) => (
    <div data-height={height} data-testid="mock-base-chart" />
  ),
}));

const metaInput = buildDefaultStockValuationInput({
  ticker: "META",
  companyName: "Meta Platforms",
  currentPrice: 609,
  sharesOutstanding: 2533659000,
  fields: {
    currentPrice: { value: 609, source: "Yahoo" },
    sharesOutstanding: { value: 2533659000, source: "Alpha Vantage" },
    freeCashFlow: { value: 65_722_000_000, source: "SEC" },
    ebitda: { value: 98_399_000_000, source: "Alpha Vantage" },
    eps: { value: 24.61, source: "Alpha Vantage" },
    peRatio: { value: 24.75, source: "Alpha Vantage" },
    evToEbitda: { value: 16.2, source: "Alpha Vantage" },
    priceToFreeCashFlow: { value: 23.48, source: "Derived" },
  },
});

const sofiInput = buildDefaultStockValuationInput({
  ticker: "SOFI",
  companyName: "SoFi Technologies, Inc.",
  currentPrice: 15.65,
  sharesOutstanding: 1_100_000_000,
  fields: {
    currentPrice: { value: 15.65, source: "Yahoo" },
    sharesOutstanding: { value: 1_100_000_000, source: "Alpha Vantage" },
    freeCashFlow: { value: 600_000_000, source: "SEC FY", asOf: "FY 2025" },
    ebitda: { value: 500_000_000, source: "Alpha Vantage" },
    eps: { value: 0.15, source: "Alpha Vantage" },
  },
});

const googInput = buildDefaultStockValuationInput({
  ticker: "GOOG",
  companyName: "Alphabet Inc.",
  currentPrice: 381.54,
  sharesOutstanding: 5_456_000_000,
  fields: {
    currentPrice: { value: 381.54, source: "Yahoo" },
    sharesOutstanding: { value: 5_456_000_000, source: "Alpha Vantage" },
    freeCashFlow: { value: 64_429_000_000, source: "SEC TTM", asOf: "TTM 2026-03-31" },
    ebitda: { value: 123_166_000_000, source: "Alpha Vantage" },
    eps: { value: 13.11, source: "SEC TTM", asOf: "TTM 2026-03-31" },
  },
});

const nvoFxInput = buildDefaultStockValuationInput({
  ticker: "NVO",
  companyName: "Novo Nordisk A/S",
  currentPrice: 45.8,
  sharesOutstanding: 3_357_979_000,
  fields: {
    currentPrice: { value: 45.8, source: "Yahoo" },
    sharesOutstanding: { value: 3_357_979_000, source: "Alpha Vantage" },
    freeCashFlow: {
      value: 4_809_573_000,
      source: "Yahoo TTM + FX",
      asOf: "TTM 2026-03-31",
      original: { value: 30_890_000_000, currency: "DKK", unit: "total" },
      fx: { from: "DKK", to: "USD", rate: 0.1557 },
    },
    ebitda: {
      value: 28_008_873_000,
      source: "Yahoo TTM + FX",
      asOf: "TTM 2026-03-31",
      original: { value: 179_890_000_000, currency: "DKK", unit: "total" },
      fx: { from: "DKK", to: "USD", rate: 0.1557 },
    },
    eps: {
      value: 4.27,
      source: "Yahoo TTM + FX",
      asOf: "TTM 2026-03-31",
      original: { value: 27.41, currency: "DKK", unit: "perShare" },
      fx: { from: "DKK", to: "USD", rate: 0.1557 },
    },
  },
});

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
  { year: 2025, numerator: 40, denominator: -2, multiple: -20, source: "Yahoo", asOf: "2025-12-31" },
  { year: 2024, numerator: 30, denominator: 2, multiple: 15, source: "Yahoo", asOf: "2024-12-31" },
  { year: 2023, numerator: 24, denominator: 3, multiple: 8, source: "Yahoo", asOf: "2023-12-31" },
  { year: 2022, numerator: 60, denominator: 2, multiple: 30, source: "Yahoo", asOf: "2022-12-31" },
];

const historicalPeRows: HistoricalMultipleRow[] = [
  { year: 2025, numerator: 40, denominator: -1, multiple: -40, source: "Yahoo", asOf: "2025-12-31" },
  { year: 2024, numerator: 30, denominator: 2, multiple: 15, source: "Yahoo", asOf: "2024-12-31" },
  { year: 2023, numerator: 24, denominator: 3, multiple: 8, source: "Yahoo", asOf: "2023-12-31" },
];

const historicalEvEbitdaRows: HistoricalMultipleRow[] = [
  { year: 2025, numerator: 4_100, denominator: 500, multiple: 8.2, source: "Derived", asOf: "2025-12-31" },
  { year: 2024, numerator: 3_100, denominator: 400, multiple: 7.75, source: "Derived", asOf: "2024-12-31" },
  { year: 2023, numerator: 2_000, denominator: -100, multiple: -20, source: "Derived", asOf: "2023-12-31" },
];

const historicalPriceToFcfSeries: HistoricalMultipleSeriesPoint[] = [
  { date: "2024-01-31", year: 2024, numerator: 30, denominator: 2, multiple: 15, source: "Derived", asOf: "2023-12-31" },
  { date: "2024-02-29", year: 2024, numerator: 24, denominator: 3, multiple: 8, source: "Derived", asOf: "2023-12-31" },
  { date: "2024-03-31", year: 2024, numerator: 60, denominator: 2, multiple: 30, source: "Derived", asOf: "2023-12-31" },
];

const historicalPeSeries: HistoricalMultipleSeriesPoint[] = [
  { date: "2024-01-31", year: 2024, numerator: 30, denominator: 2, multiple: 15, source: "Derived", asOf: "2023-12-31" },
  { date: "2024-02-29", year: 2024, numerator: 24, denominator: 3, multiple: 8, source: "Derived", asOf: "2023-12-31" },
];

const historicalEvEbitdaSeries: HistoricalMultipleSeriesPoint[] = [
  { date: "2024-01-31", year: 2024, numerator: 4_100, denominator: 500, multiple: 8.2, source: "Derived", asOf: "2023-12-31" },
  { date: "2024-02-29", year: 2024, numerator: 3_100, denominator: 400, multiple: 7.75, source: "Derived", asOf: "2023-12-31" },
];

const historicalInput = {
  ...buildDefaultStockValuationInput({
    ticker: "HIST",
    companyName: "History Corp",
    currentPrice: 10,
    sharesOutstanding: 100,
    historicalFreeCashFlows: screenshotHistoricalFcfRows,
    fields: {
      currentPrice: { value: 10, source: "Manual" },
      sharesOutstanding: { value: 100, source: "Manual" },
      freeCashFlow: { value: -6336345000, source: "SEC TTM" },
    },
  }),
  historicalFreeCashFlows: screenshotHistoricalFcfRows,
};

const multipleInput = {
  ...buildDefaultStockValuationInput({
    ticker: "INTC",
    companyName: "Intel Corp",
    currentPrice: 40,
    sharesOutstanding: 100,
    fields: {
      currentPrice: { value: 40, source: "Yahoo" },
      sharesOutstanding: { value: 100, source: "Alpha Vantage" },
      freeCashFlow: { value: -200, source: "SEC FY", asOf: "FY 2025" },
      eps: { value: -1, source: "SEC FY", asOf: "FY 2025" },
      ebitda: { value: 500, source: "Alpha Vantage" },
      priceToFreeCashFlow: { value: -20, source: "Derived" },
      peRatio: { value: -40, source: "Derived" },
      evToEbitda: { value: 8.2, source: "Derived" },
    },
  }),
  historicalMultiples: {
    priceToFreeCashFlow: historicalPriceToFcfRows,
    peRatio: historicalPeRows,
    evToEbitda: historicalEvEbitdaRows,
  },
  historicalMultipleSeries: {
    priceToFreeCashFlow: historicalPriceToFcfSeries,
    peRatio: historicalPeSeries,
    evToEbitda: historicalEvEbitdaSeries,
  },
};

const financeChartsEvToEbitdaBenchmark: HistoricalMultipleBenchmark = {
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

const financeChartsMultipleInput = {
  ...multipleInput,
  ticker: "NVO",
  companyName: "Novo Nordisk A/S",
  historicalMultipleBenchmarks: {
    evToEbitda: financeChartsEvToEbitdaBenchmark,
  },
};

const seriesOnlyMultipleInput = {
  ...buildDefaultStockValuationInput({
    ticker: "META",
    companyName: "Meta Platforms",
    currentPrice: 609,
    sharesOutstanding: 2_500_000_000,
    fields: {
      currentPrice: { value: 609, source: "Yahoo" },
      sharesOutstanding: { value: 2_500_000_000, source: "Yahoo" },
      ebitda: { value: 111_504_000_000, source: "Yahoo TTM" },
      evToEbitda: { value: 13.93, source: "Derived" },
    },
  }),
  historicalMultiples: {
    evToEbitda: [],
  },
  historicalMultipleSeries: {
    evToEbitda: [
      {
        date: "2025-12-31",
        year: 2025,
        numerator: 1_800,
        denominator: 100,
        multiple: 18,
        source: "Derived",
        asOf: "2025-12-31",
      },
      {
        date: "2024-12-31",
        year: 2024,
        numerator: 1_400,
        denominator: 100,
        multiple: 14,
        source: "Derived",
        asOf: "2024-12-31",
      },
      {
        date: "2023-12-31",
        year: 2023,
        numerator: 1_100,
        denominator: 100,
        multiple: 11,
        source: "Derived",
        asOf: "2023-12-31",
      },
    ],
  },
  historicalMultipleBenchmarks: {
    evToEbitda: {
      source: "FinanceCharts",
      sourceStatus: "unavailable",
      sourceMessage: "FinanceCharts data unavailable; HTTP 403.",
      currentMultiple: null,
      low: null,
      average: null,
      high: null,
      periodAverages: [],
      seriesPoints: [],
    },
  },
};

function mockFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/valuation/saved" && !init) {
        return {
          ok: true,
          json: async () => ({ ok: true, analyses: [] }),
        };
      }

      if (url.startsWith("/api/valuation/autofill")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            input: metaInput,
            fields: {
              currentPrice: { value: 609, source: "Yahoo" },
              sharesOutstanding: { value: 2533659000, source: "Alpha Vantage" },
            },
            warnings: [],
          }),
        };
      }

      if (url === "/api/valuation/saved" && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            analysis: {
              id: "analysis-1",
              userId: "user-1",
              ticker: "META",
              companyName: "Meta Platforms",
              title: "META valuation",
              latestFairValue: 100,
              currentPrice: 609,
              payload: metaInput,
              createdAt: "2026-05-12T07:00:00.000Z",
              updatedAt: "2026-05-12T07:00:00.000Z",
            },
          }),
        };
      }

      throw new Error(`Unexpected fetch ${url}`);
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StockValuationPanel", () => {
  test("renders the valuation workspace with no horizontal overflow helper", async () => {
    mockFetch();

    const { container } = render(<StockValuationPanel />);

    expect(screen.getByRole("heading", { name: "Справедлива цена" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Авто попълване" })).toBeVisible();
    expect(await screen.findByText("Запазени анализи")).toBeVisible();
    expect(screen.getByRole("button", { name: /DCF 10 years ·/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /EV\/EBITDA ·/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /P\/E ·/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /DCF Multiple ·/ })).toBeVisible();
    expect(screen.getAllByTestId("valuation-scenario-row")).toHaveLength(3);
    expect(screen.getByLabelText("DCF 10 years final weight")).toBeVisible();
    expect(container.querySelector('[data-layout="valuation-workspace-wide"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-layout="valuation-scenario-wide-row"]')).toHaveLength(3);
    expect(container.querySelector(".overflow-x-auto")).not.toBeInTheDocument();
  });

  test("autofill populates editable fields and source badges", async () => {
    mockFetch();
    const user = userEvent.setup();

    render(<StockValuationPanel />);

    await user.clear(screen.getByLabelText("Ticker"));
    await user.type(screen.getByLabelText("Ticker"), "meta");
    await user.click(screen.getByRole("button", { name: "Авто попълване" }));

    await waitFor(() => expect(screen.getByDisplayValue("META")).toBeVisible());
    expect(screen.getByDisplayValue("Meta Platforms")).toBeVisible();
    expect(screen.getByRole("button", { name: /DCF 10 years · \$/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /EV\/EBITDA · \$/ })).toBeVisible();
    expect(screen.queryByText(/SEC и Alpha Vantage са primary/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Source badges/ }));
    expect(screen.getByText(/SEC и Alpha Vantage са primary/)).toBeVisible();
    expect(screen.getAllByText("Yahoo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Alpha Vantage").length).toBeGreaterThan(0);
  });

  test("manual override recalculates immediately and can be saved", async () => {
    mockFetch();
    const user = userEvent.setup();

    render(<StockValuationPanel />);

    await user.clear(screen.getByLabelText("Ticker"));
    await user.type(screen.getByLabelText("Ticker"), "meta");
    await user.click(screen.getByRole("button", { name: "Авто попълване" }));
    await waitFor(() => expect(screen.getByDisplayValue("META")).toBeVisible());

    await user.clear(screen.getByLabelText("Current price"));
    await user.type(screen.getByLabelText("Current price"), "500");

    expect(screen.getByText(/BUY|SELL/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Save analysis" }));

    await waitFor(() => expect(screen.getByText("Запазено")).toBeVisible());
  });

  test("autofill replaces previous ticker data and shows SEC period source labels", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/valuation/saved") {
          return {
            ok: true,
            json: async () => ({ ok: true, analyses: [] }),
          };
        }

        if (url.includes("ticker=SOFI")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              input: sofiInput,
              fields: sofiInput.sources,
              warnings: ["SEC TTM free cash flow unavailable; latest full-year SEC cash flow was used."],
            }),
          };
        }

        if (url.includes("ticker=GOOG")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              input: googInput,
              fields: googInput.sources,
              warnings: [],
            }),
          };
        }

        throw new Error(`Unexpected fetch ${url}`);
      }),
    );
    const user = userEvent.setup();

    render(<StockValuationPanel />);

    await user.clear(screen.getByLabelText("Ticker"));
    await user.type(screen.getByLabelText("Ticker"), "SOFI");
    await user.click(screen.getByRole("button", { name: "Авто попълване" }));
    await waitFor(() => expect(screen.getByDisplayValue("SOFI")).toBeVisible());
    expect(screen.getByDisplayValue("SoFi Technologies, Inc.")).toBeVisible();
    expect(screen.getByText(/SEC TTM free cash flow unavailable/)).toBeVisible();

    await user.clear(screen.getByLabelText("Ticker"));
    await user.type(screen.getByLabelText("Ticker"), "GOOG");
    await user.click(screen.getByRole("button", { name: "Авто попълване" }));

    await waitFor(() => expect(screen.getByDisplayValue("GOOG")).toBeVisible());
    expect(screen.getByDisplayValue("Alphabet Inc.")).toBeVisible();
    expect(screen.queryByDisplayValue("SoFi Technologies, Inc.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Source badges/ }));
    expect(screen.getAllByText("SEC TTM").length).toBeGreaterThan(0);
    expect(screen.getAllByText("· TTM 2026-03-31").length).toBeGreaterThan(0);
    expect(screen.queryByText(/DKK/)).not.toBeInTheDocument();
  });

  test("shows FX original labels and full converted scenario values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/valuation/saved") {
          return {
            ok: true,
            json: async () => ({ ok: true, analyses: [] }),
          };
        }

        if (url.startsWith("/api/valuation/autofill")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              input: nvoFxInput,
              fields: nvoFxInput.sources,
              warnings: [],
            }),
          };
        }

        throw new Error(`Unexpected fetch ${url}`);
      }),
    );
    const user = userEvent.setup();

    render(<StockValuationPanel />);

    await user.clear(screen.getByLabelText("Ticker"));
    await user.type(screen.getByLabelText("Ticker"), "NVO");
    await user.click(screen.getByRole("button", { name: "Авто попълване" }));
    await waitFor(() => expect(screen.getByDisplayValue("NVO")).toBeVisible());

    expect(screen.getAllByText("30,890,000,000 DKK").length).toBeGreaterThan(0);
    expect(
      screen.getAllByLabelText("FCF").map((field) => (field as HTMLInputElement).value),
    ).toEqual(["4,809,573,000", "4,809,573,000", "4,809,573,000"]);

    await user.click(screen.getByRole("button", { name: /EV\/EBITDA ·/ }));

    expect(screen.getAllByText("179,890,000,000 DKK").length).toBeGreaterThan(0);
    expect(
      screen.getAllByLabelText("EBITDA").map((field) => (field as HTMLInputElement).value),
    ).toEqual(["28,008,873,000", "28,008,873,000", "28,008,873,000"]);

    fireEvent.change(screen.getAllByLabelText("EBITDA")[0], {
      target: { value: "28,008,873,000" },
    });
    expect((screen.getAllByLabelText("EBITDA")[0] as HTMLInputElement).value).toBe(
      "28,008,873,000",
    );

    await user.click(screen.getByRole("button", { name: /P\/E ·/ }));

    expect(screen.getAllByText("27.41 DKK").length).toBeGreaterThan(0);
    expect(
      screen.getAllByLabelText("EPS").map((field) => (field as HTMLInputElement).value),
    ).toEqual(["4.27", "4.27", "4.27"]);

    await user.click(screen.getByRole("button", { name: /DCF Multiple ·/ }));

    expect(screen.getAllByText("9.2 DKK/share").length).toBeGreaterThan(0);
    expect(
      screen.getAllByLabelText("FCF/share").map((field) => (field as HTMLInputElement).value),
    ).toEqual(["1.43", "1.43", "1.43"]);
  });

  test("shows the read-only FCF per share TTM calculator only in DCF Multiple", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/valuation/saved") {
          return {
            ok: true,
            json: async () => ({ ok: true, analyses: [] }),
          };
        }

        if (url.startsWith("/api/valuation/autofill")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              input: googInput,
              fields: googInput.sources,
              warnings: [],
            }),
          };
        }

        throw new Error(`Unexpected fetch ${url}`);
      }),
    );
    const user = userEvent.setup();

    render(<StockValuationPanel />);

    await user.clear(screen.getByLabelText("Ticker"));
    await user.type(screen.getByLabelText("Ticker"), "GOOG");
    await user.click(screen.getByRole("button", { name: "Авто попълване" }));
    await waitFor(() => expect(screen.getByDisplayValue("GOOG")).toBeVisible());

    expect(screen.queryByTestId("fcf-per-share-ttm-calculator")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /DCF Multiple ·/ }));

    expect(screen.getByTestId("fcf-per-share-ttm-calculator")).toBeVisible();
    expect(screen.getByText("Free Cash Flow TTM")).toBeVisible();
    expect(screen.getByTestId("fcf-ttm-value")).toHaveTextContent("$64,429,000,000.00");
    expect(screen.getByTestId("shares-outstanding-value")).toHaveTextContent("5,456,000,000");
    expect(screen.getByTestId("fcf-per-share-ttm-value")).toHaveTextContent("$11.81");
  });

  test("FCF per share calculator does not overwrite DCF Multiple scenario inputs", async () => {
    const customGoogInput = buildDefaultStockValuationInput({
      ticker: "GOOG",
      companyName: "Alphabet Inc.",
      currentPrice: 381.54,
      sharesOutstanding: 5_456_000_000,
      fields: {
        currentPrice: { value: 381.54, source: "Yahoo" },
        sharesOutstanding: { value: 5_456_000_000, source: "Alpha Vantage" },
        freeCashFlow: { value: 64_429_000_000, source: "SEC TTM", asOf: "TTM 2026-03-31" },
      },
    });
    customGoogInput.models.dcfMultiple.scenarios = customGoogInput.models.dcfMultiple.scenarios.map(
      (scenario, index) => ({
        ...scenario,
        baseMetricPerShare: index + 1,
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/valuation/saved") {
          return {
            ok: true,
            json: async () => ({ ok: true, analyses: [] }),
          };
        }

        if (url.startsWith("/api/valuation/autofill")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              input: customGoogInput,
              fields: customGoogInput.sources,
              warnings: [],
            }),
          };
        }

        throw new Error(`Unexpected fetch ${url}`);
      }),
    );
    const user = userEvent.setup();

    render(<StockValuationPanel />);

    await user.clear(screen.getByLabelText("Ticker"));
    await user.type(screen.getByLabelText("Ticker"), "GOOG");
    await user.click(screen.getByRole("button", { name: "Авто попълване" }));
    await waitFor(() => expect(screen.getByDisplayValue("GOOG")).toBeVisible());
    await user.click(screen.getByRole("button", { name: /DCF Multiple ·/ }));

    expect(screen.getByTestId("fcf-per-share-ttm-value")).toHaveTextContent("$11.81");
    expect(
      screen.getAllByLabelText("FCF/share").map((field) => (field as HTMLInputElement).value),
    ).toEqual(["1", "2", "3"]);
  });

  test("shows collapsible historical FCF calculator only in DCF 10 years", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/valuation/saved") {
          return {
            ok: true,
            json: async () => ({ ok: true, analyses: [] }),
          };
        }

        if (url.startsWith("/api/valuation/autofill")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              input: historicalInput,
              fields: historicalInput.sources,
              warnings: [],
            }),
          };
        }

        throw new Error(`Unexpected fetch ${url}`);
      }),
    );
    const user = userEvent.setup();

    render(<StockValuationPanel />);

    await user.clear(screen.getByLabelText("Ticker"));
    await user.type(screen.getByLabelText("Ticker"), "HIST");
    await user.click(screen.getByRole("button", { name: "Авто попълване" }));
    await waitFor(() => expect(screen.getByDisplayValue("HIST")).toBeVisible());

    expect(screen.getByRole("button", { name: /10 Years Free Cash Flow/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Historical P\/E/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("historical-fcf-row-0")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /P\/E ·/ }));

    expect(screen.queryByRole("button", { name: /10 Years Free Cash Flow/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Historical P\/E/ })).toBeVisible();
  });

  test("historical FCF calculator renders averages, edits rows, and applies average to DCF scenarios", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/valuation/saved") {
          return {
            ok: true,
            json: async () => ({ ok: true, analyses: [] }),
          };
        }

        if (url.startsWith("/api/valuation/autofill")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              input: historicalInput,
              fields: historicalInput.sources,
              warnings: [],
            }),
          };
        }

        throw new Error(`Unexpected fetch ${url}`);
      }),
    );
    const user = userEvent.setup();

    render(<StockValuationPanel />);

    await user.clear(screen.getByLabelText("Ticker"));
    await user.type(screen.getByLabelText("Ticker"), "HIST");
    await user.click(screen.getByRole("button", { name: "Авто попълване" }));
    await waitFor(() => expect(screen.getByDisplayValue("HIST")).toBeVisible());

    await user.click(screen.getByRole("button", { name: /10 Years Free Cash Flow/ }));

    expect(screen.getByTestId("historical-fcf-row-0")).toHaveTextContent("Year 10");
    expect(screen.getByTestId("historical-fcf-row-10")).toHaveTextContent("Year 0");
    expect(screen.getByTestId("historical-fcf-average")).toHaveTextContent("$1,131.03");
    expect(screen.getByTestId("historical-fcf-average-percent")).toHaveTextContent("-14102.62%");

    await user.clear(screen.getByLabelText("Historical FCF Year 10"));
    await user.type(screen.getByLabelText("Historical FCF Year 10"), "5000");

    expect(screen.getByTestId("historical-fcf-average")).toHaveTextContent("$1,189.40");

    await user.click(screen.getByRole("button", { name: "Apply average to DCF scenarios" }));

    expect(
      screen.getAllByLabelText("FCF").map((field) => (field as HTMLInputElement).value),
    ).toEqual(["1,189.4", "1,189.4", "1,189.4"]);
  });

  test("saved valuation restores historical FCF rows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/valuation/saved") {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              analyses: [
                {
                  id: "history-analysis",
                  userId: "user-1",
                  ticker: "HIST",
                  companyName: "History Corp",
                  title: "HIST history",
                  latestFairValue: 10,
                  currentPrice: 10,
                  payload: historicalInput,
                  createdAt: "2026-05-14T06:00:00.000Z",
                  updatedAt: "2026-05-14T06:00:00.000Z",
                },
              ],
            }),
          };
        }

        throw new Error(`Unexpected fetch ${url}`);
      }),
    );
    const user = userEvent.setup();

    render(<StockValuationPanel />);

    await user.click(await screen.findByText("HIST history"));
    await user.click(screen.getByRole("button", { name: /10 Years Free Cash Flow/ }));

    expect(screen.getByLabelText("Historical year Year 10")).toHaveValue(2023);
    expect(screen.getByLabelText("Historical FCF Year 10")).toHaveValue(4358);
    expect(screen.getByTestId("historical-fcf-average")).toHaveTextContent("$1,131.03");
  });

  test("formats noisy scenario input decimals in P/E and DCF Multiple", async () => {
    const customGoogInput = buildDefaultStockValuationInput({
      ticker: "GOOG",
      companyName: "Alphabet Inc.",
      currentPrice: 381.54,
      sharesOutstanding: 5_456_000_000,
      fields: {
        currentPrice: { value: 381.54, source: "Yahoo" },
        sharesOutstanding: { value: 5_456_000_000, source: "Alpha Vantage" },
        freeCashFlow: { value: 64_429_000_000, source: "SEC TTM", asOf: "TTM 2026-03-31" },
        eps: { value: 13.110000000000001, source: "SEC TTM", asOf: "TTM 2026-03-31" },
      },
    });
    customGoogInput.models.pe.scenarios = customGoogInput.models.pe.scenarios.map((scenario) => ({
      ...scenario,
      baseMetricPerShare: 13.110000000000001,
    }));
    customGoogInput.models.dcfMultiple.scenarios = customGoogInput.models.dcfMultiple.scenarios.map(
      (scenario) => ({
        ...scenario,
        baseMetricPerShare: 11.06330807146357,
        growthYearsFiveToTen: 0.14000000000000002,
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/valuation/saved") {
          return {
            ok: true,
            json: async () => ({ ok: true, analyses: [] }),
          };
        }

        if (url.startsWith("/api/valuation/autofill")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              input: customGoogInput,
              fields: customGoogInput.sources,
              warnings: [],
            }),
          };
        }

        throw new Error(`Unexpected fetch ${url}`);
      }),
    );
    const user = userEvent.setup();

    render(<StockValuationPanel />);

    await user.clear(screen.getByLabelText("Ticker"));
    await user.type(screen.getByLabelText("Ticker"), "GOOG");
    await user.click(screen.getByRole("button", { name: "Авто попълване" }));
    await waitFor(() => expect(screen.getByDisplayValue("GOOG")).toBeVisible());

    await user.click(screen.getByRole("button", { name: /P\/E ·/ }));
    expect(
      screen.getAllByLabelText("EPS").map((field) => (field as HTMLInputElement).value),
    ).toEqual(["13.11", "13.11", "13.11"]);

    await user.click(screen.getByRole("button", { name: /DCF Multiple ·/ }));
    expect(
      screen.getAllByLabelText("FCF/share").map((field) => (field as HTMLInputElement).value),
    ).toEqual(["11.06", "11.06", "11.06"]);
    expect((screen.getAllByLabelText("Growth 6-10")[0] as HTMLInputElement).value).toBe("14");
  });

  test("inline historical multiples panel opens and applies positive ranges to scenarios", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/valuation/saved") {
          return {
            ok: true,
            json: async () => ({ ok: true, analyses: [] }),
          };
        }

        if (url.startsWith("/api/valuation/autofill")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              input: multipleInput,
              fields: multipleInput.sources,
              warnings: [],
            }),
          };
        }

        throw new Error(`Unexpected fetch ${url}`);
      }),
    );
    const user = userEvent.setup();

    render(<StockValuationPanel />);

    await user.clear(screen.getByLabelText("Ticker"));
    await user.type(screen.getByLabelText("Ticker"), "INTC");
    await user.click(screen.getByRole("button", { name: "Авто попълване" }));
    await waitFor(() => expect(screen.getByDisplayValue("INTC")).toBeVisible());

    await user.click(screen.getByRole("button", { name: /DCF Multiple ·/ }));

    expect(screen.queryByRole("button", { name: "Historical charts" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Historical P\/FCF/ })).toBeVisible();
    expect(screen.queryByTestId("historical-multiple-row-priceToFreeCashFlow-0")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Historical P\/FCF/ }));

    const panel = screen.getByTestId("historical-multiple-panel-priceToFreeCashFlow");
    expect(panel).toBeVisible();
    expect(screen.queryByRole("dialog", { name: /Historical charts/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("historical-multiple-bar-chart-priceToFreeCashFlow")).not.toBeInTheDocument();
    expect(screen.queryByTestId("historical-multiple-line-chart-priceToFreeCashFlow")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-base-chart")).not.toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Open P/FCF on FinanceCharts" })).toHaveAttribute(
      "href",
      "https://www.financecharts.com/stocks/INTC/value/price-to-free-cash-flow",
    );
    const firstPfcfRow = screen.getByTestId("historical-multiple-row-priceToFreeCashFlow-0");
    expect(within(firstPfcfRow).getByDisplayValue("-20")).toBeVisible();
    expect(firstPfcfRow).toHaveTextContent("ignored for Apply");
    expect(screen.getByTestId("historical-multiple-low-priceToFreeCashFlow")).toHaveTextContent("8");
    expect(screen.getByTestId("historical-multiple-average-priceToFreeCashFlow")).toHaveTextContent("17.67");
    expect(screen.getByTestId("historical-multiple-high-priceToFreeCashFlow")).toHaveTextContent("30");

    await user.click(screen.getByRole("button", { name: "Apply P/FCF to scenarios" }));

    expect(
      screen.getAllByLabelText("P/FCF Multiple").map((field) => (field as HTMLInputElement).value),
    ).toEqual(["30", "17.67", "8"]);

    await user.click(screen.getAllByRole("button", { name: "P/FCF Multiple help" })[0]);
    expect(screen.getByText(/Price to Free Cash Flow стойността/)).toBeVisible();
  });

  test("inline historical multiples panel follows the active valuation model", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/valuation/saved") {
          return {
            ok: true,
            json: async () => ({ ok: true, analyses: [] }),
          };
        }

        if (url.startsWith("/api/valuation/autofill")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              input: multipleInput,
              fields: multipleInput.sources,
              warnings: [],
            }),
          };
        }

        throw new Error(`Unexpected fetch ${url}`);
      }),
    );
    const user = userEvent.setup();

    render(<StockValuationPanel />);

    await user.clear(screen.getByLabelText("Ticker"));
    await user.type(screen.getByLabelText("Ticker"), "INTC");
    await user.click(screen.getByRole("button", { name: "Авто попълване" }));
    await waitFor(() => expect(screen.getByDisplayValue("INTC")).toBeVisible());

    await user.click(screen.getByRole("button", { name: /P\/E ·/ }));
    expect(screen.getAllByLabelText("P/E Multiple")).toHaveLength(3);
    await user.click(screen.getAllByRole("button", { name: "P/E Multiple help" })[0]);
    expect(screen.getByText(/P\/E ratio стойността/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Open P/E on FinanceCharts" })).toHaveAttribute(
      "href",
      "https://www.financecharts.com/stocks/INTC/value/pe-ratio",
    );
    await user.click(screen.getByRole("button", { name: /Historical P\/E/ }));
    const pePanel = screen.getByTestId("historical-multiple-panel-peRatio");
    expect(pePanel).toBeVisible();
    expect(screen.queryByRole("dialog", { name: /Historical charts/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("historical-multiple-bar-chart-peRatio")).not.toBeInTheDocument();
    expect(
      within(pePanel).getByRole("link", { name: "Open EV/EBITDA on FinanceCharts" }),
    ).toHaveAttribute("href", "https://www.financecharts.com/stocks/INTC/value/ev-to-ebitda");
    expect(within(pePanel).getByRole("link", { name: "Open P/E on FinanceCharts" })).toHaveAttribute(
      "href",
      "https://www.financecharts.com/stocks/INTC/value/pe-ratio",
    );
    expect(within(pePanel).getByRole("link", { name: "Open P/FCF on FinanceCharts" })).toHaveAttribute(
      "href",
      "https://www.financecharts.com/stocks/INTC/value/price-to-free-cash-flow",
    );

    await user.click(screen.getByRole("button", { name: /EV\/EBITDA ·/ }));
    expect(screen.getAllByLabelText("EV/EBITDA Multiple")).toHaveLength(3);
    await user.click(screen.getAllByRole("button", { name: "EV/EBITDA Multiple help" })[0]);
    expect(screen.getByText(/EV\/EBITDA стойността/)).toBeVisible();
    expect(screen.getByRole("button", { name: /Historical EBITDA/ })).toBeVisible();
    const evPanel = screen.getByTestId("historical-multiple-panel-evToEbitda");
    expect(evPanel).toBeVisible();
    expect(within(evPanel).getByLabelText("Historical EBITDA Year 10")).toHaveValue(500);
    expect(screen.queryByTestId("historical-multiple-line-chart-evToEbitda")).not.toBeInTheDocument();
  });

  test("inline historical EBITDA panel builds editable rows from series fallback without source clutter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/valuation/saved") {
          return {
            ok: true,
            json: async () => ({ ok: true, analyses: [] }),
          };
        }

        if (url.startsWith("/api/valuation/autofill")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              input: seriesOnlyMultipleInput,
              fields: seriesOnlyMultipleInput.sources,
              warnings: [],
            }),
          };
        }

        throw new Error(`Unexpected fetch ${url}`);
      }),
    );
    const user = userEvent.setup();

    render(<StockValuationPanel />);

    await user.clear(screen.getByLabelText("Ticker"));
    await user.type(screen.getByLabelText("Ticker"), "META");
    await user.click(screen.getByRole("button", { name: "Авто попълване" }));
    await waitFor(() => expect(screen.getByDisplayValue("META")).toBeVisible());

    await user.click(screen.getByRole("button", { name: /EV\/EBITDA ·/ }));
    expect(screen.getByRole("button", { name: /Historical EBITDA/ })).toBeVisible();
    expect(screen.queryByText("FinanceCharts data unavailable; HTTP 403.")).not.toBeInTheDocument();
    expect(screen.queryByText("Derived fallback")).not.toBeInTheDocument();
    expect(screen.queryByText("EV/EBITDA avg needs input")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Historical EBITDA/ }));
    const panel = screen.getByTestId("historical-multiple-panel-evToEbitda");
    expect(panel).toBeVisible();
    expect(within(panel).getByLabelText("Historical year Year 10")).toHaveValue(2025);
    expect(within(panel).getByLabelText("Historical EBITDA Year 10")).toHaveValue(100);
    expect(within(panel).getByLabelText("Historical year Year 9")).toHaveValue(2024);
    expect(within(panel).getByLabelText("Historical EBITDA Year 9")).toHaveValue(100);
    expect(within(panel).getByLabelText("Historical year Year 8")).toHaveValue(2023);
    expect(within(panel).getByLabelText("Historical EBITDA Year 8")).toHaveValue(100);
    expect(within(panel).queryByText("Current")).not.toBeInTheDocument();
    expect(within(panel).queryByText("Low")).not.toBeInTheDocument();
    expect(within(panel).queryByText("Apply EV/EBITDA to scenarios")).not.toBeInTheDocument();
  });

  test("inline historical multiples panel labels FinanceCharts benchmark data when available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/valuation/saved") {
          return {
            ok: true,
            json: async () => ({ ok: true, analyses: [] }),
          };
        }

        if (url.startsWith("/api/valuation/autofill")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              input: financeChartsMultipleInput,
              fields: financeChartsMultipleInput.sources,
              warnings: [],
            }),
          };
        }

        throw new Error(`Unexpected fetch ${url}`);
      }),
    );
    const user = userEvent.setup();

    render(<StockValuationPanel />);

    await user.clear(screen.getByLabelText("Ticker"));
    await user.type(screen.getByLabelText("Ticker"), "NVO");
    await user.click(screen.getByRole("button", { name: "Авто попълване" }));
    await waitFor(() => expect(screen.getByDisplayValue("NVO")).toBeVisible());

    await user.click(screen.getByRole("button", { name: /EV\/EBITDA ·/ }));
    await user.click(screen.getByRole("button", { name: /Historical EBITDA/ }));
    const panel = screen.getByTestId("historical-multiple-panel-evToEbitda");

    expect(screen.queryByTestId("historical-multiple-source-evToEbitda")).not.toBeInTheDocument();
    expect(within(panel).queryByText("FinanceCharts")).not.toBeInTheDocument();
    expect(
      within(panel).getByRole("link", { name: "Open EV/EBITDA on FinanceCharts" }),
    ).toHaveAttribute("href", "https://www.financecharts.com/stocks/NVO/value/ev-to-ebitda");
  });
});
