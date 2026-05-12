import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { calculateStockValuation, type StockValuationInput } from "@/lib/stock-valuation";
import {
  getStockValuationRepository,
  type UpdateStockValuationAnalysisInput,
} from "@/lib/stock-valuation-repository";

export const runtime = "nodejs";

type SavedValuationRouteContext = {
  params: Promise<{ id: string }>;
};

async function requireStableUserId() {
  const session = await getCurrentSession();

  return session?.id ?? null;
}

function parseNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function validateUpdateInput(body: unknown): UpdateStockValuationAnalysisInput {
  const record = body as Record<string, unknown> | null;
  const payload = record?.payload as StockValuationInput | undefined;
  const result = payload ? calculateStockValuation(payload) : null;
  const input: UpdateStockValuationAnalysisInput = {};

  if (!record) {
    return input;
  }

  if (typeof record.ticker === "string") {
    input.ticker = record.ticker;
  } else if (payload?.ticker) {
    input.ticker = payload.ticker;
  }
  if (typeof record.companyName === "string") {
    input.companyName = record.companyName;
  } else if (payload?.companyName) {
    input.companyName = payload.companyName;
  }
  if (typeof record.title === "string") {
    input.title = record.title;
  }
  if (record.latestFairValue !== undefined) {
    input.latestFairValue = parseNumber(record.latestFairValue);
  } else if (result) {
    input.latestFairValue = result.weightedFairValue;
  }
  if (record.currentPrice !== undefined) {
    input.currentPrice = parseNumber(record.currentPrice);
  } else if (payload?.currentPrice !== undefined) {
    input.currentPrice = payload.currentPrice;
  }
  if (payload) {
    input.payload = payload;
  }

  return input;
}

export async function PUT(request: Request, context: SavedValuationRouteContext) {
  const userId = await requireStableUserId();

  if (!userId) {
    return NextResponse.json({ ok: false, error: "Real login is required." }, { status: 401 });
  }

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const analysis = await getStockValuationRepository().updateAnalysis(
    userId,
    id,
    validateUpdateInput(body),
  );

  if (!analysis) {
    return NextResponse.json({ ok: false, error: "Saved valuation not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, analysis });
}

export async function DELETE(_request: Request, context: SavedValuationRouteContext) {
  const userId = await requireStableUserId();

  if (!userId) {
    return NextResponse.json({ ok: false, error: "Real login is required." }, { status: 401 });
  }

  const { id } = await context.params;
  const deleted = await getStockValuationRepository().deleteAnalysis(userId, id);

  return NextResponse.json({ ok: true, deleted });
}
