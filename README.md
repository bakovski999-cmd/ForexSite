# ForexSite

Private trading and valuation workspace hosted on Vercel.

- Live site: https://forex-site-chi.vercel.app
- Production branch: `main`
- Primary backend: Supabase
- Active local workspace: `/Users/bakovski/ForexSite`
- Main authenticated tools:
  - `/risk-calculator` - risk calculator, portfolio risk, lots/sales planning, MT5 live sync
  - `/valuation` - stock fair value workspace with DCF, EV/EBITDA, P/E, DCF Multiple and historical multiples
  - `/cot`, `/calendar`, `/macro`, `/news`, `/overview`, `/signal-lab` - market dashboard modules

For project structure and agent workflow, read:

- [Project map](docs/PROJECT_MAP.md)
- [Workflow](docs/WORKFLOW.md)

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- ECharts
- Supabase auth and persistence
- Vercel hosting
- MT5 Expert Advisor connector for read-only live account snapshots

Firebase files still exist as legacy project artifacts. Current production hosting is Vercel, not Firebase.

## Local Start

Use `/Users/bakovski/ForexSite` for normal development. Older feature worktrees under `.config/superpowers/worktrees/` are historical and should not receive new edits unless deliberately selected.

Install dependencies:

```bash
npm install
```

Create local env:

```bash
cp .env.example .env.local
```

Start development server:

```bash
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).

If port `3000` is busy, Next.js may choose another local port.

## Verification

Run the standard checks before committing:

```bash
npm run lint
npm run test
npm run build
```

For browser checks, use authenticated routes through `/login`. Without a Supabase session, protected pages redirect to `/login`.

## MT5 Live Sync

The app can receive read-only snapshots from `ForexSiteConnectorEA.mq5`.

Normal user setup:

1. Open `/risk-calculator`.
2. Open the `MT5 Live` area.
3. Click `Свържи MT5 акаунт`.
4. Download the generated EA file.
5. In MT5, enable `Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URL`.
6. Add the site origin, for example `https://forex-site-chi.vercel.app`.
7. Compile the EA in MetaEditor and attach it to one chart.

The EA reads account, open positions, and recent deal history. It does not open, modify, or close trades.

## Portfolio Risk Notes

Portfolio Risk lives in `/risk-calculator`.

Important production constraint: live Supabase may not have newer optional tables/columns. Portfolio lots, sales history, and manual planning metadata must keep working through hidden metadata in `saved_positions.notes`; users should not see instructions to run SQL migrations.

## Stock Valuation Notes

The `/valuation` page provides:

- DCF 10 years
- EV/EBITDA
- P/E
- DCF Multiple
- weighted fair value
- historical FCF helper
- historical multiples modal with FinanceCharts benchmark links

Autofill uses SEC CompanyFacts, Yahoo market data, Alpha Vantage when configured, and best-effort fallback data. Missing or uncertain values remain editable instead of blocking the calculation.

## Useful Commands

```bash
npm run dev
npm run lint
npm run test
npm run build
npm run test:e2e
```

## Local-Only Files

Do not commit local memory/tooling folders unless explicitly requested:

- `.obsidian/`
- `.claude/`
- `.superpowers/`
- `.next/`
- `.vercel/`
- `graphify-out/`
- `test-results/`
