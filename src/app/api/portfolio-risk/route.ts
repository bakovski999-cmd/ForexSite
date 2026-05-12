import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import {
  applySaleToLots,
  createSavedPositionLot,
  createSavedPosition,
  deleteSavedPositionLot,
  deleteSavedPosition,
  loadPortfolioRiskData,
  saveAccountRiskProfile,
  updateSavedPositionLot,
  updateSavedPosition,
} from "@/lib/portfolio-risk-repository";
import type {
  AccountRiskProfile,
  PortfolioDirection,
  SavedPortfolioLot,
  SavedPortfolioPosition,
} from "@/lib/portfolio-risk";

export const runtime = "nodejs";

type ProfilePayload = Partial<AccountRiskProfile>;
type PositionPayload = Partial<SavedPortfolioPosition> & {
  plannedExitPrice?: number;
};
type LotPayload = Partial<SavedPortfolioLot> & {
  positionId?: string;
  savedPositionId?: string;
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
    scenarioSource:
      position.scenarioSource === "legacy" || position.scenarioSource === "manual_plan"
        ? position.scenarioSource
        : "manual_plan",
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

function readLot(payload: unknown) {
  const lot = (payload ?? {}) as LotPayload;

  return {
    id: typeof lot.id === "string" ? lot.id : undefined,
    savedPositionId:
      typeof lot.savedPositionId === "string"
        ? lot.savedPositionId
        : typeof lot.positionId === "string"
          ? lot.positionId
          : "",
    entryPrice: toNumber(lot.entryPrice),
    quantity: toNumber(lot.quantity),
    plannedExitPrice: toOptionalNumber(lot.plannedExitPrice),
    sharesToSell: toOptionalNumber(lot.sharesToSell),
    notes: lot.notes ? String(lot.notes) : null,
    displayOrder: toNumber(lot.displayOrder, 0),
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

function validateLot(lot: ReturnType<typeof readLot>) {
  const errors: string[] = [];

  if (!lot.savedPositionId) {
    errors.push("Липсва позиция за лота.");
  }

  if (!Number.isFinite(lot.entryPrice) || lot.entryPrice <= 0) {
    errors.push("Цената на покупка трябва да е положително число.");
  }

  if (!Number.isFinite(lot.quantity) || lot.quantity <= 0) {
    errors.push("Броят акции в лота трябва да е положително число.");
  }

  if (
    lot.plannedExitPrice !== null &&
    (!Number.isFinite(lot.plannedExitPrice) || lot.plannedExitPrice < 0)
  ) {
    errors.push("Планираната цена за продажба трябва да е 0 или повече.");
  }

  if (lot.sharesToSell !== null) {
    if (!Number.isFinite(lot.sharesToSell) || lot.sharesToSell <= 0) {
      errors.push("Акциите за продажба трябва да са положително число или празно.");
    }

    if (Number.isFinite(lot.quantity) && lot.sharesToSell > lot.quantity) {
      errors.push("Акциите за продажба не може да са повече от акциите в лота.");
    }
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

function getErrorText(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code].filter(
      (item): item is string => typeof item === "string" && item.length > 0,
    );

    if (parts.length > 0) {
      return parts.join(" ");
    }
  }

  return String(error);
}

function normalizeDatabaseError(error: unknown) {
  const message = getErrorText(error);
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("account_risk_profiles") ||
    normalizedMessage.includes("saved_positions") ||
    normalizedMessage.includes("saved_position_lots") ||
    normalizedMessage.includes("saved_position_sales") ||
    normalizedMessage.includes("relation") ||
    normalizedMessage.includes("schema cache") ||
    normalizedMessage.includes("pgrst205") ||
    normalizedMessage.includes("42p01")
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

    return NextResponse.json({
      ok: true,
      profile,
      positions: data.positions,
      databaseReady: data.databaseReady,
      message: data.message,
    });
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
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "create-lot") {
      const lot = readLot(body.lot);
      const lotErrors = validateLot(lot);

      if (lotErrors.length > 0) {
        return jsonError(lotErrors.join(" "));
      }

      const savedLot = await createSavedPositionLot(userId, lot.savedPositionId, lot);
      const data = await loadPortfolioRiskData(userId);

      return NextResponse.json({
        ok: true,
        lot: savedLot,
        profile: data.profile,
        positions: data.positions,
        databaseReady: data.databaseReady,
        message: data.message,
      });
    }

    if (action === "sell-lots") {
      const positionId = typeof body.positionId === "string" ? body.positionId : "";
      const fxRate = toNumber(body.fxRate, 1);
      const salesRaw = Array.isArray(body.sales) ? body.sales : [];
      const saleNotes = body.notes ? String(body.notes) : null;

      if (!positionId) {
        return jsonError("Липсва id на позицията.");
      }

      if (salesRaw.length === 0) {
        return jsonError("Няма избрани лотове за продажба.");
      }

      const sales = salesRaw.map((item: unknown) => {
        const s = (item ?? {}) as Record<string, unknown>;
        return {
          lotId: typeof s.lotId === "string" ? s.lotId : "",
          sharesToSell: toNumber(s.sharesToSell),
          sellPrice: toNumber(s.sellPrice),
        };
      });

      const saleErrors: string[] = [];
      sales.forEach((s) => {
        if (!s.lotId) saleErrors.push("Липсва id на лот.");
        if (!Number.isFinite(s.sharesToSell) || s.sharesToSell <= 0) {
          saleErrors.push("Неверен брой акции за продажба.");
        }
        if (!Number.isFinite(s.sellPrice) || s.sellPrice <= 0) {
          saleErrors.push("Неверна цена на продажба.");
        }
      });

      if (saleErrors.length > 0) {
        return jsonError(saleErrors.join(" "));
      }

      await applySaleToLots(userId, positionId, sales, fxRate, saleNotes);
      const data = await loadPortfolioRiskData(userId);

      return NextResponse.json({
        ok: true,
        positions: data.positions,
        profile: data.profile,
        databaseReady: data.databaseReady,
        message: data.message,
      });
    }

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
      databaseReady: data.databaseReady,
      message: data.message,
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
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "update-lot") {
      const lot = readLot(body.lot);

      if (!lot.id) {
        return jsonError("Липсва id на лота.");
      }

      const lotErrors = validateLot(lot);

      if (lotErrors.length > 0) {
        return jsonError(lotErrors.join(" "));
      }

      const updatedLot = await updateSavedPositionLot(userId, lot.savedPositionId, {
        ...lot,
        id: lot.id,
      });
      const data = await loadPortfolioRiskData(userId);

      return NextResponse.json({
        ok: true,
        lot: updatedLot,
        profile: data.profile,
        positions: data.positions,
        databaseReady: data.databaseReady,
        message: data.message,
      });
    }

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
      databaseReady: data.databaseReady,
      message: data.message,
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
    const action = url.searchParams.get("action");

    if (action === "delete-lot") {
      const positionId = url.searchParams.get("positionId");
      const lotId = url.searchParams.get("lotId");

      if (!positionId || !lotId) {
        return jsonError("Липсва позиция или лот.");
      }

      await deleteSavedPositionLot(userId, positionId, lotId);
      const data = await loadPortfolioRiskData(userId);

      return NextResponse.json({
        ok: true,
        positions: data.positions,
        profile: data.profile,
        databaseReady: data.databaseReady,
        message: data.message,
      });
    }

    const positionId = url.searchParams.get("id");
    const profileId = url.searchParams.get("profileId");

    if (!positionId || !profileId) {
      return jsonError("Липсва позиция или профил.");
    }

    await deleteSavedPosition(userId, profileId, positionId);
    const data = await loadPortfolioRiskData(userId);

    return NextResponse.json({
      ok: true,
      positions: data.positions,
      profile: data.profile,
      databaseReady: data.databaseReady,
      message: data.message,
    });
  } catch (error) {
    return jsonError(normalizeDatabaseError(error), 500);
  }
}
