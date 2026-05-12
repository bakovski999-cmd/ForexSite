# Gold Intelligence Dashboard

Private dashboard for tracking gold with:

- curated news feed and Bulgarian AI explanations
- public GDELT gold-news fallback without API key
- weekly COT positioning for COMEX gold
- macro drivers from FRED
- free weekly economic calendar from ForexFactory export, FRED, BLS, and Federal Reserve sources
- rules-based directional score with probability bands
- demo mode for local development

## Stack

- Next.js 16 + App Router
- TypeScript + Tailwind CSS 4
- ECharts
- Firebase Auth + Firestore production backend
- Supabase auth/storage shell retained as an optional legacy fallback
- OpenAI Responses API for structured news analysis

## Local start

1. Install dependencies:

```bash
npm install
```

2. Copy environment defaults:

```bash
cp .env.example .env.local
```

3. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).

Demo credentials are prefilled by default:

- `demo@goldintel.local`
- `gold-demo`

## Live connectors

To switch from demo payloads to live data, set:

- `ALPHA_VANTAGE_API_KEY`
- `FRED_API_KEY`
- `OPENAI_API_KEY`
- optional paid calendar key: `TRADING_ECONOMICS_API_KEY`
- reserved alternative calendar key: `FINNHUB_API_KEY`

For Firebase production auth and persistence, configure:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_ADMIN_ENABLED=true`
- `FIREBASE_SESSION_COOKIE_NAME`
- `NEXT_PUBLIC_ENABLE_DEMO_MODE=false`

On Firebase App Hosting, keep private values in backend environment variables or App Hosting secrets:

- `OPENAI_API_KEY`
- `ALPHA_VANTAGE_API_KEY`
- `FRED_API_KEY`
- `APP_SYNC_SECRET`

For local Firebase Admin development outside App Hosting, either use Google Application Default Credentials or set:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

The older Supabase persistence path is still available if you configure:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_SYNC_SECRET`

Apply the schema in [schema.sql](/Users/bakovski/ForexSite/supabase/schema.sql).

## Scheduled sync

The app exposes a protected server-to-server endpoint:

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/sync" \
  -H "Authorization: Bearer $APP_SYNC_SECRET"
```

For Supabase Cron, adapt [cron.sql](/Users/bakovski/ForexSite/supabase/cron.sql) with your deployed app domain and `APP_SYNC_SECRET`.

The dashboard auto-refreshes from the browser every 5 minutes and resets the countdown after a successful manual refresh. Manual dashboard refreshes use `/api/refresh` and respect `APP_REFRESH_COOLDOWN_SECONDS` to avoid burning free API quota.

## MT5 live sync

The app can receive read-only MT5 snapshots from `ForexSiteConnectorEA.mq5`.

Production configuration:

- optional: `MT5_SYNC_LIVE_SECONDS=30`
- optional: `MT5_SYNC_OFFLINE_SECONDS=300`
- apply `supabase/schema.sql` if Supabase is the active backend
- if the Supabase MT5 tables are not applied yet, the connector automatically falls back to a private Supabase Storage bucket named `mt5-sync`

The normal setup is done inside the website:

1. Open `/risk-calculator`.
2. Open the `MT5 Live` tab.
3. Click `Свържи MT5 акаунт`.
4. Download the generated `ForexSiteConnectorEA.mq5` file. The file already contains the user's `EndpointUrl` and one-time `SecretToken`.
5. In MT5, open `Tools -> Options -> Expert Advisors`.
6. Enable `Allow WebRequest for listed URL` and add the shown site origin, for example `https://forex-site-chi.vercel.app`.
7. Open MetaEditor, compile the downloaded EA, then attach it to one chart.
8. In normal setup, leave the EA inputs as generated and click `OK`. The manual values are still shown in the site for troubleshooting.

`MT5_CONNECTOR_SECRET` remains supported as an owner-level legacy token for direct API tests, but the browser setup wizard creates per-user MT5 tokens and does not require the user to edit Vercel environment variables.

The EA does not open, modify, or close trades. It reads account, open position, and recent deal history data and posts snapshots while MT5 is running. If MT5 is closed, the site keeps the last snapshot and marks the feed stale/offline.

## Stock fair value

The `/valuation` page provides a US stock fair value calculator with four editable models:

- DCF 10 years
- EV/EBITDA
- P/E
- DCF Multiple

The final weighted value defaults to `DCF 40%`, `EV/EBITDA 30%`, `P/E 15%`, and `DCF Multiple 15%`. Autofill uses SEC CompanyFacts, Alpha Vantage, Yahoo chart quotes for current price, and a best-effort Macrotrends fallback. Every autofilled field keeps a source badge, and missing data stays editable instead of blocking the calculation.

Saved analyses are available for real authenticated users. Firebase is preferred when configured; Supabase uses `stock_valuation_analyses` and falls back to a private Supabase Storage bucket named `stock-valuations` if the table is not available yet. Demo mode can calculate but cannot save.

## API source notes

- CFTC COT files are public and do not need a key.
- GDELT news search is public and does not need a key; it is used as a no-key news fallback.
- The default live calendar uses ForexFactory weekly export for previous/forecast/actual fields, plus FRED release dates, BLS latest actual values, and Federal Reserve FOMC dates.
- FRED and Alpha Vantage require free API keys created by the app owner.
- OpenAI needs your own API key for Bulgarian explanations and structured news analysis.
- Investing.com states that it does not offer public API access, so the app should not rely on scraping it.
- ForexFactory weekly export is used as a free calendar feed; keep it monitored because it is a public export, not a paid SLA-backed API.
- Trading Economics remains supported as an optional paid calendar source, but it is not required for the default live calendar.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`

## Notes

- In Firebase production, the full normalized dashboard payload is stored in Firestore at `gold_dashboard_snapshots/latest`.
- Firebase App Hosting requires a Blaze billing plan. Keep `minInstances: 0` and `maxInstances: 1` in [apphosting.yaml](/Users/bakovski/ForexSite/apphosting.yaml) for a cost-conscious personal deployment.
- If live connectors fail, the UI keeps working and marks the affected source as `Demo` or `Stale`.
- The directional score is analytical only and is not presented as trading advice.

## Firebase App Hosting deploy checklist

1. Create or open your Firebase project and upgrade it to Blaze.
2. Enable Firebase Authentication with Email/Password sign-in.
3. Create your private user account in Firebase Auth.
4. Enable Firestore in Native mode.
5. Deploy [firestore.rules](/Users/bakovski/ForexSite/firestore.rules) so browser clients cannot read or write dashboard data directly.
6. Push this repo to a private GitHub repository.
7. In Firebase Console, create an App Hosting backend connected to the GitHub repo and live branch.
8. Add the environment variables listed above in App Hosting backend settings.
9. Add budget alerts in Google Cloud Billing before opening the app publicly.
