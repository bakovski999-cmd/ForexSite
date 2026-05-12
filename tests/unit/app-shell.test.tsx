import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { AppShell } from "@/components/app-shell";
import type { SourceHealth, UserSession } from "@/lib/types";

const usePathnameMock = vi.fn(() => "/overview");

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
  usePathname: () => usePathnameMock(),
}));

const session: UserSession = {
  email: "demo@goldintel.local",
  id: "demo",
};

const health: SourceHealth = {
  isLive: false,
  label: "Няма live",
  reason: "test",
  updatedAt: null,
};

const staleFlags = {
  alphaVantage: health,
  cftc: { ...health, isLive: true, label: "На живо" },
  fred: health,
  gdelt: health,
  openai: health,
};

afterEach(() => {
  cleanup();
  usePathnameMock.mockReturnValue("/overview");
});

describe("AppShell", () => {
  test("uses a wider dashboard container on the valuation page", () => {
    usePathnameMock.mockReturnValue("/valuation");

    render(
      <AppShell
        generatedAt="2026-05-12T06:00:00.000Z"
        session={session}
        staleFlags={staleFlags}
      >
        <div>valuation body</div>
      </AppShell>,
    );

    expect(screen.getByTestId("dashboard-shell-frame")).toHaveAttribute(
      "data-layout",
      "valuation-wide",
    );
  });
});
