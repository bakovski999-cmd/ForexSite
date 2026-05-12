import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { calculateMt5ConnectionStatus } from "@/lib/mt5";
import { getMt5SyncRepository } from "@/lib/mt5-repository";

export const runtime = "nodejs";

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ ok: false, message: "Неоторизиран MT5 достъп." }, { status: 401 });
  }

  try {
    const now = new Date();
    const thresholds = {
      liveSeconds: env.MT5_SYNC_LIVE_SECONDS,
      offlineSeconds: env.MT5_SYNC_OFFLINE_SECONDS,
    };
    const snapshot = session.id
      ? await getMt5SyncRepository().getLatestSnapshot({ userId: session.id })
      : null;

    return NextResponse.json({
      ok: true,
      status: calculateMt5ConnectionStatus(snapshot?.receivedAt, now, thresholds),
      liveSeconds: thresholds.liveSeconds,
      offlineSeconds: thresholds.offlineSeconds,
      now: now.toISOString(),
      snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "MT5 latest failed." },
      { status: 500 },
    );
  }
}
