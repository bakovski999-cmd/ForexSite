import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { hashMt5ConnectorToken, parseMt5SnapshotPayload } from "@/lib/mt5";
import { getMt5SyncRepository } from "@/lib/mt5-repository";

export const runtime = "nodejs";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const token = getBearerToken(request);
  const repository = getMt5SyncRepository();
  let connector: Awaited<ReturnType<typeof repository.findConnectorByTokenHash>> = null;

  if (!token) {
    return NextResponse.json({ ok: false, message: "Unauthorized MT5 sync." }, { status: 401 });
  }

  if (env.MT5_CONNECTOR_SECRET && token === env.MT5_CONNECTOR_SECRET) {
    connector = null;
  } else if (token.startsWith("mt5_")) {
    connector = await repository.findConnectorByTokenHash(hashMt5ConnectorToken(token));

    if (!connector) {
      return NextResponse.json({ ok: false, message: "Unauthorized MT5 sync." }, { status: 401 });
    }
  } else {
    return NextResponse.json({ ok: false, message: "Unauthorized MT5 sync." }, { status: 401 });
  }

  const parsed = parseMt5SnapshotPayload.safeParse(await readJsonBody(request));

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid MT5 snapshot payload.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const receivedAt = new Date();
    const snapshot = await repository.saveSnapshot(parsed.data, {
      connectorId: connector?.id ?? null,
      receivedAt,
      userId: connector?.userId ?? null,
    });

    if (connector) {
      await repository.markConnectorSeen(connector.id, receivedAt);
    }

    return NextResponse.json({
      ok: true,
      connectionKey: snapshot.connectionKey,
      accountLogin: snapshot.accountLogin,
      server: snapshot.server,
      receivedAt: snapshot.receivedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "MT5 sync failed." },
      { status: 500 },
    );
  }
}
