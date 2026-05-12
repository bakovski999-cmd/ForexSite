create table if not exists public.gold_dashboard_snapshots (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null
);

create index if not exists gold_dashboard_snapshots_created_at_idx
  on public.gold_dashboard_snapshots (created_at desc);

comment on table public.gold_dashboard_snapshots is
  'Stores the normalized dashboard payload containing NewsItem, NewsAnalysis, CotSnapshot, MacroSnapshot and SignalRun arrays.';

create extension if not exists pgcrypto;

create table if not exists public.mt5_connectors (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null default 'MT5 акаунт',
  token_hash text not null unique,
  token_preview text not null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mt5_connectors_user_id_idx
  on public.mt5_connectors (user_id, created_at desc);

comment on table public.mt5_connectors is
  'Stores per-user MT5 connector tokens. Plain secrets are never stored.';

create table if not exists public.mt5_sync_snapshots (
  id bigint generated always as identity primary key,
  connector_id uuid references public.mt5_connectors(id) on delete set null,
  user_id text,
  connection_key text not null,
  account_login text not null,
  server text not null,
  received_at timestamptz not null default now(),
  payload jsonb not null
);

alter table public.mt5_sync_snapshots
  add column if not exists connector_id uuid references public.mt5_connectors(id) on delete set null;

alter table public.mt5_sync_snapshots
  add column if not exists user_id text;

create index if not exists mt5_sync_snapshots_received_at_idx
  on public.mt5_sync_snapshots (received_at desc);

create index if not exists mt5_sync_snapshots_connection_key_idx
  on public.mt5_sync_snapshots (connection_key, received_at desc);

create index if not exists mt5_sync_snapshots_user_id_idx
  on public.mt5_sync_snapshots (user_id, received_at desc);

create index if not exists mt5_sync_snapshots_connector_id_idx
  on public.mt5_sync_snapshots (connector_id, received_at desc);

comment on table public.mt5_sync_snapshots is
  'Stores every MT5 Expert Advisor account and trade snapshot received by the private live connector.';

alter table public.mt5_connectors enable row level security;
alter table public.mt5_sync_snapshots enable row level security;

create table if not exists public.account_risk_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_name text not null default 'Основен CFD акаунт',
  broker_name text not null default 'PU Prime',
  account_currency text not null default 'EUR',
  balance numeric not null default 2000,
  added_funds_simulation numeric not null default 0,
  stop_out_level_percent numeric not null default 20,
  margin_call_level_percent numeric not null default 50,
  normal_fixed_leverage numeric not null default 20,
  temporary_fixed_leverage numeric not null default 5,
  fx_rate_instrument_to_account numeric not null default 0.85,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_risk_profiles_user_id_key unique (user_id),
  constraint account_risk_profiles_balance_check check (balance >= 0),
  constraint account_risk_profiles_added_funds_check check (added_funds_simulation >= 0),
  constraint account_risk_profiles_stop_out_check check (stop_out_level_percent > 0),
  constraint account_risk_profiles_margin_call_check check (margin_call_level_percent > 0),
  constraint account_risk_profiles_normal_leverage_check check (normal_fixed_leverage > 0),
  constraint account_risk_profiles_temporary_leverage_check check (temporary_fixed_leverage > 0),
  constraint account_risk_profiles_fx_rate_check check (fx_rate_instrument_to_account > 0)
);

create index if not exists account_risk_profiles_user_id_idx
  on public.account_risk_profiles (user_id);

comment on table public.account_risk_profiles is
  'Stores per-user account settings for the Portfolio Risk Manager module.';

create table if not exists public.saved_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_risk_profile_id uuid not null references public.account_risk_profiles(id) on delete cascade,
  symbol text not null,
  asset_name text,
  direction text not null default 'buy' check (direction in ('buy', 'sell')),
  entry_price numeric not null check (entry_price > 0),
  current_price numeric check (current_price > 0),
  quantity numeric not null check (quantity > 0),
  instrument_currency text not null default 'USD',
  normal_fixed_leverage numeric check (normal_fixed_leverage > 0),
  temporary_fixed_leverage numeric check (temporary_fixed_leverage > 0),
  scenario_source text check (scenario_source is null or scenario_source in ('manual_plan', 'legacy')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.saved_positions
  add column if not exists scenario_source text;

alter table public.saved_positions
  drop constraint if exists saved_positions_scenario_source_check;

alter table public.saved_positions
  add constraint saved_positions_scenario_source_check
  check (scenario_source is null or scenario_source in ('manual_plan', 'legacy'));

create index if not exists saved_positions_user_id_idx
  on public.saved_positions (user_id);

create index if not exists saved_positions_profile_id_idx
  on public.saved_positions (account_risk_profile_id);

comment on table public.saved_positions is
  'Stores per-user saved Share/Stock CFD positions for portfolio margin and stress calculations.';

create table if not exists public.saved_position_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_position_id uuid not null references public.saved_positions(id) on delete cascade,
  entry_price numeric not null check (entry_price > 0),
  quantity numeric not null check (quantity > 0),
  planned_exit_price numeric check (planned_exit_price >= 0),
  shares_to_sell numeric check (shares_to_sell > 0),
  notes text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_position_lots_sell_quantity_check
    check (shares_to_sell is null or shares_to_sell <= quantity)
);

create index if not exists saved_position_lots_user_id_idx
  on public.saved_position_lots (user_id);

create index if not exists saved_position_lots_position_id_idx
  on public.saved_position_lots (saved_position_id);

comment on table public.saved_position_lots is
  'Stores per-user purchase lots and planned exits for saved Portfolio Risk positions.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists account_risk_profiles_set_updated_at
  on public.account_risk_profiles;

create trigger account_risk_profiles_set_updated_at
before update on public.account_risk_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists saved_positions_set_updated_at
  on public.saved_positions;

create trigger saved_positions_set_updated_at
before update on public.saved_positions
for each row
execute function public.set_updated_at();

drop trigger if exists saved_position_lots_set_updated_at
  on public.saved_position_lots;

create trigger saved_position_lots_set_updated_at
before update on public.saved_position_lots
for each row
execute function public.set_updated_at();

alter table public.account_risk_profiles enable row level security;
alter table public.saved_positions enable row level security;
alter table public.saved_position_lots enable row level security;

drop policy if exists "Users can read own account risk profiles"
  on public.account_risk_profiles;
create policy "Users can read own account risk profiles"
on public.account_risk_profiles
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own account risk profiles"
  on public.account_risk_profiles;
create policy "Users can insert own account risk profiles"
on public.account_risk_profiles
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own account risk profiles"
  on public.account_risk_profiles;
create policy "Users can update own account risk profiles"
on public.account_risk_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own account risk profiles"
  on public.account_risk_profiles;
create policy "Users can delete own account risk profiles"
on public.account_risk_profiles
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read own saved positions"
  on public.saved_positions;
create policy "Users can read own saved positions"
on public.saved_positions
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own saved positions"
  on public.saved_positions;
create policy "Users can insert own saved positions"
on public.saved_positions
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own saved positions"
  on public.saved_positions;
create policy "Users can update own saved positions"
on public.saved_positions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own saved positions"
  on public.saved_positions;
create policy "Users can delete own saved positions"
on public.saved_positions
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read own saved position lots"
  on public.saved_position_lots;
create policy "Users can read own saved position lots"
on public.saved_position_lots
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own saved position lots"
  on public.saved_position_lots;
create policy "Users can insert own saved position lots"
on public.saved_position_lots
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own saved position lots"
  on public.saved_position_lots;
create policy "Users can update own saved position lots"
on public.saved_position_lots
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own saved position lots"
  on public.saved_position_lots;
create policy "Users can delete own saved position lots"
on public.saved_position_lots
for delete
using (auth.uid() = user_id);

-- saved_position_sales: realized P&L records
create table if not exists public.saved_position_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_position_id uuid not null references public.saved_positions(id) on delete cascade,
  saved_position_lot_id uuid references public.saved_position_lots(id) on delete set null,
  symbol text not null,
  entry_price numeric not null,
  sell_price numeric not null check (sell_price > 0),
  shares_sold numeric not null check (shares_sold > 0),
  realized_pnl_instrument numeric not null,
  realized_pnl_account numeric not null,
  fx_rate numeric not null,
  notes text,
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists saved_position_sales_user_id_idx
  on public.saved_position_sales (user_id);
create index if not exists saved_position_sales_position_id_idx
  on public.saved_position_sales (saved_position_id);

alter table public.saved_position_sales enable row level security;

drop policy if exists "Users can read own sales"
  on public.saved_position_sales;
create policy "Users can read own sales"
on public.saved_position_sales
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own sales"
  on public.saved_position_sales;
create policy "Users can insert own sales"
on public.saved_position_sales
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own sales"
  on public.saved_position_sales;
create policy "Users can delete own sales"
on public.saved_position_sales
for delete
using (auth.uid() = user_id);

-- stock_valuation_analyses: saved fair value calculations
create table if not exists public.stock_valuation_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  company_name text,
  title text not null,
  latest_fair_value numeric,
  current_price numeric,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stock_valuation_analyses_user_id_idx
  on public.stock_valuation_analyses (user_id);

create index if not exists stock_valuation_analyses_user_ticker_idx
  on public.stock_valuation_analyses (user_id, ticker);

comment on table public.stock_valuation_analyses is
  'Stores per-user saved fair value calculations and editable model assumptions.';

drop trigger if exists stock_valuation_analyses_set_updated_at
  on public.stock_valuation_analyses;

create trigger stock_valuation_analyses_set_updated_at
before update on public.stock_valuation_analyses
for each row
execute function public.set_updated_at();

alter table public.stock_valuation_analyses enable row level security;

drop policy if exists "Users can read own stock valuations"
  on public.stock_valuation_analyses;
create policy "Users can read own stock valuations"
on public.stock_valuation_analyses
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own stock valuations"
  on public.stock_valuation_analyses;
create policy "Users can insert own stock valuations"
on public.stock_valuation_analyses
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own stock valuations"
  on public.stock_valuation_analyses;
create policy "Users can update own stock valuations"
on public.stock_valuation_analyses
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own stock valuations"
  on public.stock_valuation_analyses;
create policy "Users can delete own stock valuations"
on public.stock_valuation_analyses
for delete
using (auth.uid() = user_id);
