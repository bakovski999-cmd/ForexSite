import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCurrentSession } from "@/lib/auth";
import { getMt5SyncRepository } from "@/lib/mt5-repository";

vi.mock("@/lib/auth", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/mt5-repository", () => ({
  getMt5SyncRepository: vi.fn(),
}));

describe("mt5 connectors route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("GET requires authenticated user with stable id", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      email: "demo@goldintel.local",
      mode: "demo",
    });
    const { GET } = await import("@/app/api/mt5/connectors/route");

    const response = await GET(new Request("https://example.test/api/mt5/connectors"));

    expect(response.status).toBe(401);
  });

  test("POST creates a connector and returns setup fields for the current origin", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      mode: "supabase",
    });
    const repository = {
      createConnector: vi.fn().mockImplementation(async ({ token, userId, name }) => ({
        id: "connector-1",
        userId,
        name,
        tokenPreview: `${token.slice(0, 10)}...${token.slice(-4)}`,
        createdAt: "2026-05-10T12:00:00.000Z",
        updatedAt: "2026-05-10T12:00:00.000Z",
        lastSeenAt: null,
      })),
    };
    vi.mocked(getMt5SyncRepository).mockReturnValue(repository as never);
    const { POST } = await import("@/app/api/mt5/connectors/route");

    const response = await POST(
      new Request("https://forex-site-chi.vercel.app/api/mt5/connectors", {
        body: JSON.stringify({ name: "PU Prime Live" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
    const body = (await response.json()) as {
      ok: boolean;
      token: string;
      endpointUrl: string;
      webRequestUrl: string;
      downloadUrl: string;
      connector: { id: string; name: string };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.token).toMatch(/^mt5_[a-f0-9]{64}$/);
    expect(body.endpointUrl).toBe("https://forex-site-chi.vercel.app/api/mt5/sync");
    expect(body.webRequestUrl).toBe("https://forex-site-chi.vercel.app");
    expect(body.downloadUrl).toBe("https://forex-site-chi.vercel.app/mt5/ForexSiteConnectorEA.mq5");
    expect(body.connector).toMatchObject({ id: "connector-1", name: "PU Prime Live" });
    expect(repository.createConnector).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "PU Prime Live",
        token: expect.stringMatching(/^mt5_[a-f0-9]{64}$/),
        userId: "user-1",
      }),
    );
  });
});
