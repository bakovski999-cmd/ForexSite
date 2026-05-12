import { describe, expect, test } from "vitest";

import {
  buildMt5ConnectionKey,
  calculateMt5ConnectionStatus,
  parseMt5SnapshotPayload,
} from "@/lib/mt5";

const validPayload = {
  version: 1,
  sentAt: "2026.05.10 15:10:00",
  terminal: {
    name: "MetaTrader 5",
    build: 5120,
    path: "C:\\MT5",
  },
  account: {
    login: 28085384,
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
      ticket: 123456,
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
      magic: 0,
      comment: "",
      openTime: "2026.05.10 14:00:00",
    },
  ],
  historyDeals: [
    {
      ticket: 987,
      orderTicket: 986,
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
};

describe("mt5 snapshot parsing", () => {
  test("normalizes account login and derives connection key", () => {
    const parsed = parseMt5SnapshotPayload(validPayload);

    expect(parsed.account.login).toBe("28085384");
    expect(parsed.positions).toHaveLength(1);
    expect(parsed.historyDeals).toHaveLength(1);
    expect(buildMt5ConnectionKey(parsed)).toBe("PUPrime-Live 6:28085384");
  });

  test("accepts optional symbol metadata from the MT5 connector", () => {
    const parsed = parseMt5SnapshotPayload({
      ...validPayload,
      positions: [
        {
          ...validPayload.positions[0],
          contractSize: 1,
          currencyProfit: "usd",
          currencyMargin: "eur",
          tickSize: 0.01,
          tickValue: 0.01,
        },
      ],
    });

    expect(parsed.positions[0].contractSize).toBe(1);
    expect(parsed.positions[0].currencyProfit).toBe("USD");
    expect(parsed.positions[0].currencyMargin).toBe("EUR");
    expect(parsed.positions[0].tickSize).toBe(0.01);
    expect(parsed.positions[0].tickValue).toBe(0.01);
  });

  test("rejects invalid payloads before storage", () => {
    const result = parseMt5SnapshotPayload.safeParse({
      version: 1,
      account: {
        login: "",
        server: "",
        currency: "EUR",
        balance: Number.NaN,
      },
      positions: [],
      historyDeals: [],
    });

    expect(result.success).toBe(false);
  });
});

describe("mt5 connection status", () => {
  test("reports live stale and offline using configured thresholds", () => {
    const now = new Date("2026-05-10T12:00:00.000Z");

    expect(
      calculateMt5ConnectionStatus("2026-05-10T11:59:45.000Z", now, {
        liveSeconds: 30,
        offlineSeconds: 300,
      }),
    ).toBe("live");
    expect(
      calculateMt5ConnectionStatus("2026-05-10T11:57:00.000Z", now, {
        liveSeconds: 30,
        offlineSeconds: 300,
      }),
    ).toBe("stale");
    expect(
      calculateMt5ConnectionStatus("2026-05-10T11:50:00.000Z", now, {
        liveSeconds: 30,
        offlineSeconds: 300,
      }),
    ).toBe("offline");
    expect(
      calculateMt5ConnectionStatus(null, now, {
        liveSeconds: 30,
        offlineSeconds: 300,
      }),
    ).toBe("offline");
  });
});
