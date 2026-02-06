# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-06)

**Core value:** April can upload weekly data and directors see accurate, reliable financial and operational reports
**Current focus:** All 4 phases complete. Milestone v1.0 ready for audit.

## Current Position

Phase: 4 of 4 (Validation & Go-Live) -- COMPLETE
Plan: 2 of 2 complete in current phase (04-01 validation backbone, 04-02 performance & validation suite)
Status: All phases complete
Last activity: 2026-02-06 -- Completed Phase 4 (Validation & Go-Live)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: ~13 min
- Total execution time: ~2.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 2/2 | 26m | 13m |
| 2 | 2/2 | 23m | ~12m |
| 3 | 3/3 | 35m | ~12m |
| 4 | 2/2 | 31m | ~16m |

**Recent Trend:**
- Last 5 plans: 03-02 (13m), 03-03 (16m), 04-01 (16m), 04-02 (15m)
- Trend: Stable (~15m average)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Phases 1 and 2 run in parallel (Admin/User Management has no dependency on Excel Migration and vice versa)
- [Roadmap]: Export and Xero combined into single phase (quick depth compression) with 3 separate plans
- [Roadmap]: Validation is final phase, depends on both migration data and export functionality
- [01-01]: Tag-list pattern for pass-through items (compact for short lists)
- [01-01]: Inline styles for dynamic branding colours in sidebar (replaces hard-coded Tailwind classes)
- [01-01]: express.static for uploads placed before auth middleware (logo loads without auth)
- [01-01]: Merge-safe upsert pattern in SettingsService (prevents race condition)
- [01-02]: Exported permission constants rather than duplicating (reuse in users route)
- [01-02]: Full 13-page permission replacement on save (not partial upsert)
- [01-02]: parseId helper for safe Express route param parsing
- [02-01]: Centralised extractCell() for all ExcelJS cell value types (formula errors, uncached formulas, rich text, hyperlinks)
- [02-01]: Formula errors and uncached formulas set to 0 with logged warnings (never abort migration)
- [02-01]: Separate multer config for migration (20MB, .xlsx/.xls) to avoid interfering with CSV upload
- [02-01]: In-memory buffer storage for uploaded workbooks with 30-minute auto-expiry
- [02-01]: Marketing data combined from APP + BA sheets by summing metrics per platform per week
- [02-01]: Background import with immediate HTTP response (non-blocking)
- [02-01]: Per-parser error isolation (one sheet failure doesn't abort entire migration)
- [02-02]: State machine wizard pattern (idle -> preview -> importing -> complete)
- [02-02]: EventSource SSE hook for real-time progress
- [02-02]: Blob URL for client-side warning report download
- [03-01]: No PapaParse on client -- lightweight RFC 4180 CSV generator instead
- [03-01]: AUD_FORMATTER outputs plain toFixed(2) numbers for Excel compatibility
- [03-01]: Each page exports its primary data table (not all tables combined)
- [03-01]: ExportButtons uses callback prop pattern (parent owns data + column definitions)
- [03-03]: Mock mode defaults to true when XERO_MOCK_MODE not set (safe development default)
- [03-03]: AES-256-GCM token encryption with random IV per encryption (iv:authTag:ciphertext hex format)
- [03-03]: Direct Xero API fetch for token exchange instead of SDK (avoids version coupling)
- [03-03]: Refresh token mutex prevents concurrent refresh attempts
- [03-03]: Separate xeroApi.ts client library (not merged into settingsApi.ts)
- [03-03]: Rate limiter uses 55/min headroom and 4800/day safety margin
- [03-03]: Realistic mock data ranges match Buildable financial structure
- [03-02]: Hash-based routing (#/print/:page) to avoid state-based routing conflicts
- [03-02]: data-print-ready attribute signals Puppeteer when content loaded
- [03-02]: isAnimationActive={false} on all Recharts for static PDF capture
- [03-02]: Fixed-width containers for print pages (1200px portrait, 1600px landscape)
- [03-02]: PUPPETEER_EXECUTABLE_PATH env var for Edge fallback on Windows 11
- [04-01]: API-level comparison instead of direct DB queries -- tests full stack including computed metrics
- [04-01]: Seed reference JSON with known roadmap values until actual workbook provided
- [04-01]: __dirname instead of import.meta.url (CJS project, no type:module)
- [04-01]: Cash position only extracted for latest week (single-week snapshot sheet)
- [04-01]: Cumulative review count = running sum of weekly review counts
- [04-02]: Print routes used for performance benchmarking (exercises same API calls and data rendering)
- [04-02]: CSV round-trip tests serialisation/deserialisation without modifying database
- [04-02]: Target workflow uses breakeven type with far-past date to avoid conflicts
- [04-02]: ValidationPanel uses expandable sections (not tabs) for simpler implementation
- [04-02]: data-loaded attribute pattern on dashboard pages for render completion signalling

### Pending Todos

- Re-run extraction script when Excel workbook is available: `npx tsx server/src/scripts/extract-reference.ts [path]`

### Blockers/Concerns

- Xero developer app credentials pending from 180D -- scaffold complete with mock mode, ready to activate when credentials arrive
- Azure AD app registration pending from 180D -- dev auth bypass in place
- Excel workbook not on build machine -- seed reference JSON used; full validation requires re-extraction

## Session Continuity

Last session: 2026-02-06
Stopped at: All phases complete. Milestone v1.0 ready for audit.
Resume file: None

## Milestone Complete

All 4 phases delivered:
- Phase 1: Admin & User Management (26min, 2 plans)
- Phase 2: Excel Data Migration (23min, 2 plans)
- Phase 3: Export & Xero Integration (35min, 3 plans)
- Phase 4: Validation & Go-Live (31min, 2 plans)

Total: 9 plans, ~2.0 hours execution time
33/33 v1 requirements complete
