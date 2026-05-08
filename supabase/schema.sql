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
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_positions_user_id_idx
  on public.saved_positions (user_id);

create index if not exists saved_positions_profile_id_idx
  on public.saved_positions (account_risk_profile_id);

comment on table public.saved_positions is
  'Stores per-user saved Share/Stock CFD positions for portfolio margin and stress calculations.';

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

alter table public.account_risk_profiles enable row level security;
alter table public.saved_positions enable row level security;

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
