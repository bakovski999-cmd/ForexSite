# Valuation Feature

Runtime entrypoint:
- Compatibility wrapper: `src/components/stock-valuation-panel.tsx`
- Implementation root: `src/features/valuation/stock-valuation-panel.tsx`

Core dependencies:
- Calculation engine: `src/lib/stock-valuation.ts`
- Autofill and parser pipeline: `src/lib/stock-valuation-autofill.ts`
- Persistence: `src/lib/stock-valuation-repository.ts`
- API routes: `src/app/api/valuation/*`

Important behavior:
- Formula tests assert known workbook parity; do not change valuation math without intentionally updating tests.
- Autofill values are helpers. Missing or uncertain values should stay editable instead of blocking the workspace.
- Historical multiples are informational and applied to scenarios only through explicit user action.
- FinanceCharts is a benchmark link, not the primary production data source.

Useful tests:
- `npm run test -- tests/unit/stock-valuation.test.ts tests/unit/stock-valuation-panel.test.tsx`
- `npm run test -- tests/unit/stock-valuation-autofill.test.ts tests/unit/valuation-routes.test.ts`
