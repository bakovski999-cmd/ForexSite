create table if not exists public.gold_dashboard_snapshots (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null
);

create index if not exists gold_dashboard_snapshots_created_at_idx
  on public.gold_dashboard_snapshots (created_at desc);

comment on table public.gold_dashboard_snapshots is
  'Stores the normalized dashboard payload containing NewsItem, NewsAnalysis, CotSnapshot, MacroSnapshot and SignalRun arrays.';
