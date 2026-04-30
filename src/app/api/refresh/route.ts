import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { getPendingReleasedCalendarEvents } from "@/lib/calendar-history";
import {
  getDashboardSnapshot,
  getRefreshCooldownState,
  syncDashboardSnapshot,
} from "@/lib/data/sync";

export const runtime = "nodejs";

async function readRefreshMode(request: Request) {
  try {
    const payload = (await request.json()) as { mode?: string };
    return payload.mode;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ message: "Неоторизиран refresh." }, { status: 401 });
  }

  try {
    const mode = await readRefreshMode(request);
    const current = await getDashboardSnapshot();
    const cooldown = getRefreshCooldownState(current);
    const isCalendarReleaseRefresh =
      mode === "calendar-release" &&
      getPendingReleasedCalendarEvents(current.calendarEvents ?? []).length > 0;

    if (cooldown.locked && !isCalendarReleaseRefresh) {
      return NextResponse.json(
        {
          ok: false,
          message: `Изчакай още ${Math.ceil(cooldown.retryAfterSeconds / 60)} мин. преди следващ refresh.`,
          retryAfterSeconds: cooldown.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(cooldown.retryAfterSeconds),
          },
        },
      );
    }

    const snapshot = await syncDashboardSnapshot({ force: isCalendarReleaseRefresh });
    return NextResponse.json({
      ok: true,
      generatedAt: snapshot.generatedAt,
      message: isCalendarReleaseRefresh
        ? "Календарът провери за публикувани стойности."
        : "Данните са обновени.",
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Refresh failed." },
      { status: 500 },
    );
  }
}
