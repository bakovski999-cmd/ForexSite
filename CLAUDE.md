@AGENTS.md

## Local knowledge graph

This project may have a local graphify knowledge graph at `graphify-out/`.

Rules:
- Treat graphify output as optional local tooling, not source-of-truth project code.
- Prefer `docs/PROJECT_MAP.md`, `docs/WORKFLOW.md`, tests, and current source files for implementation decisions.
- Do not commit `graphify-out/`.
