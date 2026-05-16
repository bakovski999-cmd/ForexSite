# ForexSite Project Map

## Source Of Truth

- Production branch: `main`
- Live URL: https://forex-site-chi.vercel.app
- Active project workspace: `/Users/bakovski/ForexSite`
- Before editing, verify this workspace with `git fetch origin`, `git status --short`, and `HEAD == origin/main`.
- Old feature worktree `/Users/bakovski/.config/superpowers/worktrees/ForexSite/mt5-live-sync` is not the default source of truth. Do not use it for new edits unless explicitly requested.

## App Routes

- `/login` - Supabase login page.
- `/overview` - dashboard overview.
- `/news` - news intelligence board.
- `/cot` - COT positioning.
- `/macro` - macro dashboard.
- `/calendar` - economic calendar.
- `/signal-lab` - signal/scoring workspace.
- `/risk-calculator` - risk calculator, Portfolio Risk, MT5 live sync.
- `/valuation` - stock fair value workspace.

All dashboard routes are protected and redirect to `/login` without a valid session.

## Feature Areas

### Portfolio Risk

- UI entrypoint: `src/components/portfolio-risk-manager.tsx`
- Feature implementation: `src/features/portfolio-risk/`
- Calculation engine: `src/lib/portfolio-risk.ts`
- Persistence: `src/lib/portfolio-risk-repository.ts`
- API route: `src/app/api/portfolio-risk/route.ts`
- Tests: `tests/unit/portfolio-risk*.test.ts*`

Production compatibility matters here. Live Supabase may miss optional lots/sales tables or columns, so fallback metadata in `saved_positions.notes` must remain supported.

### MT5 Sync

- EA source: `mt5/ForexSiteConnectorEA.mq5`
- Public downloadable EA: `public/mt5/ForexSiteConnectorEA.mq5`
- API routes: `src/app/api/mt5/*`
- Repository: `src/lib/mt5-repository.ts`
- Portfolio bridge: `src/lib/mt5-portfolio-risk.ts`
- Tests: `tests/unit/mt5*.test.ts*`

MT5 sync is read-only. Real MT5 rows must not be written into `/api/portfolio-risk` as manual positions.

### Stock Valuation

- UI entrypoint: `src/components/stock-valuation-panel.tsx`
- Feature implementation: `src/features/valuation/`
- Calculation engine: `src/lib/stock-valuation.ts`
- Autofill/parsers: `src/lib/stock-valuation-autofill.ts`
- Persistence: `src/lib/stock-valuation-repository.ts`
- API routes: `src/app/api/valuation/*`
- Tests: `tests/unit/stock-valuation*.test.ts*`, `tests/unit/valuation-routes.test.ts`

Formula tests assert known workbook parity; do not change valuation math without updating tests intentionally.

### Market Dashboard

- Data sync/repository: `src/lib/data/`
- Fetchers: `src/lib/data/fetchers/`
- COT: `src/lib/cot.ts`, `src/components/cot-position-table.tsx`, `src/components/charts/cot-delta-chart.tsx`
- Calendar: `src/lib/calendar-*`, `src/components/calendar-board.tsx`
- Scoring: `src/lib/scoring.ts`

## Shared UI

- App shell: `src/components/app-shell.tsx`
- Generic chart wrapper: `src/components/charts/base-chart.tsx`
- Small shared cards/buttons/badges: `src/components/metric-card.tsx`, `src/components/section-card.tsx`, `src/components/source-health-badge.tsx`

Feature-specific UI should live under `src/features/<feature>/` and expose a stable wrapper from `src/components/` only when old imports need compatibility.

## Backend And Data

- Supabase client/server helpers: `src/lib/supabase/`
- Auth helpers: `src/lib/auth.ts`
- Schema reference: `supabase/schema.sql`
- Cron reference: `supabase/cron.sql`
- Legacy Firebase files remain in the repo but production hosting is Vercel.

## Generated Or Local Tooling

These are not source-of-truth code:

- `.next/`
- `.vercel/`
- `node_modules/`
- `graphify-out/`
- `test-results/`
- `.obsidian/`
- `.claude/`
- `.superpowers/`
