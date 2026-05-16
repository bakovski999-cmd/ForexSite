# Portfolio Risk Feature

Runtime entrypoint:
- Compatibility wrapper: `src/components/portfolio-risk-manager.tsx`
- Implementation root: `src/features/portfolio-risk/portfolio-risk-manager.tsx`

Core dependencies:
- Calculation engine: `src/lib/portfolio-risk.ts`
- Persistence and fallback metadata: `src/lib/portfolio-risk-repository.ts`
- API route: `src/app/api/portfolio-risk/route.ts`

Important behavior:
- Production Supabase may not have optional lots/sales tables or newer columns.
- Lots, sales, and manual planning metadata must keep working through hidden `saved_positions.notes` metadata.
- Do not show users migration/schema instructions as the fix for missing optional tables.
- MT5 live rows are read-only and must not be saved as manual portfolio positions.

Useful tests:
- `npm run test -- tests/unit/portfolio-risk.test.ts tests/unit/portfolio-risk-live-mode.test.tsx`
- `npm run test -- tests/unit/portfolio-risk-api.test.ts tests/unit/portfolio-risk-mt5-sync.test.ts`
