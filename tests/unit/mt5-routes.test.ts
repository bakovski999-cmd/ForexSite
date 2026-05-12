import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCurrentSession } from "@/lib/auth";
import { getMt5SyncRepository } from "@/lib/mt5-repository";

const mockedEnv = vi.hoisted(() => ({
  MT5_CONNECTOR_SECRET: "test-secret" as string | undefined,
  MT5_SYNC_LIVE_SECONDS: 30,
  MT5_SYNC_OFFLINE_SECONDS: 300,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: mockedEnv,
  isFirebaseConfigured: false,
  isSupabaseConfigured: false,
}));

vi.mock("@/lib/mt5-repository", () => ({
  getMt5SyncRepository: vi.fn(),
}));

const payload = {
  version: 1,
  sentAt: "2026.05.10 15:10:00",
  terminal: { name: "MetaTrader 5", build: 5120, path: "C:\\MT5" },
  account: {
    login: "28085384",
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

describe("mt5 sync route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedEnv.MT5_CONNECTOR_SECRET = "test-secret";
  });

  test("POST rejects unknown connector tokens before storage", async () => {
    mockedEnv.MT5_CONNECTOR_SECRET = undefined;
    const repository = {
      findConnectorByTokenHash: vi.fn().mockResolvedValue(null),
      saveSnapshot: vi.fn(),
    };
    vi.mocked(getMt5SyncRepository).mockReturnValue(repository as never);
    const { POST } = await import("@/app/api/mt5/sync/route");

    const response = await POST(
      new Request("http://localhost/api/mt5/sync", {
        body: JSON.stringify(payload),
        headers: { Authorization: "Bearer mt5_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    expect(repository.findConnectorByTokenHash).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(repository.saveSnapshot).not.toHaveBeenCalled();
  });

  test("POST stores valid snapshots through the matched user connector", async () => {
    const stored = {
      id: "snapshot-1",
      connectorId: "connector-1",
      userId: "user-1",
      connectionKey: "PUPrime-Live 6:28085384",
      accountLogin: "28085384",
      server: "PUPrime-Live 6",
      receivedAt: "2026-05-10T12:10:00.000Z",
      payload,
    };
    const repository = {
      findConnectorByTokenHash: vi.fn().mockResolvedValue({
        id: "connector-1",
        userId: "user-1",
        name: "PU Prime",
        tokenPreview: "mt5_abc123...9999",
        createdAt: "2026-05-10T12:00:00.000Z",
        updatedAt: "2026-05-10T12:00:00.000Z",
        lastSeenAt: null,
      }),
      markConnectorSeen: vi.fn().mockResolvedValue(undefined),
      saveSnapshot: vi.fn().mockResolvedValue(stored),
    };
    vi.mocked(getMt5SyncRepository).mockReturnValue(repository as never);
    const { POST } = await import("@/app/api/mt5/sync/route");

    const response = await POST(
      new Request("http://localhost/api/mt5/sync", {
        body: JSON.stringify(payload),
        headers: {
          Authorization: "Bearer mt5_abc123456789abcdefabc123456789abcdefabc123456789abcdefabc1234567899999",
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );
    const body = (await response.json()) as {
      ok: boolean;
      connectionKey: string;
      receivedAt: string;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.connectionKey).toBe("PUPrime-Live 6:28085384");
    expect(body.receivedAt).toBe("2026-05-10T12:10:00.000Z");
    expect(repository.saveSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        account: expect.objectContaining({ login: "28085384" }),
      }),
      expect.objectContaining({
        connectorId: "connector-1",
        userId: "user-1",
      }),
    );
    expect(repository.markConnectorSeen).toHaveBeenCalledWith("connector-1", expect.any(Date));
  });

  test("POST rejects invalid token before storage", async () => {
    const repository = { findConnectorByTokenHash: vi.fn(), saveSnapshot: vi.fn() };
    vi.mocked(getMt5SyncRepository).mockReturnValue(repository as never);
    const { POST } = await import("@/app/api/mt5/sync/route");

    const response = await POST(
      new Request("http://localhost/api/mt5/sync", {
        body: JSON.stringify(payload),
        headers: { Authorization: "Bearer wrong" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    expect(repository.findConnectorByTokenHash).not.toHaveBeenCalled();
    expect(repository.saveSnapshot).not.toHaveBeenCalled();
  });

  test("POST rejects invalid payload before storage", async () => {
    const repository = {
      findConnectorByTokenHash: vi.fn().mockResolvedValue({
        id: "connector-1",
        userId: "user-1",
      }),
      saveSnapshot: vi.fn(),
    };
    vi.mocked(getMt5SyncRepository).mockReturnValue(repository as never);
    const { POST } = await import("@/app/api/mt5/sync/route");

    const response = await POST(
      new Request("http://localhost/api/mt5/sync", {
        body: JSON.stringify({ ...payload, account: { ...payload.account, server: "" } }),
        headers: { Authorization: "Bearer test-secret" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(repository.saveSnapshot).not.toHaveBeenCalled();
  });
});

describe("mt5 browser routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedEnv.MT5_CONNECTOR_SECRET = "test-secret";
  });

  test("latest requires an authenticated session", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const { GET } = await import("@/app/api/mt5/latest/route");

    const response = await GET();

    expect(response.status).toBe(401);
  });

  test("latest returns offline for demo sessions without a stable user id", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      email: "demo@goldintel.local",
      mode: "demo",
    });
    const repository = {
      getLatestSnapshot: vi.fn(),
    };
    vi.mocked(getMt5SyncRepository).mockReturnValue(repository as never);
    const { GET } = await import("@/app/api/mt5/latest/route");

    const response = await GET();
    const body = (await response.json()) as { ok: boolean; status: string; snapshot: null };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe("offline");
    expect(body.snapshot).toBeNull();
    expect(repository.getLatestSnapshot).not.toHaveBeenCalled();
  });

  test("latest returns offline when there is no snapshot", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      mode: "firebase",
    });
    vi.mocked(getMt5SyncRepository).mockReturnValue({
      getLatestSnapshot: vi.fn().mockResolvedValue(null),
    } as never);
    const { GET } = await import("@/app/api/mt5/latest/route");

    const response = await GET();
    const body = (await response.json()) as { ok: boolean; status: string; snapshot: null };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe("offline");
    expect(body.snapshot).toBeNull();
    expect(getMt5SyncRepository().getLatestSnapshot).toHaveBeenCalledWith({ userId: "user-1" });
  });

  test("history requires an authenticated session", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const { GET } = await import("@/app/api/mt5/history/route");

    const response = await GET(new Request("http://localhost/api/mt5/history"));

    expect(response.status).toBe(401);
  });

  test("history returns an empty list for demo sessions without a stable user id", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      email: "demo@goldintel.local",
      mode: "demo",
    });
    const repository = {
      getSnapshotHistory: vi.fn(),
    };
    vi.mocked(getMt5SyncRepository).mockReturnValue(repository as never);
    const { GET } = await import("@/app/api/mt5/history/route");

    const response = await GET(new Request("http://localhost/api/mt5/history"));
    const body = (await response.json()) as { ok: boolean; snapshots: unknown[] };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.snapshots).toEqual([]);
    expect(repository.getSnapshotHistory).not.toHaveBeenCalled();
  });
});
