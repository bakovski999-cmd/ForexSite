import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { generateMt5ConnectorToken } from "@/lib/mt5";
import { getMt5SyncRepository } from "@/lib/mt5-repository";

export const runtime = "nodejs";

async function requireStableUserId() {
  const session = await getCurrentSession();

  if (!session?.id) {
    return null;
  }

  return session.id;
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getOrigin(request: Request) {
  return new URL(request.url).origin;
}

function normalizeConnectorName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";

  return name || "MT5 акаунт";
}

export async function GET(request: Request) {
  const userId = await requireStableUserId();

  if (!userId) {
    return NextResponse.json(
      { ok: false, message: "MT5 връзката изисква реален login, не demo режим." },
      { status: 401 },
    );
  }

  try {
    const connectors = await getMt5SyncRepository().listConnectors(userId);
    const origin = getOrigin(request);

    return NextResponse.json({
      ok: true,
      connectors,
      endpointUrl: `${origin}/api/mt5/sync`,
      webRequestUrl: origin,
      downloadUrl: `${origin}/mt5/ForexSiteConnectorEA.mq5`,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "MT5 connectors failed." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const userId = await requireStableUserId();

  if (!userId) {
    return NextResponse.json(
      { ok: false, message: "MT5 връзката изисква реален login, не demo режим." },
      { status: 401 },
    );
  }

  try {
    const body = await readJsonBody(request);
    const token = generateMt5ConnectorToken();
    const connector = await getMt5SyncRepository().createConnector({
      name: normalizeConnectorName(body.name),
      token,
      userId,
    });
    const origin = getOrigin(request);

    return NextResponse.json({
      ok: true,
      connector,
      token,
      endpointUrl: `${origin}/api/mt5/sync`,
      webRequestUrl: origin,
      downloadUrl: `${origin}/mt5/ForexSiteConnectorEA.mq5`,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "MT5 connector create failed." },
      { status: 500 },
    );
  }
}
