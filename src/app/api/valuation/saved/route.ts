import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { calculateStockValuation, type StockValuationInput } from "@/lib/stock-valuation";
import {
  getStockValuationRepository,
  type SaveStockValuationAnalysisInput,
} from "@/lib/stock-valuation-repository";

export const runtime = "nodejs";

async function requireStableUserId() {
  const session = await getCurrentSession();

  return session?.id ?? null;
}

function parseNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function validateSaveInput(body: unknown): SaveStockValuationAnalysisInput | null {
  const record = body as Record<string, unknown> | null;
  const payload = record?.payload as StockValuationInput | undefined;
  const ticker =
    typeof record?.ticker === "string"
      ? record.ticker
      : typeof payload?.ticker === "string"
        ? payload.ticker
        : "";

  if (!record || !payload || !ticker.trim()) {
    return null;
  }

  const result = calculateStockValuation(payload);

  return {
    ticker,
    companyName:
      typeof record.companyName === "string"
        ? record.companyName
        : typeof payload.companyName === "string"
          ? payload.companyName
          : null,
    title:
      typeof record.title === "string" && record.title.trim()
        ? record.title
        : `${ticker.trim().toUpperCase()} valuation`,
    latestFairValue:
      parseNumber(record.latestFairValue) ?? result.weightedFairValue ?? null,
    currentPrice:
      parseNumber(record.currentPrice) ??
      (typeof payload.currentPrice === "number" ? payload.currentPrice : null),
    payload,
  };
}

export async function GET() {
  const userId = await requireStableUserId();

  if (!userId) {
    return NextResponse.json({ ok: false, error: "Real login is required." }, { status: 401 });
  }

  const analyses = await getStockValuationRepository().listAnalyses(userId);

  return NextResponse.json({ ok: true, analyses });
}

export async function POST(request: Request) {
  const userId = await requireStableUserId();

  if (!userId) {
    return NextResponse.json({ ok: false, error: "Real login is required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const input = validateSaveInput(body);

  if (!input) {
    return NextResponse.json({ ok: false, error: "Invalid valuation payload." }, { status: 400 });
  }

  const analysis = await getStockValuationRepository().createAnalysis(userId, input);

  return NextResponse.json({ ok: true, analysis });
}
