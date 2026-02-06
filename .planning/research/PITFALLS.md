# Pitfalls Research

**Domain:** Business dashboard -- Excel migration, PDF export, Xero API, admin settings, permissions, validation
**Researched:** 2026-02-06
**Confidence:** MEDIUM (training knowledge only -- WebSearch/WebFetch unavailable; verified against existing codebase)

---

## Critical Pitfalls

### Pitfall 1: Transposed Excel Layout Destroys Naive Parsers

**What goes wrong:**
The `Weekly_Report__30.xlsx` workbook stores weeks as columns and metrics as rows (transposed from typical CSV row-per-record format). Standard xlsx parsing libraries (SheetJS/xlsx, ExcelJS) read row-by-row by default. If you feed this transposed layout through the existing CSV column-mapping pipeline without pre-transposition, every "row" is actually a metric label, and every "column" is a week -- meaning the data is silently misaligned. The migration script produces garbage data that *looks* plausible (numbers in the right magnitude) but is assigned to the wrong weeks or wrong metrics.

**Why it happens:**
The existing `CsvParserService.ts` assumes header-in-row-1, data-in-rows-below format. The Excel workbook has headers in column A (metric names) and week-ending dates in row 5 across columns B-AE. Developers try to "just export as CSV" from the workbook, but the transposed layout means a standard CSV export produces one CSV column per week, which the column mapper cannot handle.

**How to avoid:**
1. Write a dedicated Excel reader (not the CSV pipeline) that understands the transposed layout per sheet. Use `xlsx` (SheetJS) to read cell ranges directly.
2. For each sheet, hard-code the known structure: where dates live (row 5 for "Weekly Report"), where metric labels live (column A), and the data region.
3. Transpose programmatically: iterate columns (weeks), then for each column read all metric rows, producing one record per week.
4. Build a sheet-specific adapter for each of the 12 Excel sheets -- they have different layouts. Do NOT try to build a "universal" Excel parser.
5. Validate output against known reference values from the PDF sample (Week 30 Net Profit = $62,210.45, Cairns actual = $24,560.60).

**Warning signs:**
- Migration script runs "successfully" but dashboard values do not match Excel
- Dates parse as serial numbers (Excel stores dates as integers)
- All 30 weeks appear to have the same values (reading a single column repeatedly)

**Phase to address:**
Excel migration phase -- must be solved before any historical data is imported. Write the adapter with hardcoded cell references per sheet, not a generic parser.

---

### Pitfall 2: Merged Cells, #REF!, and #DIV/0! Silently Corrupt Excel Migration

**What goes wrong:**
The workbook contains merged cells (common in header regions and section labels), `#REF!` errors (broken cell references from deleted sheets/columns), and `#DIV/0!` errors (division by zero in calculated fields). SheetJS reads merged cells by placing the value only in the top-left cell of the merged range -- all other cells in the merge return `undefined`. If the migration script does not account for this, entire sections of data appear as null when they actually have values.

For `#REF!` and `#DIV/0!`: SheetJS represents these as objects with an `e` (error) property or as the error string literal. A naive `cell.v` read returns the error string `"#REF!"` which then fails numeric parsing silently or -- worse -- gets stored as a string in a Decimal column, causing a Prisma validation error that aborts the entire transaction.

**Why it happens:**
Merged cells are invisible in the Excel UI but structurally complex in the file format. Error values look like strings when read programmatically. The current `ImportService.ts` uses a 60-second transaction timeout -- if one bad cell causes a Prisma error partway through, the entire 30-week migration rolls back, wasting significant debugging time.

**How to avoid:**
1. Before processing, scan for merged cell ranges using `sheet['!merges']` in SheetJS. For each merged range, propagate the value to all cells in the range.
2. Check each cell for error types: `if (cell.t === 'e')` in SheetJS indicates an error cell. Map these to `null` explicitly.
3. After reading all cells, log a report: how many `#REF!`, `#DIV/0!`, merged regions, and empty cells were found per sheet.
4. Import each week independently rather than in one giant transaction. If Week 27 has sparse data with errors, it fails alone and the other 29 weeks succeed.
5. Cross-reference imported totals against PDF reference values for at least 3 known weeks.

**Warning signs:**
- Sections of nulls where data should exist (merged cell propagation failure)
- Prisma errors mentioning string-to-Decimal conversion
- Transaction timeouts on large imports
- Week 27 (known to have sparse data) causes the entire migration to fail

**Phase to address:**
Excel migration phase. Build the error-handling and merged-cell logic before attempting the first full migration run.

---

### Pitfall 3: Xero OAuth2 Refresh Token Silent Expiry Breaks Automated Sync

**What goes wrong:**
Xero access tokens expire every 30 minutes. Refresh tokens expire after 60 days of non-use. In a small business that might not use the dashboard over a holiday period (Christmas shutdown is common in Australian construction -- late December through mid-January is 3-4 weeks), the refresh token can expire. When it does, the automated daily sync silently fails. If no one checks the admin panel for weeks, financial data stops flowing in and the dashboard shows stale numbers. The directors see "current" dates but old data, eroding trust in the entire system.

**Why it happens:**
Developers implement the initial OAuth2 flow and token refresh correctly for the happy path but do not implement proactive monitoring for token health. The refresh token expiry is not surfaced in Xero's API response until the refresh actually fails. By then, a human must manually re-authenticate through the browser-based OAuth2 consent flow.

**How to avoid:**
1. Store the refresh token's last-used timestamp in the database alongside the token itself. Calculate days-until-expiry as `60 - daysSinceLastRefresh`.
2. Proactively refresh the access token at least once every 7 days even if no sync is scheduled. This resets the 60-day refresh token timer. Implement a "keep-alive" cron job.
3. Show a prominent warning banner in the dashboard when the refresh token is within 14 days of expiry: "Xero connection will expire in X days. An admin must re-connect."
4. When the refresh token has expired, gracefully degrade: show "Xero data last synced: [date]" on all financial views, not a blank error. Queue the re-connection prompt for the next admin login.
5. Send an email to the Super Admin when token expiry is imminent (if email is available).

**Warning signs:**
- `syncProfitAndLoss()` returns 401 errors in server logs
- Dashboard financial data stops updating but no visible error in the UI
- Refresh token age exceeds 45 days in the database
- Holiday periods approaching without recent sync activity

**Phase to address:**
Xero API integration phase. Token health monitoring must ship in the same release as the OAuth2 flow -- not as a "nice to have" later.

---

### Pitfall 4: Xero API Rate Limits Cause Data Gaps During Initial Backfill

**What goes wrong:**
Xero enforces 60 API calls per minute and 5,000 per day. When first connecting Xero, the natural instinct is to backfill historical data (12 months of P&L reports, invoices, bank transactions). Each P&L report request covers one period. If you request weekly P&L for 52 weeks, that is 52 calls just for P&L -- plus invoices, bank summaries, and accounts. Without rate limiting, the API returns 429 (Too Many Requests) and some requests fail silently. The backfill appears complete but has gaps -- certain weeks are missing data.

**Why it happens:**
Developers test against the Xero demo company with small datasets and never hit rate limits. Production backfill with a real organisation hits limits immediately. The `xero-node` SDK does not automatically retry on 429 -- it throws and moves on.

**How to avoid:**
1. Implement a request queue with rate limiting: maximum 1 request per second (well within the 60/min limit), with exponential backoff on 429 responses.
2. For backfill, use monthly P&L reports (12 calls) rather than weekly (52 calls). Disaggregate monthly to weekly using invoice-level data.
3. Track sync progress in the database: which date ranges have been synced. If a backfill is interrupted, resume from where it stopped, not from the beginning.
4. Show backfill progress in the admin panel: "Syncing month 3 of 12... 45 API calls remaining today."
5. Spread initial backfill over multiple days if needed (5,000/day limit).

**Warning signs:**
- 429 status codes in server logs during sync
- Missing weeks in financial data after "successful" Xero sync
- Backfill runs and then dashboard shows gaps in charts
- Sync takes longer than expected (hidden retries)

**Phase to address:**
Xero API integration phase. Rate limiting must be built into the API client wrapper from the start, not bolted on after the first production failure.

---

### Pitfall 5: PDF Export of Recharts SVG Charts Produces Blank or Broken Output

**What goes wrong:**
PDF generation from a React dashboard using Puppeteer or html2canvas encounters three common failures:
1. **Recharts renders to SVG** -- html2canvas historically has poor SVG support, producing blank rectangles where charts should be. The charts render fine in the browser but are missing in the PDF.
2. **Responsive containers have zero dimensions** -- `ResponsiveContainer` in Recharts uses the parent element's dimensions. During server-side rendering or headless capture, the parent may have zero width/height, causing all charts to collapse.
3. **Async data loading** -- Puppeteer captures the page before API calls complete, generating PDFs with loading skeletons instead of actual data.

**Why it happens:**
Developers test PDF export visually in the browser ("it looks right in the print preview") but the headless capture environment behaves differently. html2canvas operates on DOM elements, not the rendered visual output, and SVG conversion is a known weakness. Recharts' responsive sizing depends on DOM layout that may not be computed in headless mode.

**How to avoid:**
1. **Use Puppeteer (not html2canvas + jsPDF) for chart-containing pages.** Puppeteer runs actual Chrome, which renders SVG correctly. Use `page.pdf()` with print media query.
2. Set explicit viewport dimensions in Puppeteer: `page.setViewport({ width: 1200, height: 900 })` so ResponsiveContainer has a real size to use.
3. Wait for data to load before capturing: `page.waitForSelector('[data-testid="chart-loaded"]')` or `page.waitForNetworkIdle()`.
4. Add a `data-testid="chart-loaded"` attribute that is only set after Recharts' `onAnimationEnd` fires.
5. Use `@media print` CSS to ensure charts are sized correctly for paper layout (A4 landscape for wide tables).
6. Disable Recharts animations in print mode (they cause mid-animation captures).
7. Test PDF generation as part of CI -- not just manual spot checks.

**Warning signs:**
- PDFs have blank white rectangles where charts should be
- Charts appear but are tiny (collapsed ResponsiveContainer)
- PDFs show loading spinners or skeleton screens
- PDF works on developer's machine but fails on the Windows 11 server (Puppeteer needs a Chrome binary)

**Phase to address:**
PDF/CSV export phase. Choose Puppeteer early and prototype with one chart page before building the full export system. Verify Puppeteer installs and runs correctly on the Windows 11 server.

---

### Pitfall 6: Permission Middleware Fires a Database Query on Every Route, Creating N+1 Performance

**What goes wrong:**
The existing `requirePermission()` middleware (in `permissions.ts`) calls `prisma.userPermission.findUnique()` on every request. When a dashboard page makes 5-8 parallel API calls (financial, projects, sales, teams, leads, targets, cash position, reviews), each one independently queries the `user_permissions` table. That is 5-8 database round-trips just for permission checks, before any actual data queries. On the Executive Summary page, this adds 50-100ms of unnecessary latency, pushing the page past the 2-second performance target.

**Why it happens:**
The permission middleware is written correctly for *correctness* -- each route independently verifies permission. But it is optimised for single-route scenarios, not for dashboard pages that fan out to many parallel API calls.

**How to avoid:**
1. **Cache permissions in the auth middleware, not the permission middleware.** When the user authenticates (or on first request per session), load ALL of that user's permissions in a single query and attach them to `req.user.permissions` as a Map.
2. Change `requirePermission()` to read from `req.user.permissions` (in-memory lookup, zero DB queries) instead of hitting the database.
3. Set a cache TTL of 5 minutes. Permission changes take effect on next page load, which is acceptable for this use case.
4. For session-based auth, store permissions in the session. For JWT, include permission claims in the token (but beware token size limits if there are many pages).
5. Invalidate the cache explicitly when an admin changes a user's permissions.

**Warning signs:**
- Executive Summary takes >2 seconds on first load
- Database logs show repeated `SELECT * FROM user_permissions WHERE user_id = X` within milliseconds
- Performance degrades linearly with the number of API calls per page
- Adding new dashboard sections makes the page slower

**Phase to address:**
This should be fixed before adding more dashboard pages. Ideally in the admin/permissions phase, but could be a quick fix in any phase. The current codebase already has this pattern and it will compound as more views are added.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hard-coding Excel cell references per sheet | Fast migration, guaranteed correctness for this workbook | If the workbook format changes, migration script is worthless | Always -- this is a one-time migration, not an ongoing import. Hard-code and move on. |
| Storing Xero tokens as plaintext JSON in `settings` table | Quick implementation, easy debugging | Security risk if database is compromised; tokens provide full financial access | Never. Encrypt at-rest using `crypto.createCipheriv()` with a server-side key. |
| Using `(prisma as any)[modelName]` dynamic model access in `ImportService.ts` | Enables generic import for 13+ table types without code duplication | No TypeScript type safety, runtime errors if model name is wrong, no IDE autocomplete | Acceptable for the import engine (already in use). Add runtime validation of model name against a whitelist. |
| Using `settings` table with JSON `value` field for all config | Flexible, avoids migrations for new settings | No type safety, no validation, settings can silently have wrong types, no schema documentation | MVP only. Add a Zod schema validator per setting key before Phase 2. |
| Puppeteer for PDF instead of pure-JS solution (jsPDF) | Correct chart rendering, true WYSIWYG | Puppeteer needs Chromium binary (~300MB), slow startup, memory-heavy on Windows server | Always for chart-containing pages. Use jsPDF only for data-only exports (tables, CSV). |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Xero OAuth2 | Storing refresh token without encryption; treating it like an API key rather than a credential | Encrypt tokens at rest. Store alongside tenant ID, token type, and expiry timestamp. Never log tokens. |
| Xero OAuth2 | Not handling the `tenant_id` (Xero organisation ID); assuming one token = one org | Store and pass `tenant_id` on every API call. A Xero app can be connected to multiple orgs. |
| Xero API | Requesting P&L with `date` parameters in wrong format | Xero expects `YYYY-MM-DD` for date parameters. Australian `DD/MM/YYYY` causes silent 400 errors. |
| Xero API | Mapping Xero account names directly to database fields without a configurable mapping layer | Xero account names vary by organisation setup. Build a "Xero Account -> Dashboard Category" mapping table that admins can configure. |
| Puppeteer on Windows | Assuming Puppeteer auto-downloads Chromium on Windows 11 | Puppeteer's Chromium download can fail behind corporate firewalls. Pre-install Chromium and point Puppeteer to it via `executablePath`. Test on the actual server. |
| xlsx/SheetJS | Using `XLSX.readFile()` which reads the entire workbook into memory | For the 12-sheet workbook this is fine (small file). But if future workbooks are larger, use streaming mode. Not a current risk. |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Permission query per API route | Page load time increases 10-15ms per parallel API call | Load all user permissions once on auth, cache in request/session | Now (5+ parallel calls on Executive Summary already) |
| Fetching 13-week rolling data without database indices on `week_ending` | Queries slow as data accumulates past 52+ weeks | Ensure composite index on `(week_ending, data_source)` for all weekly tables. Prisma `@@index` already exists for targets but verify all tables. | After ~2 years of data (100+ weeks) |
| Generating PDF by loading the full React app in Puppeteer | PDF generation takes 5-10 seconds and consumes 200+ MB RAM | Create a dedicated print-layout route (`/print/executive-summary`) that skips sidebar, animation, and unnecessary JS | Immediately -- first time someone generates a PDF |
| Syncing all Xero data on every scheduled run instead of incremental | Sync time grows linearly; hits daily rate limit as data accumulates | Track `last_synced_date` per data type; only sync from that date forward | After ~6 months of daily syncs |
| Storing rollback data as JSON blob in `csv_uploads.rollback_data` | Works for small uploads, but a 500-row import with `overwritten` records creates a massive JSON blob | Already implemented this way. Set a maximum rollback retention period (e.g., 90 days) and purge old rollback data via cron. | After ~50 large uploads |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Xero OAuth tokens stored as plaintext in `settings` table | Database compromise exposes full financial API access to the company's Xero account | Encrypt tokens using AES-256-GCM with a key from environment variable. Store IV alongside ciphertext. |
| PDF exports containing financial data served without auth check | Anyone with the URL can download financial PDFs | Generate PDFs through authenticated API endpoints only. Use short-lived signed URLs if caching PDFs on disk. |
| Admin settings endpoint allows any authenticated user to change config | Staff member could modify alert thresholds or pass-through items, corrupting financial calculations | The existing `requirePermission('admin_settings', 'write')` pattern must be applied to ALL settings endpoints. Verify this is in place. |
| Excel migration scripts committed with hardcoded test data or file paths | Windows file paths in code (e.g., `C:\Users\April\Documents\`) expose internal structure | Use environment variables for file paths. Do not commit the actual `.xlsx` file to git. |
| CSV upload accepts files >10MB without server-side enforcement | Memory exhaustion on the Windows 11 server (single server, no auto-scaling) | Multer is already configured but verify `limits.fileSize` is enforced. Add a 10MB limit explicitly. |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| PDF export button with no progress indicator | April clicks "Download PDF", nothing happens for 5-10 seconds, she clicks again (spawning duplicate Puppeteer processes) | Show an immediate loading spinner with "Generating PDF..." text. Disable the button until generation completes. |
| Xero reconnection requires developer intervention | When the refresh token expires, April or the directors cannot fix it themselves. They see stale data and panic. | Build a "Reconnect to Xero" button in Admin Settings that triggers the OAuth2 consent flow. Make it self-service for Super Admins. |
| Excel migration validation results are only in server logs | April runs the migration, it "succeeds", but some weeks have missing data. She only discovers this weeks later. | After migration, show a validation report: per-week data completeness, flagged cells, comparison against known reference values. |
| Permission changes require page reload to take effect | Admin changes a user's role but the user still sees old permissions until they close the browser | Display a "Your permissions have been updated" toast and force re-fetch of permissions on next navigation. |
| Admin settings changes silently affect financial calculations | An admin changes pass-through items but nobody notices the Net Revenue figures changed retrospectively | Log all settings changes with who/when/what. Show a "Last modified by [user] on [date]" badge on each setting. |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Excel migration:** Script runs and imports 30 weeks -- but verify Week 27 (known sparse data) imported correctly, not as all-nulls
- [ ] **Excel migration:** Script handles the "Monthly" and "P&L Monthly" sheets which have different transposed layouts from "Weekly Report"
- [ ] **Excel migration:** Script correctly reads Excel serial date numbers (e.g., 45747) not just formatted date strings
- [ ] **PDF export:** Works with all 3 chart types (LineChart, BarChart, stacked BarChart) -- not just the one you tested
- [ ] **PDF export:** Includes page title, selected week, Buildable branding, and generation timestamp -- not just the raw chart
- [ ] **PDF export:** Puppeteer binary exists and runs on the Windows 11 production server, not just the dev machine
- [ ] **Xero integration:** `syncProfitAndLoss()` maps Xero's accrual-basis P&L accounts to the dashboard's `financial_weekly` schema correctly (account names vary by org)
- [ ] **Xero integration:** Handles Xero organisations with non-standard chart of accounts (custom account names, additional accounts)
- [ ] **Xero integration:** The "Sync Now" button in admin actually works when called outside the cron schedule
- [ ] **Xero integration:** Refresh token rotation stores the NEW refresh token (Xero issues a new one on each refresh, the old one is invalidated)
- [ ] **Admin settings:** Changing pass-through items immediately affects the Net Revenue toggle on Financial Deep Dive (not cached stale)
- [ ] **Admin settings:** Alert threshold changes do not require a server restart
- [ ] **Permissions:** Super Admin can actually access every page (not blocked by a missing explicit permission entry)
- [ ] **Permissions:** Staff role correctly sees only Executive Summary and Regional Performance (as defined in `STAFF_READABLE_PAGES`)
- [ ] **Validation:** Dashboard Executive Summary KPI values match Excel PDF reference for Week 30 (Net Profit $62,210.45, Budget $40,203)
- [ ] **Validation:** Revenue (Invoiced) = sum of Resi + Commercial + Retro from `projects_weekly`, NOT from `financial_weekly.total_trading_income`

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Transposed Excel data imported to wrong weeks | MEDIUM | Use the existing rollback engine (`POST /uploads/:id/rollback`) to reverse the import. Fix the transposition logic. Re-import. The `data_source: 'backfilled'` tag makes it easy to identify and purge all migration data. |
| Xero refresh token expired silently | LOW | No data is lost. Trigger the OAuth2 re-consent flow via Admin Settings. Run a manual sync for the missed period. Dashboard self-heals. |
| PDF export shows blank charts | LOW | Switch from html2canvas to Puppeteer `page.pdf()`. No data impact -- purely a rendering issue. |
| Permission N+1 queries causing slow pages | LOW | Add permission caching to auth middleware. No schema changes needed. Can be deployed as a hot-fix. |
| Admin settings change breaks financial calculations | MEDIUM | Settings changes should be logged in `target_history` or a new `settings_audit` table. Roll back the setting to its previous value. Recalculate affected dashboard views. |
| Merged cells cause null data in migration | MEDIUM | Identify affected sheets using the merge report. Fix the merge-propagation logic. Re-run migration (idempotent by design -- uses `overwrite` strategy on duplicate week_ending keys). |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Transposed Excel layout | Excel Migration | Compare 3 reference weeks against PDF values. Every metric in every table matches. |
| Merged cells and #REF! errors | Excel Migration | Migration report shows 0 unexpected nulls in required fields. Error count matches known #REF! count in workbook. |
| Xero refresh token expiry | Xero API Integration | Admin panel shows "Token health: X days remaining". Warning banner appears when <14 days. |
| Xero rate limiting | Xero API Integration | Full backfill of 12 months completes without 429 errors. Progress tracked in database. |
| PDF blank charts | PDF/CSV Export | Generate PDF of Executive Summary with all 3 chart types. Open PDF and verify all charts render with data. |
| Permission N+1 queries | Admin/Permissions (or immediate hot-fix) | Database query log shows exactly 1 permission query per request, not 1 per route. Executive Summary loads <2s. |
| Admin settings type safety | Admin Settings | Zod schema validates all settings on read and write. Invalid JSON in settings table throws a clear error, not a silent type mismatch. |
| Xero account mapping brittleness | Xero API Integration | Configurable mapping table exists. Admin can remap Xero accounts without code changes. |
| PDF Puppeteer on Windows | PDF/CSV Export | Puppeteer launches and generates a PDF on the production Windows 11 server. Document the Chromium install path in deployment instructions. |
| Rollback data bloat | Data Management (housekeeping) | Cron job purges rollback data older than 90 days. Verified by checking `csv_uploads` table size over time. |

## Sources

- Codebase analysis: `server/src/middleware/permissions.ts` (N+1 permission query pattern observed)
- Codebase analysis: `server/src/services/ImportService.ts` (rollback data as JSON blob, dynamic Prisma model access)
- Codebase analysis: `server/src/services/CsvParserService.ts` (assumes row-per-record CSV format, not transposed Excel)
- Codebase analysis: `server/prisma/schema.prisma` (Setting model with generic JSON value, no type validation)
- Project spec: `Buildable_Dashboard_Phase1_Task_Sequence.md` Task 13 (Excel migration details, known #REF! errors, Week 27 sparse data)
- Project spec: `CLAUDE.md` (Xero rate limits 60/min 5000/day, refresh token 60 days, Week ending = Saturday, Decimal not Float)
- Training knowledge: SheetJS merged cell handling, Xero OAuth2 token lifecycle, Puppeteer SVG rendering (MEDIUM confidence -- not verified against current documentation due to tool unavailability)
- Training knowledge: html2canvas SVG limitations (MEDIUM confidence -- well-documented historical issue, may have improved in recent versions)

---
*Pitfalls research for: Buildable Dashboard -- remaining features milestone*
*Researched: 2026-02-06*
