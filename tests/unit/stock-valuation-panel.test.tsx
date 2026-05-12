import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { StockValuationPanel } from "@/components/stock-valuation-panel";
import { buildDefaultStockValuationInput } from "@/lib/stock-valuation";

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
});
