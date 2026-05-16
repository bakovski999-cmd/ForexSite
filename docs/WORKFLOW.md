# ForexSite Workflow

## Before Editing

Use only the active project workspace unless the user explicitly asks for another checkout:

```bash
cd /Users/bakovski/ForexSite
git fetch origin
git status --short
git rev-parse HEAD
git rev-parse origin/main
```

Expected for normal work: `HEAD` should match `origin/main`, or the difference should be intentional and understood.

Do not make new code edits in `/Users/bakovski/.config/superpowers/worktrees/ForexSite/mt5-live-sync` unless the user explicitly asks for that old feature worktree. It is no longer the default workspace.

## Local Development

```bash
npm install
npm run dev
```

Open `/login` first. Most app pages redirect to `/login` without an authenticated Supabase session.

## Standard Verification

Run these before commit:

```bash
npm run lint
npm run test
npm run build
```

For targeted work, run the nearest unit tests first, then full verification:

```bash
npm run test -- tests/unit/portfolio-risk.test.ts tests/unit/portfolio-risk-live-mode.test.tsx
npm run test -- tests/unit/stock-valuation.test.ts tests/unit/stock-valuation-panel.test.tsx
```

## Commit And Deploy

Only stage relevant source/docs changes:

```bash
git status --short
git add <relevant-files>
git commit -m "<clear message>"
git push origin HEAD:main
```

After push, verify the Vercel production deployment is `READY`.

## Files To Keep Local

Do not commit these unless the user explicitly requests it:

- `.obsidian/`
- `.claude/`
- `.superpowers/`
- local memory timestamps
- `.env*`
- `.next/`
- `.vercel/`
- `node_modules/`
- `graphify-out/`
- `test-results/`

## Next.js 16 Rule

This project uses Next.js 16. Before changing App Router behavior, server/client boundaries, route handlers, redirects, cache behavior, or middleware, inspect the local docs in:

```bash
node_modules/next/dist/docs/
```

Do not rely on older Next.js assumptions when the local docs disagree.
