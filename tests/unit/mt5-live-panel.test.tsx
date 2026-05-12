import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { Mt5LivePanel } from "@/components/mt5-live-panel";
import type { Mt5ConnectorsResponse, Mt5CreatedConnectorResponse, Mt5LatestResponse } from "@/lib/mt5";

function mockApiResponses({
  connectors,
  createdConnector,
  latest,
}: {
  connectors?: Mt5ConnectorsResponse & {
    endpointUrl?: string;
    webRequestUrl?: string;
    downloadUrl?: string;
  };
  createdConnector?: Mt5CreatedConnectorResponse;
  latest: Mt5LatestResponse;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/mt5/latest") {
        return {
          ok: true,
          json: async () => latest,
        };
      }

      if (url === "/api/mt5/connectors" && init?.method === "POST" && createdConnector) {
        return {
          ok: true,
          json: async () => createdConnector,
        };
      }

      if (url === "/api/mt5/connectors") {
        return {
          ok: true,
          json: async () =>
            connectors ?? {
              ok: true,
              connectors: [],
              endpointUrl: "https://forex-site-chi.vercel.app/api/mt5/sync",
              webRequestUrl: "https://forex-site-chi.vercel.app",
              downloadUrl: "https://forex-site-chi.vercel.app/mt5/ForexSiteConnectorEA.mq5",
            },
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

describe("Mt5LivePanel", () => {
  test("renders offline state when no MT5 snapshot exists", async () => {
    mockApiResponses({
      latest: {
        ok: true,
        status: "offline",
        liveSeconds: 30,
        offlineSeconds: 300,
        now: "2026-05-10T12:00:00.000Z",
        snapshot: null,
      },
    });

    render(<Mt5LivePanel />);

    expect(await screen.findByText("MT5 offline")).toBeVisible();
    expect(await screen.findByText("Няма получен MT5 snapshot.")).toBeVisible();
  });

  test("renders connection status without account metrics or open positions from latest snapshot", async () => {
    mockApiResponses({
      connectors: {
        ok: true,
        connectors: [
          {
            id: "connector-1",
            userId: "user-1",
            name: "PU Prime",
            tokenPreview: "mt5_abc123...9999",
            createdAt: "2026-05-10T12:00:00.000Z",
            updatedAt: "2026-05-10T12:00:00.000Z",
            lastSeenAt: "2026-05-10T12:00:00.000Z",
          },
        ],
        endpointUrl: "https://forex-site-chi.vercel.app/api/mt5/sync",
        webRequestUrl: "https://forex-site-chi.vercel.app",
        downloadUrl: "https://forex-site-chi.vercel.app/mt5/ForexSiteConnectorEA.mq5",
      },
      latest: {
        ok: true,
        status: "live",
        liveSeconds: 30,
        offlineSeconds: 300,
        now: "2026-05-10T12:00:10.000Z",
        snapshot: {
        id: "snapshot-1",
        connectionKey: "PUPrime-Live 6:28085384",
        accountLogin: "28085384",
        server: "PUPrime-Live 6",
        receivedAt: "2026-05-10T12:00:00.000Z",
        payload: {
          version: 1,
          sentAt: "2026.05.10 15:00:00",
          terminal: { name: "MetaTrader 5", build: 5120, path: "C:\\MT5" },
          account: {
            login: "28085384",
            server: "PUPrime-Live 6",
            broker: "PU Prime",
            company: "PU Prime Ltd",
            currency: "EUR",
            balance: 2000,
            equity: 2034.5,
            margin: 120,
            freeMargin: 1914.5,
            marginLevel: 1695.41,
            leverage: 500,
            profit: 34.5,
          },
          positions: [
            {
              ticket: "123456",
              symbol: "XAUUSD",
              type: "buy",
              volume: 0.02,
              openPrice: 2320.5,
              currentPrice: 2331.2,
              stopLoss: 0,
              takeProfit: 0,
              profit: 21.4,
              swap: -0.2,
              commission: 0,
              magic: "0",
              comment: "",
              openTime: "2026.05.10 14:00:00",
            },
          ],
          historyDeals: [
            {
              ticket: "987",
              orderTicket: "986",
              symbol: "XAUUSD",
              type: "sell",
              entry: "out",
              volume: 0.01,
              price: 2330,
              profit: 12.3,
              swap: 0,
              commission: -0.1,
              time: "2026.05.10 14:30:00",
            },
          ],
        },
      },
      },
    });

    const openLiveAnalysis = vi.fn();
    render(<Mt5LivePanel onOpenLiveAnalysis={openLiveAnalysis} />);

    expect(await screen.findByText("MT5 live")).toBeVisible();
    expect(screen.getByText("PUPrime-Live 6")).toBeVisible();
    expect(screen.getByText("****5384")).toBeVisible();
    expect(screen.queryByText("$2,000.00")).not.toBeInTheDocument();
    expect(screen.queryByText("Balance")).not.toBeInTheDocument();
    expect(screen.queryByText("Open positions")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent history deals")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Виж Live анализа" }));
    expect(openLiveAnalysis).toHaveBeenCalledTimes(1);
  });

  test("creates a connector from the simplified setup wizard", async () => {
    const user = userEvent.setup();
    mockApiResponses({
      createdConnector: {
        ok: true,
        connector: {
          id: "connector-1",
          userId: "user-1",
          name: "MT5 акаунт",
          tokenPreview: "mt5_abc123...9999",
          createdAt: "2026-05-10T12:00:00.000Z",
          updatedAt: "2026-05-10T12:00:00.000Z",
          lastSeenAt: null,
        },
        token: "mt5_abc123456789abcdefabc123456789abcdefabc123456789abcdefabc1234567899999",
        endpointUrl: "https://forex-site-chi.vercel.app/api/mt5/sync",
        webRequestUrl: "https://forex-site-chi.vercel.app",
        downloadUrl: "https://forex-site-chi.vercel.app/mt5/ForexSiteConnectorEA.mq5",
      },
      latest: {
        ok: true,
        status: "offline",
        liveSeconds: 30,
        offlineSeconds: 300,
        now: "2026-05-10T12:00:00.000Z",
        snapshot: null,
      },
    });

    render(<Mt5LivePanel />);

    await user.click(await screen.findByRole("button", { name: "Свържи MT5 акаунт" }));

    expect(await screen.findByText("Готов EA файл за MT5")).toBeVisible();
    expect(screen.getByText("4 лесни стъпки")).toBeVisible();
    expect(screen.getByText("Свали готовия файл")).toBeVisible();
    expect(screen.getByText("Разреши WebRequest")).toBeVisible();
    expect(screen.getByText("Refresh и double-click")).toBeVisible();
    expect(screen.getByText("Гледай MT5 live")).toBeVisible();
    expect(screen.getByText("https://forex-site-chi.vercel.app/api/mt5/sync")).toBeVisible();
    expect(
      screen.getByText("mt5_abc123456789abcdefabc123456789abcdefabc123456789abcdefabc1234567899999"),
    ).toBeVisible();
    const downloadLink = screen.getByRole("link", { name: "Download Ready MT5 Connector" });
    const href = downloadLink.getAttribute("href") ?? "";

    expect(downloadLink).toHaveAttribute("download", "ForexSiteConnectorEA.mq5");
    expect(decodeURIComponent(href)).toContain(
      'input string EndpointUrl = "https://forex-site-chi.vercel.app/api/mt5/sync";',
    );
    expect(decodeURIComponent(href)).toContain(
      'input string SecretToken = "mt5_abc123456789abcdefabc123456789abcdefabc123456789abcdefabc1234567899999";',
    );
  });
});
