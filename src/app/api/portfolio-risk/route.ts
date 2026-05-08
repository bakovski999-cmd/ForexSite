import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import {
  createSavedPosition,
  deleteSavedPosition,
  loadPortfolioRiskData,
  saveAccountRiskProfile,
  updateSavedPosition,
} from "@/lib/portfolio-risk-repository";
import type { AccountRiskProfile, PortfolioDirection, SavedPortfolioPosition } from "@/lib/portfolio-risk";

export const runtime = "nodejs";

type ProfilePayload = Partial<AccountRiskProfile>;
type PositionPayload = Partial<SavedPortfolioPosition> & {
  plannedExitPrice?: number;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

async function requirePortfolioUserId() {
  const session = await getCurrentSession();

  if (!session?.id || session.mode === "demo") {
    return null;
  }

  return session.id;
}

function toNumber(value: unknown, fallback = Number.NaN) {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function toDirection(value: unknown): PortfolioDirection {
  return String(value).toLowerCase() === "sell" ? "sell" : "buy";
}

function readProfile(payload: unknown) {
  const profile = (payload ?? {}) as ProfilePayload;

  return {
    id: typeof profile.id === "string" ? profile.id : null,
    accountName: String(profile.accountName ?? "Основен CFD акаунт"),
    brokerName: String(profile.brokerName ?? "PU Prime"),
    accountCurrency: String(profile.accountCurrency ?? "EUR").toUpperCase(),
    balance: toNumber(profile.balance, 0),
    addedFundsSimulation: toNumber(profile.addedFundsSimulation, 0),
    stopOutLevelPercent: toNumber(profile.stopOutLevelPercent, 20),
    marginCallLevelPercent: toNumber(profile.marginCallLevelPercent, 50),
    normalFixedLeverage: toNumber(profile.normalFixedLeverage, 20),
    temporaryFixedLeverage: toNumber(profile.temporaryFixedLeverage, 5),
    fxRateInstrumentToAccount: toNumber(profile.fxRateInstrumentToAccount, 0.85),
  };
}

function readPosition(payload: unknown) {
  const position = (payload ?? {}) as PositionPayload;

  return {
    id: typeof position.id === "string" ? position.id : undefined,
    symbol: String(position.symbol ?? "").trim().toUpperCase(),
    assetName: position.assetName ? String(position.assetName) : null,
    direction: toDirection(position.direction),
    entryPrice: toNumber(position.entryPrice),
    currentPrice: toOptionalNumber(position.currentPrice),
    quantity: toNumber(position.quantity),
    instrumentCurrency: String(position.instrumentCurrency ?? "USD").toUpperCase(),
    normalFixedLeverage: toOptionalNumber(position.normalFixedLeverage),
    temporaryFixedLeverage: toOptionalNumber(position.temporaryFixedLeverage),
    notes: position.notes ? String(position.notes) : null,
  };
}

function validatePosition(position: ReturnType<typeof readPosition>) {
  const errors: string[] = [];

  if (!position.symbol.trim()) {
    errors.push("Попълни символ.");
  }

  if (!Number.isFinite(position.entryPrice) || position.entryPrice <= 0) {
    errors.push("Цената на вход трябва да е положително число.");
  }

  if (position.currentPrice !== null && (!Number.isFinite(position.currentPrice) || position.currentPrice <= 0)) {
    errors.push("Текущата цена трябва да е положително число или празна.");
  }

  if (!Number.isFinite(position.quantity) || position.quantity <= 0) {
    errors.push("Броят акции трябва да е положително число.");
  }

  if (
    position.normalFixedLeverage !== null &&
    (!Number.isFinite(position.normalFixedLeverage) || position.normalFixedLeverage <= 0)
  ) {
    errors.push("Нормалният leverage трябва да е положително число или празен.");
  }

  if (
    position.temporaryFixedLeverage !== null &&
    (!Number.isFinite(position.temporaryFixedLeverage) || position.temporaryFixedLeverage <= 0)
  ) {
    errors.push("Временният leverage трябва да е положително число или празен.");
  }

  return errors;
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizeDatabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("account_risk_profiles") ||
    message.includes("saved_positions") ||
    message.includes("relation")
  ) {
    return "Supabase таблиците за Portfolio Risk Manager още не са приложени. Стартирай SQL миграцията от supabase/schema.sql.";
  }

  return message || "Portfolio risk request failed.";
}

export async function GET() {
  const userId = await requirePortfolioUserId();

  if (!userId) {
    return jsonError("Портфолио рискът изисква Supabase/Firebase login със стабилен user id.", 401);
  }

  try {
    const data = await loadPortfolioRiskData(userId);
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    return jsonError(normalizeDatabaseError(error), 500);
  }
}

export async function PUT(request: Request) {
  const userId = await requirePortfolioUserId();

  if (!userId) {
    return jsonError("Неоторизиран достъп.", 401);
  }

  try {
    const body = await readJsonBody(request);
    const profile = await saveAccountRiskProfile(userId, readProfile(body.profile));
    const data = await loadPortfolioRiskData(userId);

    return NextResponse.json({ ok: true, profile, positions: data.positions });
  } catch (error) {
    return jsonError(normalizeDatabaseError(error), 500);
  }
}

export async function POST(request: Request) {
  const userId = await requirePortfolioUserId();

  if (!userId) {
    return jsonError("Неоторизиран достъп.", 401);
  }

  try {
    const body = await readJsonBody(request);
    const position = readPosition(body.position);
    const positionErrors = validatePosition(position);

    if (positionErrors.length > 0) {
      return jsonError(positionErrors.join(" "));
    }

    const profile = await saveAccountRiskProfile(userId, readProfile(body.profile));
    const savedPosition = await createSavedPosition(userId, profile.id!, position);
    const data = await loadPortfolioRiskData(userId);

    return NextResponse.json({
      ok: true,
      profile,
      position: savedPosition,
      positions: data.positions,
    });
  } catch (error) {
    return jsonError(normalizeDatabaseError(error), 500);
  }
}

export async function PATCH(request: Request) {
  const userId = await requirePortfolioUserId();

  if (!userId) {
    return jsonError("Неоторизиран достъп.", 401);
  }

  try {
    const body = await readJsonBody(request);
    const position = readPosition(body.position);

    if (!position.id) {
      return jsonError("Липсва id на позицията.");
    }

    const positionErrors = validatePosition(position);

    if (positionErrors.length > 0) {
      return jsonError(positionErrors.join(" "));
    }

    const profile = await saveAccountRiskProfile(userId, readProfile(body.profile));
    const updatedPosition = await updateSavedPosition(userId, profile.id!, {
      ...position,
      id: position.id,
    });
    const data = await loadPortfolioRiskData(userId);

    return NextResponse.json({
      ok: true,
      profile,
      position: updatedPosition,
      positions: data.positions,
    });
  } catch (error) {
    return jsonError(normalizeDatabaseError(error), 500);
  }
}

export async function DELETE(request: Request) {
  const userId = await requirePortfolioUserId();

  if (!userId) {
    return jsonError("Неоторизиран достъп.", 401);
  }

  try {
    const url = new URL(request.url);
    const positionId = url.searchParams.get("id");
    const profileId = url.searchParams.get("profileId");

    if (!positionId || !profileId) {
      return jsonError("Липсва позиция или профил.");
    }

    await deleteSavedPosition(userId, profileId, positionId);
    const data = await loadPortfolioRiskData(userId);

    return NextResponse.json({ ok: true, positions: data.positions, profile: data.profile });
  } catch (error) {
    return jsonError(normalizeDatabaseError(error), 500);
  }
}
