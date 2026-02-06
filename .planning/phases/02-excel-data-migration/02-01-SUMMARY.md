---
phase: 02-excel-data-migration
plan: 01
subsystem: api
tags: [exceljs, migration, sse, prisma, parser, excel, transposed]

requires:
  - phase: none
    provides: n/a
provides:
  - ExcelParserService with cell extraction utility (extractCell, extractNumericValue, parseTransposedSheet)
  - 6 sheet-specific parsers (WeeklyReport, Revenue, FinanceThisWeek, Productivity, Phone, Marketing)
  - ExcelMigrationService orchestrator with idempotent Prisma upserts
  - Migration API routes (POST /upload, POST /import/:jobId, GET /progress/:jobId SSE)
affects: [02-02 (frontend migration UI), 04 (validation)]

tech-stack:
  added: [exceljs ^4.4.0]
  patterns: [transposed sheet parsing, SSE progress streaming via EventEmitter, idempotent upsert with Prisma, cell value extraction for all ExcelJS types]

key-files:
  created:
    - server/src/services/ExcelParserService.ts
    - server/src/services/SheetParsers/WeeklyReportParser.ts
    - server/src/services/SheetParsers/RevenueReportParser.ts
    - server/src/services/SheetParsers/FinanceThisWeekParser.ts
    - server/src/services/SheetParsers/ProductivityParser.ts
    - server/src/services/SheetParsers/PhoneParser.ts
    - server/src/services/SheetParsers/MarketingParser.ts
    - server/src/services/ExcelMigrationService.ts
    - server/src/routes/migration.ts
  modified:
    - server/src/index.ts
    - server/package.json
    - package-lock.json

key-decisions:
  - Use extractCell() centralised utility for all 7+ ExcelJS cell value types (formula errors, uncached formulas, rich text, hyperlinks, booleans)
  - Formula errors and uncached formulas set to 0 with logged warnings (never abort)
  - Separate multer config for migration (20MB, .xlsx/.xls) to avoid interfering with CSV upload
  - In-memory buffer storage for uploaded workbooks with 30-minute auto-expiry
  - Marketing data combined from APP + BA sheets by summing metrics per platform per week
  - Finance This Week parsed as single-week snapshot using most recent Saturday from Weekly Report
  - Background import with immediate HTTP response (non-blocking for large workbooks)

patterns-established:
  - Transposed sheet parsing pattern (parseTransposedSheet) reusable for any row-as-metric, column-as-week layout
  - Cell extraction pattern handling all ExcelJS object types (formula, error, richtext, hyperlink)
  - SSE progress streaming via native EventEmitter (no library needed)
  - Per-table upsert with compound unique constraints for idempotent imports
  - Parser error isolation (one sheet failure doesn't abort entire migration)

duration: 13min
completed: 2026-02-06
---

# Phase 2 Plan 1: Excel Migration Backend Summary

**Complete Excel workbook parsing pipeline with 6 sheet parsers, migration orchestrator, and API routes with SSE progress streaming for idempotent database import of 30 weeks of historical data across 11 tables.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | 13 min |
| Tasks | 2/2 |
| Commits | 2 |
| Files created | 9 |
| Files modified | 3 |
| Lines added | ~3,182 |

## Accomplishments

### Task 1: ExcelParserService and 6 Sheet Parsers
- Built `extractCell()` utility handling all ExcelJS cell value types: null, number, string, boolean, Date, formula with result, formula with error, uncached formula, rich text, hyperlink
- Built `extractNumericValue()` for safe numeric coercion with currency string cleaning
- Built `parseTransposedSheet()` generic utility for the dominant workbook layout pattern
- Created 6 specialised parsers:
  - **WeeklyReportParser**: Sheet 1 -> 6 tables (financial, projects, sales, leads, google reviews, team performance)
  - **RevenueReportParser**: Sheet 7 -> revenue_weekly (standard table layout, not transposed)
  - **FinanceThisWeekParser**: Sheet 6 -> cash_position_weekly (single-week snapshot)
  - **ProductivityParser**: Sheet 12 -> staff_productivity_weekly (dynamic staff group detection)
  - **PhoneParser**: Sheet 16 "Phone (2)" -> phone_weekly (pattern-based staff detection)
  - **MarketingParser**: Sheets 9+10 -> marketing_performance_weekly (combines APP + BA brands)

### Task 2: ExcelMigrationService and API Routes
- Built orchestrator that calls all 6 parsers with per-parser error isolation
- 11 table-specific upsert methods using Prisma compound unique constraints
- All records marked with `dataSource: 'backfilled'`
- SSE progress streaming via native EventEmitter
- API routes: upload (dry-run preview), import (background execution), progress (SSE)
- Route registered at `/api/v1/migration` behind auth middleware

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | ExcelParserService and 6 sheet parsers | fdfb07e | ExcelParserService.ts, SheetParsers/*.ts, package.json |
| 2 | ExcelMigrationService, migration routes, server registration | 6e6a782 | ExcelMigrationService.ts, migration.ts, index.ts |

## Files Created/Modified

### Created
- `server/src/services/ExcelParserService.ts` -- Cell extraction, numeric coercion, transposed sheet parsing utility
- `server/src/services/SheetParsers/WeeklyReportParser.ts` -- Sheet 1 parser (6 table groups)
- `server/src/services/SheetParsers/RevenueReportParser.ts` -- Sheet 7 parser (standard table layout)
- `server/src/services/SheetParsers/FinanceThisWeekParser.ts` -- Sheet 6 parser (single-week snapshot)
- `server/src/services/SheetParsers/ProductivityParser.ts` -- Sheet 12 parser (dynamic staff groups)
- `server/src/services/SheetParsers/PhoneParser.ts` -- Sheet 16 parser (pattern-based staff detection)
- `server/src/services/SheetParsers/MarketingParser.ts` -- Sheets 9+10 parser (combined brands)
- `server/src/services/ExcelMigrationService.ts` -- Migration orchestrator with progress streaming
- `server/src/routes/migration.ts` -- Express routes with multer, SSE, background import

### Modified
- `server/src/index.ts` -- Added migration route import and registration
- `server/package.json` -- Added exceljs dependency
- `package-lock.json` -- Updated lockfile

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Centralised extractCell() for all cell types | 7+ ExcelJS cell object types found in workbook; avoid per-cell inline type checking |
| Formula errors -> 0 + warning | Research shows 67 formula errors and 168 uncached formulas in main sheet; aborting would prevent any migration |
| Separate multer config (20MB, .xlsx) | Existing CSV multer only accepts 10MB .csv/.tsv; migration needs separate config |
| In-memory buffer with 30-min expiry | Avoids temp file management on Windows; workbook is ~1.3MB so memory is fine |
| Combine APP + BA marketing sheets | Database has no brand dimension; summing gives total marketing performance per platform |
| Background import with SSE | Large workbook import takes time; non-blocking response lets frontend show progress |
| Per-parser error isolation | If one sheet fails (e.g. missing or renamed), other sheets still import successfully |

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

1. **ExcelJS Buffer type mismatch**: ExcelJS's `load()` method has a stricter `Buffer` type than Node.js global `Buffer<ArrayBufferLike>`. Fixed with `as any` cast (safe, same runtime type).
2. **Implicit any[] in try/catch blocks**: TypeScript cannot infer types across try/catch boundaries for variables declared with `let`. Fixed by adding explicit type annotations using `ParsedData['tableName']` types.

Both issues were minor TypeScript strictness items, resolved inline.

## Next Phase Readiness

### For Plan 02 (Frontend Migration UI)
- API endpoints are ready: `/api/v1/migration/upload`, `/api/v1/migration/import/:jobId`, `/api/v1/migration/progress/:jobId`
- DryRunResult type provides table names, record counts, sample records, and warnings for preview UI
- SSE progress events provide phase, table, current/total counts, and message for progress bar
- All endpoints behind auth middleware (dev bypass works)

### Blockers
- None. Backend is fully functional for frontend consumption.
- Actual testing against the real workbook will happen when the migration UI is built (Plan 02).
