# Project Research Summary

**Project:** Buildable Dashboard — Remaining Features (Milestone 2)
**Domain:** Business dashboard — Excel migration, admin settings, permissions, PDF/CSV export, Xero API integration
**Researched:** 2026-02-06
**Confidence:** MEDIUM (training knowledge only, but strong codebase analysis)

## Executive Summary

This research covers the remaining features needed to complete the Buildable Dashboard Phase 1: migrating 30 weeks of historical Excel data, building admin configuration and user management interfaces, implementing PDF/CSV export functionality, and scaffolding Xero API integration. The dashboard's core views are already built and working, so this milestone is about making the system production-ready with real data, proper access control, and essential export capabilities.

The recommended approach prioritizes **data integrity and validation** above polish. Excel migration is the highest-risk task due to the workbook's transposed layout (weeks as columns, metrics as rows) and data quality issues (merged cells, formula errors). Admin settings must ship before PDF export because PDF generation requires branding configuration. Xero OAuth2 integration is well-defined but blocked on credentials from the client. Use Puppeteer for server-side PDF generation to correctly render Recharts SVG charts, despite the ~300MB Chromium dependency.

The critical risk is **silent data corruption during Excel migration**. The transposed Excel layout will destroy naive parsers that expect row-per-record CSV format. Mitigation: write sheet-specific readers with hardcoded cell references, validate against known reference values from the PDF sample (Week 30 Net Profit $62,210.45, Cairns $24,560.60), and implement per-week import rather than a single transaction to isolate failures.

## Key Findings

### Recommended Stack

The core stack is already established (React 19.2 + Vite + Express + Prisma + PostgreSQL). Research identifies four new libraries needed for remaining features:

**New dependencies:**
- **ExcelJS** (^4.4) — Read complex .xlsx files with transposed layouts, merged cells, and formula values. Preferred over SheetJS for its object-oriented API which makes cell-by-cell traversal straightforward.
- **Puppeteer** (^23/^24) — Server-side PDF generation using headless Chrome. Renders actual React dashboard views (including Recharts SVG charts) to pixel-perfect PDFs. No alternative works reliably for chart-heavy pages.
- **xero-node** (^5/^6) — Official Xero SDK for Node.js. Handles OAuth2 token management, automatic refresh, and provides typed API methods for all Xero endpoints.
- **PapaParse** (already installed 5.5.2) — CSV export via `Papa.unparse()`. Zero new dependency needed for CSV generation.

**Key decisions:**
- ExcelJS over SheetJS because the Weekly_Report__30.xlsx has transposed layouts and merged header cells. ExcelJS's `worksheet.getCell('C5')` coordinate access is essential.
- Puppeteer over client-side html2canvas because Recharts renders to SVG and html2canvas has poor SVG support (produces blank rectangles).
- xero-node over raw HTTP because OAuth2 token lifecycle is complex (30-min access token expiry, 60-day refresh token expiry) and the official SDK handles all edge cases.

### Expected Features

**Must have (table stakes):**
- **Excel data migration** — Without 30 weeks of historical data, the dashboard shows empty charts. The most critical feature.
- **Admin settings (branding, pass-through items)** — PDF export needs logo/company name; Financial views need pass-through items list for Net Revenue toggle.
- **User management (roles, permission matrix)** — Role-based access control is required before production. Backend already exists; needs UI.
- **CSV export** — Directors need to pull data into Excel for ad-hoc analysis. Low complexity, high value.
- **PDF export** — Directors share weekly reports with the board. Complex (Puppeteer setup) but essential workflow.
- **End-to-end validation** — Must verify Week 30 values match Excel reference before go-live.

**Should have (competitive):**
- **Xero OAuth2 scaffold** — Credentials not available yet, but code should be ready. Manual CSV upload works until Xero is connected.
- **Admin settings (alert thresholds)** — Config UI for Phase 2 alert engine. Build UI now, engine later.
- **Xero mock mode** — Development cannot be blocked on live credentials.

**Defer (v2+):**
- **Export scheduling** — Auto-generate weekly PDF. Nice to have but manual export acceptable initially.
- **Chart of accounts mapping UI** — Only needed after Xero is connected.
- **Real-time Xero sync (webhooks)** — Local Windows server cannot receive webhooks without tunnelling. Scheduled sync sufficient for weekly reporting.

### Architecture Approach

The codebase follows a **layered monorepo pattern** with domain-grouped routes and service-layer business logic. Existing patterns are well-established: auth middleware chains, permission checks via `requirePermission()`, Zod validation, Prisma singleton, React Context for global state.

**Major new components:**

1. **Excel Migration Scripts** (`server/scripts/migrate-excel.ts`) — One-time utilities, not runtime server code. Write sheet-specific readers for each of the 12 Excel sheets. Use ExcelJS to read transposed layouts (weeks as columns). Transpose programmatically and upsert into Prisma with `data_source: 'backfilled'`. Validate against PDF reference values.

2. **Admin Settings Service** (`SettingsService.ts`) — Key-value JSON pattern using existing `Setting` model. Typed getters with defaults. Stores branding (logo, colors), pass-through items list, alert thresholds, Xero connection status. Consumed by PDF export, financial views, and Xero integration.

3. **PDF Export Service** (`PdfService.ts`) — Puppeteer browser pool pattern. Server generates PDFs by navigating headless Chrome to `localhost:6000/page?weekEnding=X&print=true`. React app detects `?print=true` and renders print-optimized layout (no sidebar, branding header from settings). Returns PDF buffer as download.

4. **Xero Integration** (`XeroService.ts` + `XeroSyncService.ts`) — OAuth2 authorization code flow with dedicated `XeroToken` table (encrypted tokens, expiry tracking). Scheduled sync via `node-cron` (daily at 6 AM AEST). Maps Xero P&L reports to `financial_weekly`, invoices to `revenue_weekly`, bank summaries to `cash_position_weekly`. Rate limiting: max 1 request/second (within 60/min limit).

5. **Permission Matrix UI** (`PermissionMatrix.tsx`) — Grid view: users as rows, dashboard pages as columns, toggle Read/Write/No Access per cell. Only store explicit overrides (role defaults handle the rest). Batch update pattern with transaction.

6. **Export Endpoints** (`routes/exports.ts`) — CSV uses PapaParse `unparse()` on server-side data. PDF uses Puppeteer. Shared route file, separate service logic.

### Critical Pitfalls

1. **Transposed Excel layout destroys naive parsers** — The workbook stores weeks as columns and metrics as rows. Standard row-by-row parsing produces garbage data that looks plausible (numbers in right magnitude) but is assigned to wrong weeks. **Avoid by:** Writing dedicated Excel readers with hardcoded cell references per sheet. Transpose programmatically. Validate Week 30 values against PDF reference.

2. **Merged cells, #REF!, #DIV/0! silently corrupt migration** — Merged cells return `undefined` for all cells except top-left. Formula errors (`#REF!`) fail Prisma Decimal validation. **Avoid by:** Propagating merged cell values to all cells in range. Checking `cell.type === 'e'` and mapping to `null`. Importing each week independently (not one giant transaction) to isolate failures.

3. **Xero refresh token silent expiry breaks automated sync** — Access tokens expire every 30 min, refresh tokens expire after 60 days of non-use. Holiday shutdown (Dec-Jan) risks token expiry. Sync fails silently, dashboard shows stale data. **Avoid by:** Proactive token refresh every 7 days (keep-alive cron). Warning banner when <14 days from expiry. Self-service "Reconnect to Xero" button in admin.

4. **Xero rate limits cause data gaps during backfill** — 60 calls/min, 5000/day. Initial 12-month backfill can hit limits. **Avoid by:** Request queue with 1/sec rate limit. Use monthly P&L reports (12 calls) not weekly (52 calls). Track sync progress in database. Show backfill progress in admin.

5. **PDF export of Recharts SVG charts produces blank output** — html2canvas has poor SVG support. ResponsiveContainer has zero dimensions in headless mode. Async data loading captures skeleton screens. **Avoid by:** Using Puppeteer (not html2canvas). Setting explicit viewport dimensions. Waiting for `networkidle0` or `data-testid="chart-loaded"`. Disabling Recharts animations in print mode.

6. **Permission middleware fires N+1 database queries** — `requirePermission()` queries `user_permissions` table on every route. Dashboard pages make 5-8 parallel API calls, each querying permissions independently. Adds 50-100ms latency. **Avoid by:** Loading all user permissions once on auth, caching in `req.user.permissions`. Change middleware to in-memory lookup (zero DB queries).

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation (Admin Settings + Permission Matrix)
**Rationale:** Admin settings is foundational for downstream features. PDF export needs branding configuration. Financial views need pass-through items list. Xero integration writes connection status to settings. Permission matrix completes the user management backend that already exists.

**Delivers:**
- Admin settings page (branding, pass-through items, alert thresholds, system status)
- User management page (user list, role assignment, permission matrix grid)
- SettingsService with typed access and defaults

**Addresses:**
- Admin Settings (table stakes from FEATURES.md)
- User Management (table stakes from FEATURES.md)

**Avoids:**
- Admin settings silently affecting financial calculations (Pitfall: log all changes, show last-modified metadata)

**Research flag:** Standard CRUD patterns. Skip `/gsd:research-phase`.

---

### Phase 2: Excel Data Migration
**Rationale:** Can run in parallel with Phase 1 (no dependencies). High-risk due to transposed layout and data quality issues. Needs dedicated focus. Blocks validation phase.

**Delivers:**
- Migration scripts (`server/scripts/migrate-excel.ts`) with per-sheet readers
- 30 weeks of historical data imported with `data_source: 'backfilled'`
- Validation report comparing imported values to PDF reference

**Addresses:**
- Excel Data Migration (highest priority from FEATURES.md)

**Avoids:**
- Transposed Excel layout destroying parsers (Critical Pitfall #1)
- Merged cells and formula errors corrupting data (Critical Pitfall #2)

**Research flag:** Complex data transformation. May need `/gsd:research-phase` to understand Excel workbook structure sheet-by-sheet. Recommend opening the actual .xlsx file during planning.

---

### Phase 3: CSV Export
**Rationale:** Simple implementation (PapaParse already installed). No dependencies on other phases. High user value. Quick win to build momentum.

**Delivers:**
- Export endpoints (`GET /api/v1/exports/csv/:page`)
- ExportButtons component updated with real download functionality
- Australian date format (DD/MM/YYYY), currency formatting

**Addresses:**
- CSV Export (table stakes from FEATURES.md)

**Avoids:**
- No major pitfalls (straightforward feature)

**Research flag:** Standard pattern. Skip `/gsd:research-phase`.

---

### Phase 4: PDF Export (Puppeteer)
**Rationale:** Depends on Admin Settings (Phase 1) for branding. Complex implementation but clear path. Puppeteer setup needs verification on Windows 11 server.

**Delivers:**
- PdfService with browser pool
- Print-optimized layouts (`?print=true` query param)
- Branded PDF header/footer from settings
- Export endpoints (`GET /api/v1/exports/pdf/:page`)

**Addresses:**
- PDF Export (table stakes from FEATURES.md)

**Uses:**
- Puppeteer for server-side rendering (from STACK.md)

**Avoids:**
- Blank SVG charts in PDF output (Critical Pitfall #5)
- Puppeteer compatibility issues on Windows 11 (verify Chromium install during implementation)

**Research flag:** Library integration. May need `/gsd:research-phase` to prototype Puppeteer setup and verify Windows compatibility before full build.

---

### Phase 5: Xero OAuth2 Integration
**Rationale:** Depends on Admin Settings (Phase 1) for connection status display. Complex OAuth2 flow and token management. Credentials not available yet, so scaffold the code but don't block launch.

**Delivers:**
- XeroService (OAuth2 flow, token management)
- XeroSyncService (data transformation: Xero API → Prisma schema)
- `XeroToken` table (encrypted storage)
- Scheduled sync job (`node-cron`)
- Mock mode for development

**Addresses:**
- Xero API Integration (should-have from FEATURES.md)

**Uses:**
- xero-node SDK (from STACK.md)

**Implements:**
- Xero integration architecture component (from ARCHITECTURE.md)

**Avoids:**
- Refresh token silent expiry (Critical Pitfall #3)
- Rate limit data gaps during backfill (Critical Pitfall #4)
- Storing tokens as plaintext (Security mistake from PITFALLS.md)

**Research flag:** OAuth2 flow and Xero API mapping are complex. Recommend `/gsd:research-phase` to verify xero-node SDK current version, understand Xero P&L report structure, and design account mapping strategy.

---

### Phase 6: End-to-End Validation
**Rationale:** Final phase. Depends on Excel migration (Phase 2) providing data to validate. Verifies system accuracy before go-live.

**Delivers:**
- Seed script combining migration data + test targets
- Automated validation comparing Week 30 to reference values
- CSV round-trip test (export → re-import → compare)
- Performance benchmark (Executive Summary <2s)
- Target resolution validation (effective date logic)

**Addresses:**
- End-to-End Validation (table stakes from FEATURES.md)

**Avoids:**
- Validating against wrong reference values (must match PDF sample exactly)
- Shipping without performance verification (2s load time mandated in spec)

**Research flag:** Testing patterns. Standard validation approach. Skip `/gsd:research-phase`.

---

### Phase Ordering Rationale

- **Admin Settings first (Phase 1)** because PDF export needs branding and Financial views need pass-through items configuration. Foundational for other features.
- **Excel Migration parallel/early (Phase 2)** because it's independent but high-risk. Needs dedicated focus. Blocks validation phase.
- **CSV before PDF (Phases 3-4)** because CSV is simple and quick, building momentum. PDF is complex and depends on Admin Settings completing.
- **Xero after Admin Settings (Phase 5)** because connection status displays on admin page. Also complex OAuth2 flow benefits from team experience gained on simpler phases.
- **Validation last (Phase 6)** because it requires Excel migration data and validates the entire system.

**Parallel build opportunities:**
- Phase 1 (Admin Settings) and Phase 2 (Excel Migration) can run simultaneously — zero dependencies
- Phase 3 (CSV Export) can overlap with Phase 4 (PDF Export) if resources allow

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 2 (Excel Migration):** Complex Excel workbook structure with 12 sheets, each with different transposed layouts. Recommend `/gsd:research-phase` to analyze actual .xlsx file structure sheet-by-sheet.
- **Phase 4 (PDF Export):** Puppeteer Windows compatibility, print CSS optimization, Recharts animation handling. Recommend `/gsd:research-phase` to prototype Puppeteer setup on target server.
- **Phase 5 (Xero Integration):** OAuth2 flow details, Xero API P&L report structure, account mapping strategy. Recommend `/gsd:research-phase` to verify xero-node SDK and design data transformation.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Admin Settings):** Standard CRUD with settings table and form UI
- **Phase 3 (CSV Export):** PapaParse already installed, straightforward data formatting
- **Phase 6 (Validation):** Standard testing patterns, comparison against known values

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | ExcelJS, Puppeteer, xero-node are well-established (training data), but exact versions and Windows compatibility not verified via web. PapaParse already installed (HIGH confidence). |
| Features | HIGH | All features derived from explicit task specifications in `Buildable_Dashboard_Phase1_Task_Sequence.md` and verified against existing codebase patterns. |
| Architecture | HIGH | Existing codebase thoroughly analyzed. New components follow established patterns (domain-grouped routes, service layer, Prisma singleton). Integration points clearly defined. |
| Pitfalls | MEDIUM | Critical pitfalls identified from codebase analysis (permission N+1 queries observed, transposed Excel layout in spec) and training knowledge (Puppeteer SVG rendering, Xero token expiry). Web verification unavailable but patterns are well-documented. |

**Overall confidence:** MEDIUM

Research is strong on "what to build" (HIGH confidence from specs and codebase) but limited on "how specific libraries work today" (MEDIUM confidence due to training data only). Recommend quick npm/documentation checks during implementation for ExcelJS, Puppeteer, and xero-node current APIs.

### Gaps to Address

- **Puppeteer on Windows 11:** Training knowledge says Puppeteer works on Windows, but the production server is a specific Windows 11 local install. Verify Chromium binary download and permissions during Phase 4 planning. May need `executablePath` configuration.

- **Xero credentials timeline:** Integration is well-defined but blocked on `XERO_CLIENT_ID` and `XERO_CLIENT_SECRET` from client (180D). Mock mode enables development, but OAuth2 flow cannot be tested end-to-end until credentials available. Build mock-first, test with real Xero last.

- **Excel workbook sheet structure:** Research knows the layout is transposed and has merged cells, but exact cell coordinates for each metric per sheet are in the actual .xlsx file, not in documentation. Recommend opening `Weekly_Report__30.xlsx` during Phase 2 planning to map cell ranges.

- **Permission N+1 query fix:** This is an existing performance issue (observed in codebase). Research recommends caching permissions in auth middleware. Should be addressed during Phase 1 or as a hot-fix — not deferred.

- **Chart of accounts mapping:** Xero account names vary by organisation. Research recommends a configurable mapping table but this is deferred to post-MVP. Initial Xero sync may require hardcoded mappings. Flag for Phase 5 planning.

## Sources

### Primary (HIGH confidence)
- **Existing codebase:** `server/src/index.ts`, `server/src/routes/*.ts`, `server/src/services/*.ts`, `server/prisma/schema.prisma`, `client/src/App.tsx`, `client/src/components/ui/ExportButtons.tsx` — observed architecture patterns, existing integrations, permission middleware N+1 issue
- **Project specifications:** `Buildable_Dashboard_Phase1_Task_Sequence.md` (Tasks 13-18), `CLAUDE.md`, `.planning/PROJECT.md` — feature requirements, Excel workbook details, business rules
- **Codebase planning docs:** `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/INTEGRATIONS.md`, `.planning/codebase/CONCERNS.md`, `.planning/codebase/STACK.md` — current state documentation

### Secondary (MEDIUM confidence)
- **Training knowledge (January 2025 cutoff):** ExcelJS 4.x API for reading complex Excel files with merged cells and transposed layouts. Puppeteer PDF generation with headless Chrome. xero-node SDK for OAuth2 and Xero API consumption. PapaParse `unparse()` for CSV generation. Xero OAuth2 token lifecycle (30-min access, 60-day refresh). Xero rate limits (60/min, 5000/day). Recharts SVG rendering issues with html2canvas.

**Note:** WebSearch, WebFetch, and npm tools were unavailable during research session. All library recommendations use caret ranges (e.g., `^4.4`) to allow minor version flexibility. Exact versions, breaking changes, and Windows-specific installation notes should be verified at install time via `npm view <package> version` and official documentation.

---
*Research completed: 2026-02-06*
*Ready for roadmap: YES*
