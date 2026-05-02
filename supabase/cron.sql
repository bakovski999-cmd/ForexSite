-- Optional Supabase Cron setup for the dashboard sync endpoint.
-- Replace the placeholders before running this in the Supabase SQL editor.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'gold-dashboard-sync-hourly',
  '12 * * * *',
  $$
  select
    net.http_post(
      url := 'https://YOUR_APP_DOMAIN/api/sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_APP_SYNC_SECRET'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Optional release-window poll for economic calendar actuals.
-- This keeps production warmer around macro release windows without using Vercel Hobby Cron.
select cron.schedule(
  'gold-dashboard-calendar-release-poll',
  '*/5 7-22 * * 1-5',
  $$
  select
    net.http_post(
      url := 'https://YOUR_APP_DOMAIN/api/sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_APP_SYNC_SECRET'
      ),
      body := '{"mode":"calendar-release"}'::jsonb
    );
  $$
);
