import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import { env, isSupabaseConfigured } from "@/lib/env";
import {
  getDefaultAccountRiskProfile,
  type AccountRiskProfile,
  type PortfolioRiskData,
  type PortfolioScenarioSource,
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
  scenario_source?: string | null;
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

type FallbackSavedPositionSale = {
  id: string;
  savedPositionId: string;
  savedPositionLotId: string | null;
  symbol: string;
  entryPrice: number;
  sellPrice: number;
  sharesSold: number;
  realizedPnlInstrument: number;
  realizedPnlAccount: number;
  fxRate: number;
  notes: string | null;
  soldAt: string;
  createdAt: string;
};

const fallbackLotIdPrefix = "note-lot:";
const fallbackBaseLotIdPrefix = `${fallbackLotIdPrefix}base:`;
const fallbackSaleIdPrefix = "note-sale:";
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

function normalizeScenarioSource(value: unknown): PortfolioScenarioSource | null {
  return value === "manual_plan" || value === "legacy" ? value : null;
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

function sanitizeSaleFromMetadata(value: unknown, positionId: string): FallbackSavedPositionSale | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const sale = value as Partial<FallbackSavedPositionSale>;
  const entryPrice = Number(sale.entryPrice);
  const sellPrice = Number(sale.sellPrice);
  const sharesSold = Number(sale.sharesSold);
  const realizedPnlInstrument = Number(sale.realizedPnlInstrument);
  const realizedPnlAccount = Number(sale.realizedPnlAccount);
  const fxRate = Number(sale.fxRate);

  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return null;
  }

  if (!Number.isFinite(sellPrice) || sellPrice <= 0) {
    return null;
  }

  if (!Number.isFinite(sharesSold) || sharesSold <= 0) {
    return null;
  }

  return {
    id:
      typeof sale.id === "string" && sale.id.startsWith(fallbackSaleIdPrefix)
        ? sale.id
        : `${fallbackSaleIdPrefix}${randomUUID()}`,
    savedPositionId: positionId,
    savedPositionLotId:
      typeof sale.savedPositionLotId === "string" && sale.savedPositionLotId
        ? sale.savedPositionLotId
        : null,
    symbol: typeof sale.symbol === "string" ? sale.symbol : "",
    entryPrice,
    sellPrice,
    sharesSold,
    realizedPnlInstrument: Number.isFinite(realizedPnlInstrument) ? realizedPnlInstrument : 0,
    realizedPnlAccount: Number.isFinite(realizedPnlAccount) ? realizedPnlAccount : 0,
    fxRate: Number.isFinite(fxRate) && fxRate > 0 ? fxRate : 1,
    notes: typeof sale.notes === "string" && sale.notes.trim() ? sale.notes.trim() : null,
    soldAt: typeof sale.soldAt === "string" ? sale.soldAt : new Date().toISOString(),
    createdAt: typeof sale.createdAt === "string" ? sale.createdAt : new Date().toISOString(),
  };
}

function splitNotesMetadata(notes: string | null, positionId: string) {
  const rawNotes = notes ?? "";
  const markerStartIndex = rawNotes.indexOf(notesLotsMarkerStart);

  if (markerStartIndex === -1) {
    return {
      userNotes: rawNotes.trim() || null,
      fallbackLots: [] as SavedPortfolioLot[],
      fallbackSales: [] as FallbackSavedPositionSale[],
      fallbackScenarioSource: null as PortfolioScenarioSource | null,
    };
  }

  const jsonStartIndex = markerStartIndex + notesLotsMarkerStart.length;
  const markerEndIndex = rawNotes.indexOf(notesLotsMarkerEnd, jsonStartIndex);

  if (markerEndIndex === -1) {
    return {
      userNotes: rawNotes.trim() || null,
      fallbackLots: [] as SavedPortfolioLot[],
      fallbackSales: [] as FallbackSavedPositionSale[],
      fallbackScenarioSource: null as PortfolioScenarioSource | null,
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

    const metadata = JSON.parse(decodedJson) as {
      lots?: unknown[];
      sales?: unknown[];
      scenarioSource?: unknown;
    };
    const fallbackLots = Array.isArray(metadata.lots)
      ? metadata.lots
          .map((lot) => sanitizeLotFromMetadata(lot, positionId))
          .filter((lot): lot is SavedPortfolioLot => Boolean(lot))
      : [];
    const fallbackSales = Array.isArray(metadata.sales)
      ? metadata.sales
          .map((sale) => sanitizeSaleFromMetadata(sale, positionId))
          .filter((sale): sale is FallbackSavedPositionSale => Boolean(sale))
      : [];

    return {
      userNotes,
      fallbackLots,
      fallbackSales,
      fallbackScenarioSource: normalizeScenarioSource(metadata.scenarioSource),
    };
  } catch {
    return {
      userNotes,
      fallbackLots: [] as SavedPortfolioLot[],
      fallbackSales: [] as FallbackSavedPositionSale[],
      fallbackScenarioSource: null as PortfolioScenarioSource | null,
    };
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

function serializeSaleForMetadata(sale: FallbackSavedPositionSale) {
  return {
    id: sale.id,
    savedPositionLotId: sale.savedPositionLotId,
    symbol: sale.symbol,
    entryPrice: sale.entryPrice,
    sellPrice: sale.sellPrice,
    sharesSold: sale.sharesSold,
    realizedPnlInstrument: sale.realizedPnlInstrument,
    realizedPnlAccount: sale.realizedPnlAccount,
    fxRate: sale.fxRate,
    notes: sale.notes,
    soldAt: sale.soldAt,
    createdAt: sale.createdAt,
  };
}

function buildNotesWithFallbackMetadata(
  userNotes: string | null | undefined,
  lots: SavedPortfolioLot[],
  sales: FallbackSavedPositionSale[] = [],
  scenarioSource?: PortfolioScenarioSource | null,
) {
  const cleanNotes = userNotes?.trim() ?? "";
  const normalizedScenarioSource = normalizeScenarioSource(scenarioSource);

  if (lots.length === 0 && sales.length === 0 && !normalizedScenarioSource) {
    return cleanNotes || null;
  }

  const metadataPayload: {
    version: number;
    lots: ReturnType<typeof serializeLotForMetadata>[];
    sales: ReturnType<typeof serializeSaleForMetadata>[];
    scenarioSource?: PortfolioScenarioSource;
  } = {
    version: 1,
    lots: lots.map(serializeLotForMetadata),
    sales: sales.map(serializeSaleForMetadata),
  };

  if (normalizedScenarioSource) {
    metadataPayload.scenarioSource = normalizedScenarioSource;
  }

  const metadata = encodeURIComponent(JSON.stringify(metadataPayload));
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
  const { userNotes, fallbackLots, fallbackScenarioSource } = splitNotesMetadata(
    row.notes,
    row.id,
  );
  const lots = ensureBaseFallbackLot(row, fallbackLots);
  const scenarioSource = normalizeScenarioSource(row.scenario_source) ?? fallbackScenarioSource;

  return {
    id: row.id,
    userId: row.user_id,
    accountRiskProfileId: row.account_risk_profile_id,
    scenarioSource,
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
    lots,
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

function createBaseFallbackLotFromPosition(row: SavedPositionRow): SavedPortfolioLot {
  return {
    id: `${fallbackBaseLotIdPrefix}${row.id}`,
    userId: row.user_id,
    savedPositionId: row.id,
    entryPrice: Number(row.entry_price),
    quantity: Number(row.quantity),
    plannedExitPrice: null,
    sharesToSell: null,
    notes: "Начална позиция",
    displayOrder: 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isBaseLotForPosition(row: SavedPositionRow, lot: SavedPortfolioLot) {
  return (
    lot.id === `${fallbackBaseLotIdPrefix}${row.id}` ||
    (lot.displayOrder === 0 &&
      lot.notes === "Начална позиция" &&
      Math.abs(lot.entryPrice - Number(row.entry_price)) < 0.0000001 &&
      Math.abs(lot.quantity - Number(row.quantity)) < 0.0000001)
  );
}

function ensureBaseFallbackLot(row: SavedPositionRow, lots: SavedPortfolioLot[]) {
  if (lots.length === 0) {
    return lots;
  }

  const hasBaseLot = lots.some((lot) => isBaseLotForPosition(row, lot));

  if (hasBaseLot) {
    return lots;
  }

  return [createBaseFallbackLotFromPosition(row), ...lots];
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
    scenario_source:
      position.scenarioSource === "manual_plan" || position.scenarioSource === "legacy"
        ? position.scenarioSource
        : null,
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

function positionToRowWithoutScenarioSource(
  userId: string,
  accountRiskProfileId: string,
  position: SavedPositionPayload,
  lots: SavedPortfolioLot[] = [],
  sales: FallbackSavedPositionSale[] = [],
) {
  const { scenario_source: _scenarioSource, ...row } = positionToRow(
    userId,
    accountRiskProfileId,
    position,
  );

  return {
    ...row,
    notes: buildNotesWithFallbackMetadata(position.notes, lots, sales, _scenarioSource),
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

function baseLotToRow(userId: string, row: SavedPositionRow) {
  return {
    user_id: userId,
    saved_position_id: row.id,
    entry_price: row.entry_price,
    quantity: row.quantity,
    planned_exit_price: null,
    shares_to_sell: null,
    notes: "Начална позиция",
    display_order: 0,
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
  const { userNotes, fallbackSales, fallbackScenarioSource } = splitNotesMetadata(
    row.notes,
    row.id,
  );
  const { error } = await client
    .from("saved_positions")
    .update({
      notes: buildNotesWithFallbackMetadata(
        userNotes,
        lots,
        fallbackSales,
        fallbackScenarioSource,
      ),
    })
    .eq("id", row.id)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

async function saveFallbackMetadataToPositionNotes(
  client: ReturnType<typeof getServiceClient>,
  userId: string,
  row: SavedPositionRow,
  lots: SavedPortfolioLot[],
  sales: FallbackSavedPositionSale[],
) {
  const { userNotes, fallbackScenarioSource } = splitNotesMetadata(row.notes, row.id);
  const { error } = await client
    .from("saved_positions")
    .update({
      notes: buildNotesWithFallbackMetadata(userNotes, lots, sales, fallbackScenarioSource),
    })
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
  const seededLots =
    fallbackLots.length > 0 ? ensureBaseFallbackLot(row, fallbackLots) : [createBaseFallbackLotFromPosition(row)];
  const savedLot = lotPayloadToFallbackLot(savedPositionId, {
    ...lot,
    displayOrder: Math.max(lot.displayOrder ?? seededLots.length, seededLots.length),
  });
  const nextLots = [...seededLots, savedLot];

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
  const seededLots = ensureBaseFallbackLot(row, fallbackLots);
  const existingLot = seededLots.find((item) => item.id === lot.id);

  if (!existingLot) {
    throw new Error("Лотът не беше намерен.");
  }

  const savedLot = lotPayloadToFallbackLot(savedPositionId, lot, existingLot);
  const nextLots = seededLots.map((item) => (item.id === lot.id ? savedLot : item));

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
  const seededLots = ensureBaseFallbackLot(row, fallbackLots);
  const nextLots = seededLots.filter((item) => item.id !== lotId);

  if (nextLots.length === seededLots.length) {
    throw new Error("Лотът не беше намерен.");
  }

  await saveFallbackLotsToPositionNotes(client, userId, row, nextLots);
}

function createFallbackSale(
  row: SavedPositionRow,
  lot: SavedPortfolioLot,
  sale: { lotId: string; sharesToSell: number; sellPrice: number },
  fxRate: number,
  notes?: string | null,
): FallbackSavedPositionSale {
  const now = new Date().toISOString();
  const realizedPnlInstrument =
    row.direction === "sell"
      ? (lot.entryPrice - sale.sellPrice) * sale.sharesToSell
      : (sale.sellPrice - lot.entryPrice) * sale.sharesToSell;
  const realizedPnlAccount =
    Number.isFinite(fxRate) && fxRate > 0 ? realizedPnlInstrument / fxRate : realizedPnlInstrument;

  return {
    id: `${fallbackSaleIdPrefix}${randomUUID()}`,
    savedPositionId: row.id,
    savedPositionLotId: sale.lotId,
    symbol: row.symbol,
    entryPrice: lot.entryPrice,
    sellPrice: sale.sellPrice,
    sharesSold: sale.sharesToSell,
    realizedPnlInstrument,
    realizedPnlAccount,
    fxRate: Number.isFinite(fxRate) && fxRate > 0 ? fxRate : 1,
    notes: notes?.trim() || null,
    soldAt: now,
    createdAt: now,
  };
}

async function applyFallbackSaleToLots(
  client: ReturnType<typeof getServiceClient>,
  userId: string,
  positionId: string,
  sales: Array<{ lotId: string; sharesToSell: number; sellPrice: number }>,
  fxRate: number,
  notes?: string | null,
) {
  const row = await fetchSavedPositionRow(client, userId, positionId);
  const { fallbackLots, fallbackSales } = splitNotesMetadata(row.notes, row.id);
  let nextLots = ensureBaseFallbackLot(row, fallbackLots);
  const nextSales = [...fallbackSales];

  for (const sale of sales) {
    const lot = nextLots.find((item) => item.id === sale.lotId);

    if (!lot) {
      throw new Error("Лотът за продажба не беше намерен.");
    }

    if (sale.sharesToSell > lot.quantity) {
      throw new Error("Не може да продадеш повече акции от наличните в лота.");
    }

    nextSales.push(createFallbackSale(row, lot, sale, fxRate, notes));
    const nextQuantity = lot.quantity - sale.sharesToSell;
    nextLots =
      nextQuantity <= 0
        ? nextLots.filter((item) => item.id !== lot.id)
        : nextLots.map((item) =>
            item.id === lot.id
              ? {
                  ...item,
                  quantity: nextQuantity,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          );
  }

  const totalRemaining = nextLots.reduce((sum, lot) => sum + lot.quantity, 0);

  if (totalRemaining <= 0) {
    const { error } = await client
      .from("saved_positions")
      .delete()
      .eq("id", positionId)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    return;
  }

  await saveFallbackMetadataToPositionNotes(client, userId, row, nextLots, nextSales);
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

function isMissingSalesTableError(error: unknown) {
  const text = getDatabaseErrorText(error).toLowerCase();

  return (
    text.includes("saved_position_sales") &&
    (text.includes("does not exist") ||
      text.includes("schema cache") ||
      text.includes("relation") ||
      text.includes("42p01") ||
      text.includes("pgrst205"))
  );
}

function isMissingScenarioSourceColumnError(error: unknown) {
  const text = getDatabaseErrorText(error).toLowerCase();

  return (
    text.includes("scenario_source") &&
    (text.includes("schema cache") ||
      text.includes("column") ||
      text.includes("pgrst204") ||
      text.includes("42703"))
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

  const savedPositionRows = (positionRows ?? []) as SavedPositionRow[];
  const positionRowsById = new Map(savedPositionRows.map((row) => [row.id, row]));
  const positions = savedPositionRows.map((row) => mapPosition(row));

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
    positions: positions.map((position) => {
      const combinedLots = [...(lotsByPosition.get(position.id) ?? []), ...(position.lots ?? [])];
      const row = positionRowsById.get(position.id);

      return {
        ...position,
        lots: row ? ensureBaseFallbackLot(row, combinedLots) : combinedLots,
      };
    }),
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
    if (isMissingScenarioSourceColumnError(error)) {
      const fallbackResponse = await client
        .from("saved_positions")
        .insert(positionToRowWithoutScenarioSource(userId, accountRiskProfileId, position))
        .select("*")
        .single();

      if (fallbackResponse.error) {
        throw fallbackResponse.error;
      }

      return mapPosition(fallbackResponse.data as SavedPositionRow);
    }

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
  const { fallbackLots, fallbackSales } = splitNotesMetadata(currentRow.notes, position.id);
  const nextRow = {
    ...positionToRow(userId, accountRiskProfileId, position),
    notes: buildNotesWithFallbackMetadata(position.notes, fallbackLots, fallbackSales),
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
    if (isMissingScenarioSourceColumnError(error)) {
      const fallbackResponse = await client
        .from("saved_positions")
        .update(
          positionToRowWithoutScenarioSource(
            userId,
            accountRiskProfileId,
            position,
            fallbackLots,
            fallbackSales,
          ),
        )
        .eq("id", position.id)
        .eq("user_id", userId)
        .eq("account_risk_profile_id", accountRiskProfileId)
        .select("*")
        .single();

      if (fallbackResponse.error) {
        throw fallbackResponse.error;
      }

      return mapPosition(fallbackResponse.data as SavedPositionRow);
    }

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
  const positionRow = await fetchSavedPositionRow(client, userId, savedPositionId);
  const { data: existingLotRows, error: existingLotsError } = await client
    .from("saved_position_lots")
    .select("*")
    .eq("user_id", userId)
    .eq("saved_position_id", savedPositionId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (existingLotsError) {
    if (isMissingLotsTableError(existingLotsError)) {
      return createFallbackSavedPositionLot(client, userId, savedPositionId, lot);
    }

    throw existingLotsError;
  }

  const existingLots = ((existingLotRows ?? []) as SavedPositionLotRow[]).map(mapLot);
  const shouldSeedBaseLot =
    existingLots.length === 0 || !existingLots.some((item) => isBaseLotForPosition(positionRow, item));

  if (shouldSeedBaseLot) {
    const { error: baseLotError } = await client
      .from("saved_position_lots")
      .insert(baseLotToRow(userId, positionRow));

    if (baseLotError) {
      if (isMissingLotsTableError(baseLotError)) {
        return createFallbackSavedPositionLot(client, userId, savedPositionId, lot);
      }

      throw baseLotError;
    }
  }

  const { data, error } = await client
    .from("saved_position_lots")
    .insert(
      lotToRow(userId, savedPositionId, {
        ...lot,
        displayOrder: Math.max(
          lot.displayOrder ?? existingLots.length,
          existingLots.length + (shouldSeedBaseLot ? 1 : 0),
        ),
      }),
    )
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

export async function applySaleToLots(
  userId: string,
  positionId: string,
  sales: Array<{ lotId: string; sharesToSell: number; sellPrice: number }>,
  fxRate: number,
  notes?: string | null,
): Promise<void> {
  const client = getServiceClient();
  const positionRow = await fetchSavedPositionRow(client, userId, positionId);

  if (sales.some((sale) => sale.lotId.startsWith(fallbackLotIdPrefix))) {
    await applyFallbackSaleToLots(client, userId, positionId, sales, fxRate, notes);
    return;
  }

  for (const sale of sales) {
    const { data: lotRow, error: lotFetchError } = await client
      .from("saved_position_lots")
      .select("*")
      .eq("id", sale.lotId)
      .eq("user_id", userId)
      .eq("saved_position_id", positionId)
      .single();

    if (lotFetchError) {
      if (isMissingLotsTableError(lotFetchError)) {
        await applyFallbackSaleToLots(client, userId, positionId, sales, fxRate, notes);
        return;
      }

      throw lotFetchError;
    }

    if (!lotRow) {
      throw new Error("Лотът за продажба не беше намерен.");
    }

    const lot = lotRow as SavedPositionLotRow;
    const entryPrice = Number(lot.entry_price);

    if (sale.sharesToSell > Number(lot.quantity)) {
      throw new Error("Не може да продадеш повече акции от наличните в лота.");
    }

    const realizedPnLInstrument =
      positionRow.direction === "sell"
        ? (entryPrice - sale.sellPrice) * sale.sharesToSell
        : (sale.sellPrice - entryPrice) * sale.sharesToSell;
    const realizedPnLAccount =
      Number.isFinite(fxRate) && fxRate > 0
        ? realizedPnLInstrument / fxRate
        : realizedPnLInstrument;

    const { error: saleInsertError } = await client.from("saved_position_sales").insert({
      id: randomUUID(),
      user_id: userId,
      saved_position_id: positionId,
      saved_position_lot_id: sale.lotId,
      symbol: positionRow.symbol,
      entry_price: entryPrice,
      sell_price: sale.sellPrice,
      shares_sold: sale.sharesToSell,
      realized_pnl_instrument: realizedPnLInstrument,
      realized_pnl_account: realizedPnLAccount,
      fx_rate: fxRate,
      notes: notes ?? null,
      sold_at: new Date().toISOString(),
    });

    if (saleInsertError) {
      if (isMissingSalesTableError(saleInsertError)) {
        const currentRow = await fetchSavedPositionRow(client, userId, positionId);
        const { fallbackLots, fallbackSales } = splitNotesMetadata(currentRow.notes, currentRow.id);
        const fallbackLot: SavedPortfolioLot = {
          id: sale.lotId,
          userId,
          savedPositionId: positionId,
          entryPrice,
          quantity: Number(lot.quantity),
          plannedExitPrice: lot.planned_exit_price,
          sharesToSell: lot.shares_to_sell,
          notes: lot.notes,
          displayOrder: lot.display_order,
          createdAt: lot.created_at,
          updatedAt: lot.updated_at,
        };

        await saveFallbackMetadataToPositionNotes(client, userId, currentRow, fallbackLots, [
          ...fallbackSales,
          createFallbackSale(positionRow, fallbackLot, sale, fxRate, notes),
        ]);
      } else {
        throw saleInsertError;
      }
    }

    const newQuantity = Number(lot.quantity) - sale.sharesToSell;

    if (newQuantity <= 0) {
      await client
        .from("saved_position_lots")
        .delete()
        .eq("id", sale.lotId)
        .eq("user_id", userId);
    } else {
      await client
        .from("saved_position_lots")
        .update({ quantity: newQuantity })
        .eq("id", sale.lotId)
        .eq("user_id", userId);
    }
  }

  const { data: remainingLots } = await client
    .from("saved_position_lots")
    .select("quantity")
    .eq("saved_position_id", positionId)
    .eq("user_id", userId);

  const totalRemaining = ((remainingLots ?? []) as Array<{ quantity: number }>).reduce(
    (sum, lot) => sum + Number(lot.quantity),
    0,
  );

  if (totalRemaining <= 0) {
    await client
      .from("saved_positions")
      .delete()
      .eq("id", positionId)
      .eq("user_id", userId);
  }
}
