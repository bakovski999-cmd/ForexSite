import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { getMt5SyncRepository } from "@/lib/mt5-repository";

export const runtime = "nodejs";

function readLimit(request: Request) {
  const value = new URL(request.url).searchParams.get("limit");
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 50;
}

export async function GET(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ ok: false, message: "Неоторизиран MT5 достъп." }, { status: 401 });
  }

  if (!session.id) {
    return NextResponse.json({
      ok: true,
      snapshots: [],
    });
  }

  try {
    const snapshots = await getMt5SyncRepository().getSnapshotHistory({
      limit: readLimit(request),
      userId: session.id,
    });

    return NextResponse.json({
      ok: true,
      snapshots,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "MT5 history failed." },
      { status: 500 },
    );
  }
}
