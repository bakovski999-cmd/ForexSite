import { beforeEach, describe, expect, test } from "vitest";

import {
  createMemoryMt5SyncRepository,
  resetMt5MemoryStoreForTests,
} from "@/lib/mt5-repository";
import type { Mt5SnapshotPayload } from "@/lib/mt5";

function snapshot(login: string, sentAt: string): Mt5SnapshotPayload {
  return {
    version: 1,
    sentAt,
    terminal: { name: "MetaTrader 5", build: 5120, path: "C:\\MT5" },
    account: {
      login,
      server: "PUPrime-Live 6",
      broker: "PU Prime",
      company: "PU Prime Ltd",
      currency: "EUR",
      balance: 2000,
      equity: 2000,
      margin: 0,
      freeMargin: 2000,
      marginLevel: 0,
      leverage: 500,
      profit: 0,
    },
    positions: [],
    historyDeals: [],
  };
}

describe("memory MT5 repository", () => {
  beforeEach(() => {
    resetMt5MemoryStoreForTests();
  });

  test("stores latest snapshot and keeps full history", async () => {
    const repository = createMemoryMt5SyncRepository();

    await repository.saveSnapshot(snapshot("28085384", "2026.05.10 15:00:00"), {
      receivedAt: new Date("2026-05-10T12:00:00.000Z"),
    });
    await repository.saveSnapshot(snapshot("28085384", "2026.05.10 15:00:10"), {
      receivedAt: new Date("2026-05-10T12:00:10.000Z"),
    });

    const latest = await repository.getLatestSnapshot();
    const history = await repository.getSnapshotHistory({ limit: 10 });

    expect(latest?.receivedAt).toBe("2026-05-10T12:00:10.000Z");
    expect(latest?.payload.sentAt).toBe("2026.05.10 15:00:10");
    expect(history).toHaveLength(2);
    expect(history.map((item) => item.receivedAt)).toEqual([
      "2026-05-10T12:00:10.000Z",
      "2026-05-10T12:00:00.000Z",
    ]);
  });
});
