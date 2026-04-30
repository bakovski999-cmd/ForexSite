import { describe, expect, test } from "vitest";

import { formatSofiaDateTime } from "@/lib/format";

describe("stable date formatting", () => {
  test("formats Sofia time without locale-specific suffixes", () => {
    expect(formatSofiaDateTime("2026-04-26T14:17:09.165Z")).toBe("26.04.2026, 17:17:09");
    expect(formatSofiaDateTime("2026-04-26T14:17:09.165Z", { seconds: false })).toBe(
      "26.04.2026, 17:17",
    );
  });
});
