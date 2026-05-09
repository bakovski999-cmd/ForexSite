import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import { env, isSupabaseConfigured } from "@/lib/env";
import {
  getDefaultAccountRiskProfile,
  type AccountRiskProfile,
  type PortfolioRiskData,
  type SavedPortfolioLot,
  type SavedPortfolioPosition,
} from "@/lib/portfolio-risk";

type AccountRiskProfileRow = {
  id: string;
  user_id: string;
  account_name: string;
  broker_name: string;
  account_currency: string;
  balance: number;
  added_funds_simulation: number;
  stop_out_level_percent: number;
  margin_call_level_percent: number;
  normal_fixed_leverage: number;
  temporary_fixed_leverage: number;
  fx_rate_instrument_to_account: number;
  created_at: string;
  updated_at: string;
};

type SavedPositionRow = {
  id: string;
  user_id: string;
  account_risk_profile_id: string;
  symbol: string;
  asset_name: string | null;
  direction: "buy" | "sell";
  entry_price: number;
  current_price: number | null;
  quantity: number;
  instrument_currency: string;
  normal_fixed_leverage: number | null;
  temporary_fixed_leverage: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SavedPositionLotRow = {
  id: string;
  user_id: string;
  saved_position_id: string;
  entry_price: number;
  quantity: number;
  planned_exit_price: number | null;
  shares_to_sell: number | null;
  notes: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
};

type AccountRiskProfilePayload = Omit<
  AccountRiskProfile,
  "id" | "userId" | "createdAt" | "updatedAt"
> & {
  id?: string | null;
};

type SavedPositionPayload = Omit<
  SavedPortfolioPosition,
  "id" | "userId" | "accountRiskProfileId" | "lots" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

type SavedPositionLotPayload = Omit<
  SavedPortfolioLot,
  "id" | "userId" | "savedPositionId" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

const fallbackLotIdPrefix = "note-lot:";
const notesLotsMarkerStart = "<!-- portfolio-risk-lots:";
const notesLotsMarkerEnd = " -->";

function getServiceClient() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase не е конфигуриран.");
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function sanitizeLotFromMetadata(value: unknown, positionId: string): SavedPortfolioLot | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const lot = value as Partial<SavedPortfolioLot>;
  const entryPrice = Number(lot.entryPrice);
  const quantity = Number(lot.quantity);
  const plannedExitPrice =
    lot.plannedExitPrice === null || lot.plannedExitPrice === undefined
      ? null
      : Number(lot.plannedExitPrice);
  const sharesToSell =
    lot.sharesToSell === null || lot.sharesToSell === undefined ? null : Number(lot.sharesToSell);

  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return null;
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  if (plannedExitPrice !== null && (!Number.isFinite(plannedExitPrice) || plannedExitPrice < 0)) {
    return null;
  }

  if (sharesToSell !== null && (!Number.isFinite(sharesToSell) || sharesToSell <= 0)) {
    return null;
  }

  if (sharesToSell !== null && sharesToSell > quantity) {
    return null;
  }

  return {
    id:
      typeof lot.id === "string" && lot.id.startsWith(fallbackLotIdPrefix)
        ? lot.id
        : `${fallbackLotIdPrefix}${randomUUID()}`,
    savedPositionId: positionId,
    entryPrice,
    quantity,
    plannedExitPrice,
    sharesToSell,
    notes: typeof lot.notes === "string" && lot.notes.trim() ? lot.notes.trim() : null,
    displayOrder: Number.isFinite(Number(lot.displayOrder)) ? Number(lot.displayOrder) : 0,
    createdAt: typeof lot.createdAt === "string" ? lot.createdAt : undefined,
    updatedAt: typeof lot.updatedAt === "string" ? lot.updatedAt : undefined,
  };
}

function splitNotesMetadata(notes: string | null, positionId: string) {
  const rawNotes = notes ?? "";
  const markerStartIndex = rawNotes.indexOf(notesLotsMarkerStart);

  if (markerStartIndex === -1) {
    return {
      userNotes: rawNotes.trim() || null,
      fallbackLots: [] as SavedPortfolioLot[],
    };
  }

  const jsonStartIndex = markerStartIndex + notesLotsMarkerStart.length;
  const markerEndIndex = rawNotes.indexOf(notesLotsMarkerEnd, jsonStartIndex);

  if (markerEndIndex === -1) {
    return {
      userNotes: rawNotes.trim() || null,
      fallbackLots: [] as SavedPortfolioLot[],
    };
  }

  const beforeMarker = rawNotes.slice(0, markerStartIndex);
  const afterMarker = rawNotes.slice(markerEndIndex + notesLotsMarkerEnd.length);
  const userNotes = `${beforeMarker}${afterMarker}`.trim() || null;
  const encodedJson = rawNotes.slice(jsonStartIndex, markerEndIndex);

  try {
    let decodedJson = encodedJson;

    try {
      decodedJson = decodeURIComponent(encodedJson);
    } catch {
      decodedJson = encodedJson;
    }

    const metadata = JSON.parse(decodedJson) as { lots?: unknown[] };
    const fallbackLots = Array.isArray(metadata.lots)
      ? metadata.lots
          .map((lot) => sanitizeLotFromMetadata(lot, positionId))
          .filter((lot): lot is SavedPortfolioLot => Boolean(lot))
      : [];

    return { userNotes, fallbackLots };
  } catch {
    return { userNotes, fallbackLots: [] as SavedPortfolioLot[] };
  }
}

function serializeLotForMetadata(lot: SavedPortfolioLot) {
  return {
    id: lot.id,
    entryPrice: lot.entryPrice,
    quantity: lot.quantity,
    plannedExitPrice: lot.plannedExitPrice ?? null,
    sharesToSell: lot.sharesToSell ?? null,
    notes: lot.notes ?? null,
    displayOrder: lot.displayOrder ?? 0,
    createdAt: lot.createdAt,
    updatedAt: lot.updatedAt,
  };
}

function buildNotesWithFallbackLots(userNotes: string | null | undefined, lots: SavedPortfolioLot[]) {
  const cleanNotes = userNotes?.trim() ?? "";

  if (lots.length === 0) {
    return cleanNotes || null;
  }

  const metadata = encodeURIComponent(
    JSON.stringify({
      version: 1,
      lots: lots.map(serializeLotForMetadata),
    }),
  );
  const marker = `${notesLotsMarkerStart}${metadata}${notesLotsMarkerEnd}`;

  return [cleanNotes, marker].filter(Boolean).join("\n");
}

function mapProfile(row: AccountRiskProfileRow): AccountRiskProfile {
  return {
    id: row.id,
    userId: row.user_id,
    accountName: row.account_name,
    brokerName: row.broker_name,
    accountCurrency: row.account_currency,
    balance: Number(row.balance),
    addedFundsSimulation: Number(row.added_funds_simulation),
    stopOutLevelPercent: Number(row.stop_out_level_percent),
    marginCallLevelPercent: Number(row.margin_call_level_percent),
    normalFixedLeverage: Number(row.normal_fixed_leverage),
    temporaryFixedLeverage: Number(row.temporary_fixed_leverage),
    fxRateInstrumentToAccount: Number(row.fx_rate_instrument_to_account),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPosition(row: SavedPositionRow): SavedPortfolioPosition {
  const { userNotes, fallbackLots } = splitNotesMetadata(row.notes, row.id);

  return {
    id: row.id,
    userId: row.user_id,
    accountRiskProfileId: row.account_risk_profile_id,
    symbol: row.symbol,
    assetName: row.asset_name,
    direction: row.direction,
    entryPrice: Number(row.entry_price),
    currentPrice: row.current_price === null ? null : Number(row.current_price),
    quantity: Number(row.quantity),
    instrumentCurrency: row.instrument_currency,
    normalFixedLeverage:
      row.normal_fixed_leverage === null ? null : Number(row.normal_fixed_leverage),
    temporaryFixedLeverage:
      row.temporary_fixed_leverage === null ? null : Number(row.temporary_fixed_leverage),
    notes: userNotes,
    lots: fallbackLots,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLot(row: SavedPositionLotRow): SavedPortfolioLot {
  return {
    id: row.id,
    userId: row.user_id,
    savedPositionId: row.saved_position_id,
    entryPrice: Number(row.entry_price),
    quantity: Number(row.quantity),
    plannedExitPrice: row.planned_exit_price === null ? null : Number(row.planned_exit_price),
    sharesToSell: row.shares_to_sell === null ? null : Number(row.shares_to_sell),
    notes: row.notes,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function profileToRow(userId: string, profile: AccountRiskProfilePayload) {
  const normalized = getDefaultAccountRiskProfile(profile);

  return {
    user_id: userId,
    account_name: normalized.accountName,
    broker_name: normalized.brokerName,
    account_currency: normalized.accountCurrency,
    balance: normalized.balance,
    added_funds_simulation: normalized.addedFundsSimulation,
    stop_out_level_percent: normalized.stopOutLevelPercent,
    margin_call_level_percent: normalized.marginCallLevelPercent,
    normal_fixed_leverage: normalized.normalFixedLeverage,
    temporary_fixed_leverage: normalized.temporaryFixedLeverage,
    fx_rate_instrument_to_account: normalized.fxRateInstrumentToAccount,
  };
}

function positionToRow(
  userId: string,
  accountRiskProfileId: string,
  position: SavedPositionPayload,
) {
  return {
    user_id: userId,
    account_risk_profile_id: accountRiskProfileId,
    symbol: position.symbol.trim().toUpperCase(),
    asset_name: position.assetName?.trim() || null,
    direction: position.direction,
    entry_price: position.entryPrice,
    current_price: position.currentPrice ?? null,
    quantity: position.quantity,
    instrument_currency: position.instrumentCurrency.trim().toUpperCase() || "USD",
    normal_fixed_leverage: position.normalFixedLeverage ?? null,
    temporary_fixed_leverage: position.temporaryFixedLeverage ?? null,
    notes: position.notes?.trim() || null,
  };
}

function lotToRow(userId: string, savedPositionId: string, lot: SavedPositionLotPayload) {
  return {
    user_id: userId,
    saved_position_id: savedPositionId,
    entry_price: lot.entryPrice,
    quantity: lot.quantity,
    planned_exit_price: lot.plannedExitPrice ?? null,
    shares_to_sell: lot.sharesToSell ?? null,
    notes: lot.notes?.trim() || null,
    display_order: lot.displayOrder ?? 0,
  };
}

function lotPayloadToFallbackLot(
  savedPositionId: string,
  lot: SavedPositionLotPayload,
  existingLot?: SavedPortfolioLot,
): SavedPortfolioLot {
  const now = new Date().toISOString();

  return {
    id:
      existingLot?.id ??
      (lot.id?.startsWith(fallbackLotIdPrefix) ? lot.id : `${fallbackLotIdPrefix}${randomUUID()}`),
    savedPositionId,
    entryPrice: lot.entryPrice,
    quantity: lot.quantity,
    plannedExitPrice: lot.plannedExitPrice ?? null,
    sharesToSell: lot.sharesToSell ?? null,
    notes: lot.notes?.trim() || null,
    displayOrder: lot.displayOrder ?? existingLot?.displayOrder ?? 0,
    createdAt: existingLot?.createdAt ?? now,
    updatedAt: now,
  };
}

async function fetchSavedPositionRow(
  client: ReturnType<typeof getServiceClient>,
  userId: string,
  savedPositionId: string,
) {
  const { data, error } = await client
    .from("saved_positions")
    .select("*")
    .eq("id", savedPositionId)
    .eq("user_id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data as SavedPositionRow;
}

async function saveFallbackLotsToPositionNotes(
  client: ReturnType<typeof getServiceClient>,
  userId: string,
  row: SavedPositionRow,
  lots: SavedPortfolioLot[],
) {
  const { userNotes } = splitNotesMetadata(row.notes, row.id);
  const { error } = await client
    .from("saved_positions")
    .update({ notes: buildNotesWithFallbackLots(userNotes, lots) })
    .eq("id", row.id)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

async function createFallbackSavedPositionLot(
  client: ReturnType<typeof getServiceClient>,
  userId: string,
  savedPositionId: string,
  lot: SavedPositionLotPayload,
) {
  const row = await fetchSavedPositionRow(client, userId, savedPositionId);
  const { fallbackLots } = splitNotesMetadata(row.notes, row.id);
  const savedLot = lotPayloadToFallbackLot(savedPositionId, lot);
  const nextLots = [...fallbackLots, savedLot];

  await saveFallbackLotsToPositionNotes(client, userId, row, nextLots);

  return savedLot;
}

async function updateFallbackSavedPositionLot(
  client: ReturnType<typeof getServiceClient>,
  userId: string,
  savedPositionId: string,
  lot: SavedPositionLotPayload & { id: string },
) {
  const row = await fetchSavedPositionRow(client, userId, savedPositionId);
  const { fallbackLots } = splitNotesMetadata(row.notes, row.id);
  const existingLot = fallbackLots.find((item) => item.id === lot.id);

  if (!existingLot) {
    throw new Error("Лотът не беше намерен.");
  }

  const savedLot = lotPayloadToFallbackLot(savedPositionId, lot, existingLot);
  const nextLots = fallbackLots.map((item) => (item.id === lot.id ? savedLot : item));

  await saveFallbackLotsToPositionNotes(client, userId, row, nextLots);

  return savedLot;
}

async function deleteFallbackSavedPositionLot(
  client: ReturnType<typeof getServiceClient>,
  userId: string,
  savedPositionId: string,
  lotId: string,
) {
  const row = await fetchSavedPositionRow(client, userId, savedPositionId);
  const { fallbackLots } = splitNotesMetadata(row.notes, row.id);
  const nextLots = fallbackLots.filter((item) => item.id !== lotId);

  if (nextLots.length === fallbackLots.length) {
    throw new Error("Лотът не беше намерен.");
  }

  await saveFallbackLotsToPositionNotes(client, userId, row, nextLots);
}

function getDatabaseErrorText(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;

    return [record.message, record.details, record.hint, record.code]
      .filter((item): item is string => typeof item === "string" && item.length > 0)
      .join(" ");
  }

  return String(error);
}

function isMissingLotsTableError(error: unknown) {
  const text = getDatabaseErrorText(error).toLowerCase();

  return (
    text.includes("saved_position_lots") &&
    (text.includes("does not exist") ||
      text.includes("schema cache") ||
      text.includes("relation") ||
      text.includes("42p01") ||
      text.includes("pgrst205"))
  );
}

export async function loadPortfolioRiskData(userId: string): Promise<PortfolioRiskData> {
  const client = getServiceClient();
  const { data: profileRow, error: profileError } = await client
    .from("account_risk_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const profile = profileRow
    ? mapProfile(profileRow as AccountRiskProfileRow)
    : getDefaultAccountRiskProfile({ userId });

  if (!profile.id) {
    return {
      profile,
      positions: [],
      databaseReady: true,
    };
  }

  const { data: positionRows, error: positionError } = await client
    .from("saved_positions")
    .select("*")
    .eq("user_id", userId)
    .eq("account_risk_profile_id", profile.id)
    .order("created_at", { ascending: true });

  if (positionError) {
    throw positionError;
  }

  const positions = (positionRows ?? []).map((row) => mapPosition(row as SavedPositionRow));

  if (positions.length === 0) {
    return {
      profile,
      positions,
      databaseReady: true,
    };
  }

  const positionIds = positions.map((position) => position.id);
  const { data: lotRows, error: lotError } = await client
    .from("saved_position_lots")
    .select("*")
    .eq("user_id", userId)
    .in("saved_position_id", positionIds)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (lotError) {
    if (isMissingLotsTableError(lotError)) {
      return {
        profile,
        positions,
        databaseReady: true,
      };
    }

    throw lotError;
  }

  const lotsByPosition = new Map<string, SavedPortfolioLot[]>();

  (lotRows ?? []).forEach((row) => {
    const lot = mapLot(row as SavedPositionLotRow);
    const savedPositionId = lot.savedPositionId ?? "";
    const existing = lotsByPosition.get(savedPositionId) ?? [];
    lotsByPosition.set(savedPositionId, [...existing, lot]);
  });

  return {
    profile,
    positions: positions.map((position) => ({
      ...position,
      lots: [...(lotsByPosition.get(position.id) ?? []), ...(position.lots ?? [])],
    })),
    databaseReady: true,
  };
}

export async function saveAccountRiskProfile(
  userId: string,
  profile: AccountRiskProfilePayload,
): Promise<AccountRiskProfile> {
  const client = getServiceClient();
  const row = profileToRow(userId, profile);
  const { data, error } = await client
    .from("account_risk_profiles")
    .upsert(row, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapProfile(data as AccountRiskProfileRow);
}

export async function createSavedPosition(
  userId: string,
  accountRiskProfileId: string,
  position: SavedPositionPayload,
): Promise<SavedPortfolioPosition> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("saved_positions")
    .insert(positionToRow(userId, accountRiskProfileId, position))
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapPosition(data as SavedPositionRow);
}

export async function updateSavedPosition(
  userId: string,
  accountRiskProfileId: string,
  position: SavedPositionPayload & { id: string },
): Promise<SavedPortfolioPosition> {
  const client = getServiceClient();
  const currentRow = await fetchSavedPositionRow(client, userId, position.id);
  const { fallbackLots } = splitNotesMetadata(currentRow.notes, position.id);
  const nextRow = {
    ...positionToRow(userId, accountRiskProfileId, position),
    notes: buildNotesWithFallbackLots(position.notes, fallbackLots),
  };
  const { data, error } = await client
    .from("saved_positions")
    .update(nextRow)
    .eq("id", position.id)
    .eq("user_id", userId)
    .eq("account_risk_profile_id", accountRiskProfileId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapPosition(data as SavedPositionRow);
}

export async function deleteSavedPosition(
  userId: string,
  accountRiskProfileId: string,
  positionId: string,
) {
  const client = getServiceClient();
  const { error } = await client
    .from("saved_positions")
    .delete()
    .eq("id", positionId)
    .eq("user_id", userId)
    .eq("account_risk_profile_id", accountRiskProfileId);

  if (error) {
    throw error;
  }
}

export async function createSavedPositionLot(
  userId: string,
  savedPositionId: string,
  lot: SavedPositionLotPayload,
): Promise<SavedPortfolioLot> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("saved_position_lots")
    .insert(lotToRow(userId, savedPositionId, lot))
    .select("*")
    .single();

  if (error) {
    if (isMissingLotsTableError(error)) {
      return createFallbackSavedPositionLot(client, userId, savedPositionId, lot);
    }

    throw error;
  }

  return mapLot(data as SavedPositionLotRow);
}

export async function updateSavedPositionLot(
  userId: string,
  savedPositionId: string,
  lot: SavedPositionLotPayload & { id: string },
): Promise<SavedPortfolioLot> {
  const client = getServiceClient();

  if (lot.id.startsWith(fallbackLotIdPrefix)) {
    return updateFallbackSavedPositionLot(client, userId, savedPositionId, lot);
  }

  const { data, error } = await client
    .from("saved_position_lots")
    .update(lotToRow(userId, savedPositionId, lot))
    .eq("id", lot.id)
    .eq("user_id", userId)
    .eq("saved_position_id", savedPositionId)
    .select("*")
    .single();

  if (error) {
    if (isMissingLotsTableError(error)) {
      return updateFallbackSavedPositionLot(client, userId, savedPositionId, lot);
    }

    throw error;
  }

  return mapLot(data as SavedPositionLotRow);
}

export async function deleteSavedPositionLot(
  userId: string,
  savedPositionId: string,
  lotId: string,
) {
  const client = getServiceClient();

  if (lotId.startsWith(fallbackLotIdPrefix)) {
    await deleteFallbackSavedPositionLot(client, userId, savedPositionId, lotId);
    return;
  }

  const { error } = await client
    .from("saved_position_lots")
    .delete()
    .eq("id", lotId)
    .eq("user_id", userId)
    .eq("saved_position_id", savedPositionId);

  if (error) {
    if (isMissingLotsTableError(error)) {
      await deleteFallbackSavedPositionLot(client, userId, savedPositionId, lotId);
      return;
    }

    throw error;
  }
}
