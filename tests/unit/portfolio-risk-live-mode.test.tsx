import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { PortfolioRiskManager } from "@/components/portfolio-risk-manager";
import type { Mt5LatestResponse } from "@/lib/mt5";
import { getDefaultAccountRiskProfile, type SavedPortfolioPosition } from "@/lib/portfolio-risk";

const liveLatest: Mt5LatestResponse = {
  ok: true,
  status: "live",
  liveSeconds: 30,
  offlineSeconds: 300,
  now: "2026-05-10T16:12:00.000Z",
  snapshot: {
    id: "snapshot-1",
    connectionKey: "PUPrime-Live 6:28085384",
    accountLogin: "28085384",
    server: "PUPrime-Live 6",
    receivedAt: "2026-05-10T16:11:46.000Z",
    payload: {
      version: 1,
      sentAt: "2026.05.10 19:11:40",
      terminal: { name: "MetaTrader 5", build: 5834, path: "C:\\MT5" },
      account: {
        login: "28085384",
        server: "PUPrime-Live 6",
        broker: "PU Prime",
        company: "PU Prime Ltd",
        currency: "EUR",
        balance: 974,
        equity: 1844.94,
        margin: 4.15,
        freeMargin: 1840.79,
        marginLevel: 44456.39,
        leverage: 500,
        profit: -3.06,
      },
      positions: [
        {
          ticket: "43088356",
          symbol: "SOFI",
          type: "buy",
          volume: 6,
          openPrice: 16.3,
          currentPrice: 15.71,
          stopLoss: 0,
          takeProfit: 30.06,
          profit: -3.06,
          swap: 0,
          commission: 0,
          magic: "0",
          comment: "",
          openTime: "2026.05.06 16:47:10",
          contractSize: 1,
          currencyProfit: "USD",
          currencyMargin: "EUR",
        },
      ],
      historyDeals: [],
    },
  },
};

const legacyManualPosition: SavedPortfolioPosition = {
  id: "legacy-sofi-copy",
  symbol: "OLD",
  direction: "buy",
  entryPrice: 1,
  currentPrice: 1,
  quantity: 1,
  instrumentCurrency: "USD",
  scenarioSource: null,
};

const manualPlanPosition: SavedPortfolioPosition = {
  id: "plan-meta",
  symbol: "META",
  direction: "buy",
  entryPrice: 500,
  currentPrice: 500,
  quantity: 2,
  instrumentCurrency: "USD",
  scenarioSource: "manual_plan",
};

function mockFetch(
  latest: Mt5LatestResponse = liveLatest,
  savedPositions: SavedPortfolioPosition[] = [],
) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/portfolio-risk") {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            profile: getDefaultAccountRiskProfile(),
            positions: savedPositions,
          }),
        };
      }

      if (url === "/api/mt5/latest") {
        return {
          ok: true,
          json: async () => latest,
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

describe("PortfolioRiskManager live MT5 mode", () => {
  test("keeps manual mode as the default editable portfolio", async () => {
    mockFetch(liveLatest, [manualPlanPosition]);

    render(<PortfolioRiskManager />);

    expect(await screen.findByRole("button", { name: "Ръчен" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Live MT5" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Нова позиция/ })).toBeVisible();
    expect(await screen.findByText("Real MT5")).toBeVisible();
    expect(screen.getByText("Plan")).toBeVisible();
    expect(screen.getByText("META")).toBeVisible();
    expect(screen.getAllByText("€1,844.94").length).toBeGreaterThan(0);
  });

  test("manual mode uses live MT5 as baseline and hides legacy manual rows", async () => {
    mockFetch(liveLatest, [legacyManualPosition]);

    render(<PortfolioRiskManager />);

    expect(await screen.findByText("Real MT5")).toBeVisible();
    expect(screen.getByText("SOFI")).toBeVisible();
    expect(screen.queryByText("OLD")).not.toBeInTheDocument();
    expect(screen.getAllByText("€1,844.94").length).toBeGreaterThan(0);
    expect(screen.getAllByText("€1,840.79").length).toBeGreaterThan(0);
    expect(screen.getAllByText("€4.15").length).toBeGreaterThan(0);
  });

  test("renders live MT5 positions as read-only portfolio risk data", async () => {
    mockFetch(liveLatest, [manualPlanPosition]);
    const user = userEvent.setup();

    render(<PortfolioRiskManager mode="live" onModeChange={vi.fn()} />);

    expect(await screen.findByRole("button", { name: "Live MT5" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect((await screen.findAllByText("SOFI")).length).toBeGreaterThan(0);
    expect(screen.getByText(/PUPrime-Live 6/)).toBeVisible();
    expect(screen.getByText("MT5 live")).toBeVisible();
    expect(screen.getByText(/\$15\.71/)).toBeVisible();
    expect(screen.getAllByText("€1,844.94").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Нова позиция/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Лот/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Продай/ })).not.toBeInTheDocument();
    expect(screen.queryByText("META")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Stress test" }));
    await waitFor(() => expect(screen.getByText(/Uniform Drop/)).toBeVisible());
  });

  test("manual plan rows are editable while real MT5 rows stay read-only", async () => {
    mockFetch(liveLatest, [manualPlanPosition]);

    render(<PortfolioRiskManager />);

    expect(await screen.findByText("Real MT5")).toBeVisible();
    expect(screen.getByText("Plan")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Редактирай SOFI/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Редактирай META/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Изтрий META/ })).toBeVisible();
  });

  test("positions panel avoids desktop horizontal scrolling", async () => {
    mockFetch(liveLatest, [manualPlanPosition]);
    const { container } = render(<PortfolioRiskManager />);

    expect(await screen.findByText("Real MT5")).toBeVisible();
    expect(container.querySelector(".overflow-x-auto")).not.toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
  });

  test("shows a setup prompt when live mode has no MT5 snapshot", async () => {
    mockFetch({
      ok: true,
      status: "offline",
      liveSeconds: 30,
      offlineSeconds: 300,
      now: "2026-05-10T16:12:00.000Z",
      snapshot: null,
    });

    render(<PortfolioRiskManager mode="live" onModeChange={vi.fn()} onOpenMt5Setup={vi.fn()} />);

    expect(await screen.findByText("MT5 Live не е свързан")).toBeVisible();
    expect(screen.getByRole("button", { name: "Отвори MT5 Live настройките" })).toBeVisible();
  });
});
