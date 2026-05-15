# ForexSite Workflow

## Before Editing

Use the deployed worktree unless the user explicitly asks for another checkout:

```bash
cd /Users/bakovski/.config/superpowers/worktrees/ForexSite/mt5-live-sync
git fetch origin
git status --short
git rev-parse HEAD
git rev-parse origin/main
```

Expected for normal work: `HEAD` should match `origin/main`, or the difference should be intentional and understood.

The checkout at `/Users/bakovski/ForexSite` may contain local memory files and may lag behind production. Do not use it for code edits until it is fast-forwarded or deliberately selected.

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
