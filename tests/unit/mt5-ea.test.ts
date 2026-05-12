import { describe, expect, test } from "vitest";

import { buildMt5EaSource } from "@/lib/mt5-ea";

describe("MT5 EA source generator", () => {
  test("embeds the site endpoint and one-time token in the downloadable EA", () => {
    const source = buildMt5EaSource({
      endpointUrl: "https://forex-site-chi.vercel.app/api/mt5/sync",
      secretToken: "mt5_test_token",
    });

    expect(source).toContain(
      'input string EndpointUrl = "https://forex-site-chi.vercel.app/api/mt5/sync";',
    );
    expect(source).toContain('input string SecretToken = "mt5_test_token";');
    expect(source).toContain("input int SyncIntervalSeconds = 10;");
    expect(source).toContain("input int HistoryDays = 30;");
    expect(source).not.toContain("localhost:3000");
  });
});
