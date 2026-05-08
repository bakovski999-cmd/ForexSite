import { createClient } from "@supabase/supabase-js";

import { env, isSupabaseConfigured } from "@/lib/env";
import {
  getDefaultAccountRiskProfile,
  type AccountRiskProfile,
  type PortfolioRiskData,
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

type AccountRiskProfilePayload = Omit<
  AccountRiskProfile,
  "id" | "userId" | "createdAt" | "updatedAt"
> & {
  id?: string | null;
};

type SavedPositionPayload = Omit<
  SavedPortfolioPosition,
  "id" | "userId" | "accountRiskProfileId" | "createdAt" | "updatedAt"
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

  return {
    profile,
    positions: (positionRows ?? []).map((row) => mapPosition(row as SavedPositionRow)),
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
