import { NextResponse } from "next/server";

import { syncDashboardSnapshot } from "@/lib/data/sync";
import { env } from "@/lib/env";

export const runtime = "nodejs";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export async function POST(request: Request) {
  if (!env.APP_SYNC_SECRET) {
    return NextResponse.json(
      { ok: false, message: "APP_SYNC_SECRET is not configured." },
      { status: 503 },
    );
  }

  const token = getBearerToken(request) ?? request.headers.get("x-sync-secret");

  if (token !== env.APP_SYNC_SECRET) {
    return NextResponse.json({ ok: false, message: "Unauthorized sync." }, { status: 401 });
  }

  try {
    const snapshot = await syncDashboardSnapshot({ force: true });

    return NextResponse.json({
      ok: true,
      generatedAt: snapshot.generatedAt,
      signal: {
        bias: snapshot.signal.bias,
        bullishProbability: snapshot.signal.bullishProbability,
      },
      staleFlags: snapshot.staleFlags,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Sync failed.",
      },
      { status: 500 },
    );
  }
}
