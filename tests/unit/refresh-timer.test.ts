import { describe, expect, test } from "vitest";

import {
  AUTO_REFRESH_SECONDS,
  formatRefreshCountdown,
  getInitialAutoRefreshSeconds,
} from "@/lib/refresh-timer";

describe("refresh timer helpers", () => {
  test("formats countdown values as minutes and seconds", () => {
    expect(formatRefreshCountdown(AUTO_REFRESH_SECONDS)).toBe("5:00");
    expect(formatRefreshCountdown(125)).toBe("2:05");
    expect(formatRefreshCountdown(0)).toBe("0:00");
  });

  test("starts immediately when the snapshot is older than five minutes", () => {
    const now = Date.parse("2026-04-27T12:05:01.000Z");

    expect(getInitialAutoRefreshSeconds("2026-04-27T12:00:00.000Z", now)).toBe(0);
    expect(getInitialAutoRefreshSeconds("2026-04-27T12:03:00.000Z", now)).toBe(179);
  });
});
