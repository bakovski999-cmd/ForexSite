import { createClient } from "@supabase/supabase-js";

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
    notes: row.notes,
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
      lots: lotsByPosition.get(position.id) ?? [],
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
  const { data, error } = await client
    .from("saved_positions")
    .update(positionToRow(userId, accountRiskProfileId, position))
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
  const { data, error } = await client
    .from("saved_position_lots")
    .update(lotToRow(userId, savedPositionId, lot))
    .eq("id", lot.id)
    .eq("user_id", userId)
    .eq("saved_position_id", savedPositionId)
    .select("*")
    .single();

  if (error) {
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
  const { error } = await client
    .from("saved_position_lots")
    .delete()
    .eq("id", lotId)
    .eq("user_id", userId)
    .eq("saved_position_id", savedPositionId);

  if (error) {
    throw error;
  }
}
