import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import {
  getDashboardSnapshot,
  getRefreshCooldownState,
  syncDashboardSnapshot,
} from "@/lib/data/sync";

export const runtime = "nodejs";

export async function POST() {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ message: "Неоторизиран refresh." }, { status: 401 });
  }

  try {
    const current = await getDashboardSnapshot();
    const cooldown = getRefreshCooldownState(current);

    if (cooldown.locked) {
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

    const snapshot = await syncDashboardSnapshot();
    return NextResponse.json({
      ok: true,
      generatedAt: snapshot.generatedAt,
      message: "Данните са обновени.",
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Refresh failed." },
      { status: 500 },
    );
  }
}
