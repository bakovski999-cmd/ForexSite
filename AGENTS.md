<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


# ForexSite Agent Rules

## Source Of Truth

- Production branch: `main`
- Live URL: `https://forex-site-chi.vercel.app`
- Active project workspace: `/Users/bakovski/ForexSite`
- Before editing, run `git fetch origin`, `git status --short`, and compare `HEAD` with `origin/main`.
- Do not make new code edits in `/Users/bakovski/.config/superpowers/worktrees/ForexSite/mt5-live-sync` unless the user explicitly asks for that worktree. It is an old feature worktree, not the current source of truth.
- Local memory/tooling folders may exist in the active workspace. Treat them as helper context, not commit targets.

## Local Memory

If available, read local helper context before project work:

1. `/Users/bakovski/ForexSite/.obsidian/codex-memory/current-state.md`
2. `/Users/bakovski/ForexSite/.obsidian/codex-memory/project-memory.md`
3. `/Users/bakovski/ForexSite/.obsidian/codex-memory/next-tasks.md`

Treat these files as local memory only. Verify against code, tests, Git history, and production.

## Do Not Commit Unless Explicitly Requested

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

## Project Map

- Read `docs/PROJECT_MAP.md` for routes and feature ownership.
- Read `docs/WORKFLOW.md` for local run, verification, commit, and deploy workflow.
