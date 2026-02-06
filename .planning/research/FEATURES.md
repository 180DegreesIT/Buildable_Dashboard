# Feature Research: Remaining Dashboard Features

**Domain:** Business dashboard -- admin, migration, export, and integration features
**Researched:** 2026-02-06
**Confidence:** MEDIUM (training knowledge only -- WebSearch/WebFetch unavailable for verification)

**Note on sources:** Web tools were unavailable during this research session. All findings are based on training knowledge (cutoff May 2025) combined with direct analysis of the existing codebase. Confidence levels are capped at MEDIUM for claims that would normally be verified against official documentation.

---

## Feature Landscape

### 1. Excel Data Migration (Task 13)

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Read all 12 Excel sheets programmatically | Data lives in `Weekly_Report__30.xlsx`; manual re-entry of 30 weeks is unacceptable | HIGH | Transposed layout (weeks as columns, metrics as rows) requires custom parsing logic per sheet |
| Handle transposed data layout | Excel uses weeks-as-columns format; database expects rows-per-week | HIGH | Must detect header row with dates (row 5 in "Weekly Report" sheet), then pivot each metric row into per-week records |
| Map each sheet to correct database table(s) | "Weekly Report" sheet maps to 5+ tables; "Sales Weekly" maps to `sales_weekly` + `sales_regional_weekly` | MEDIUM | See Task 13 sheet-to-table mapping in task sequence |
| Handle Excel data errors (#REF!, #DIV/0!, empty cells) | Source workbook has known formula errors; migration must not crash on them | MEDIUM | Replace with null, log which cells were skipped |
| Mark all imported records as `data_source: 'backfilled'` | Audit trail distinguishes historical data from live uploads | LOW | Single enum value applied to all migration inserts |
| Idempotent migration script | Must be re-runnable without duplicating data | MEDIUM | Use upsert on `weekEnding` + entity unique constraints already in schema |
| Validation report showing imported vs expected values | Directors need confidence the migration is accurate | MEDIUM | Compare Week 30 values against known reference figures from PDF sample |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cell-level error log with sheet/row/column references | If a value does not migrate, April or developer can trace exactly where in the Excel it came from | MEDIUM | Extremely valuable for debugging; store as structured JSON |
| Dry-run mode that reports what would be imported without writing | Safe preview before committing 30 weeks of data | LOW | Run full pipeline, skip final database writes, return summary |
| Progress logging per sheet | 12 sheets with varying complexity; long-running script needs visibility | LOW | Console output or log file showing "Sheet 3/12: Sales Weekly -- 30 weeks, 270 records" |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Generic Excel-to-database importer | "Reusable for future workbooks" | This workbook has a unique transposed layout; a generic tool would be over-engineered and still need per-sheet config | Purpose-built migration script per sheet; it runs once and is done |
| Real-time Excel file watching | "Auto-import when Excel changes" | This is a one-time historical migration, not ongoing; CSV upload handles ongoing data | Run migration script manually; CSV upload wizard handles future data |
| Importing the "Graphs" sheet | "It has chart data" | Contains only Excel chart objects, no raw data; parsing chart XML is wasteful | Skip entirely; dashboard builds its own charts from the imported raw data |

---

### 2. Admin Settings Page (Task 14)

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Branding configuration (logo upload, company name, colours) | PDF exports and header need company identity; directors expect "their" dashboard | MEDIUM | Store logo as base64 or file path in `settings` table (key-value JSON pattern already exists in schema) |
| Pass-through items configuration | Net Revenue toggle on Financial views depends on knowing which income categories are pass-through | LOW | Already referenced in business rules; defaults: Council Fees, Insurance Levy. Admin adds/removes from a list stored in `settings` table |
| Alert threshold configuration UI | Spec explicitly calls for this; even though alert engine is Phase 2, config UI is Phase 1 | MEDIUM | Thresholds: net profit below budget for N weeks, team below X% of target, cash position near overdraft. Store as JSON in `settings` |
| System status cards (Xero connection, 3CX placeholder, Reportei placeholder) | Directors need to see at a glance if integrations are working | LOW | Xero: check token expiry from database; 3CX/Reportei: static "Coming in Phase 3" cards |
| Settings persistence across server restarts | Settings stored in database, not in-memory | LOW | `Setting` model already exists in Prisma schema with `key: String @unique` and `value: Json` |
| Immediate effect -- branding changes reflect without page reload | Users expect settings to "just work" after saving | LOW | Invalidate any cached settings; frontend re-fetches on next render or uses React context |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Settings change audit log | Track who changed what setting and when; useful if a pass-through item is accidentally removed | LOW | Add `updatedBy` field to settings writes; store previous value in a `settings_history` array |
| Financial year configuration | Currently hardcoded as 1 Jul -- 30 Jun; making it configurable future-proofs for different reporting periods | LOW | Store as setting; low effort but rarely needed |
| Data retention / cleanup configuration | Configure auto-cleanup of old failed uploads, set retention period for rollback data | MEDIUM | Addresses the concern about orphaned failed imports noted in CONCERNS.md |
| Backup status display | Show last PostgreSQL backup timestamp and location | LOW | Informational only; reads from a settings key that a backup script updates |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full theme builder (custom CSS, fonts, layout) | "Make it fully customisable" | Only one customer (Buildable); a theme builder adds complexity with zero users who need it | Hardcode Asana-inspired design; only expose logo, company name, primary/accent colour |
| Database administration panel | "Manage tables, run queries" | Security nightmare; non-technical users should never touch raw SQL; Prisma Studio or pgAdmin covers this for developers | Keep admin settings focused on business configuration, not infrastructure |
| Email/SMS notification configuration | "Alert me via email when thresholds breach" | Alert engine is Phase 2; building email/SMS infrastructure now is premature | Build the threshold config UI but show "Notifications coming in Phase 2" for delivery method |

---

### 3. User Management Page (Task 15)

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| User list table (name, email, role, status, last login) | Admin needs to see who has access | LOW | Query `users` table; schema already has all fields |
| Role assignment dropdown (Super Admin, Executive, Manager, Staff) | Roles determine default permissions; admin must be able to promote/demote | LOW | Update `user.role`; trigger permission recalculation |
| Page-level permission matrix grid | Users as rows, dashboard pages as columns, toggle Read/Write/No Access per cell | MEDIUM | 13 pages x N users grid; `user_permissions` table and `requirePermission()` middleware already exist |
| Active/inactive toggle | Disable access without deleting user record | LOW | `user.isActive` field already exists in schema |
| Default permissions by role | When role changes, auto-apply sensible defaults; admin can then customise | LOW | Role defaults already coded in `permissions.ts` (ROLE_DEFAULTS, STAFF_READABLE_PAGES, ADMIN_ONLY_PAGES) |
| Manual user creation in dev mode | M365 SSO not available yet; need ability to create test users | LOW | Simple form: name, email, role. In production, users auto-populate on M365 first login |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Bulk role assignment | Select multiple users, assign same role in one action | LOW | Useful once team grows; simple multi-select + batch update |
| Permission template presets | "Manager template" applies standard Manager permissions to all pages at once | LOW | Reduces per-cell clicking in the matrix grid |
| Staff-to-system mapping fields | Team/region assignment, 3CX extension, HyperFlo user ID | LOW | Schema already has `team` and `region` on User model; add optional metadata fields |
| Permission change audit log | Track who changed whose permissions and when | MEDIUM | Important for security compliance; store in target_history-style audit table |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Self-service registration | "Let users sign up themselves" | This is an internal business tool; uncontrolled access is a security risk | M365 SSO handles identity; admin manually sets roles after first login |
| Password management | "Reset password, enforce complexity" | Dashboard uses M365 SSO (password-less from dashboard perspective); adding a separate password system creates confusion | Rely entirely on M365 for authentication; dashboard only manages authorisation (roles/permissions) |
| Fine-grained field-level permissions | "Hide salary data from managers" | Page-level Read/Write/No Access is sufficient for 4 roles and 13 pages; field-level adds enormous complexity | Use page-level permissions; if specific fields need hiding, create separate page views |
| User groups or teams | "Group users by department" | Only ~10-15 users total; groups add unnecessary abstraction | Assign region directly on user record; filter by region if needed |

---

### 4. PDF and CSV Export (Task 16)

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| CSV export button on every data table | Directors need to pull data into their own Excel for ad-hoc analysis | LOW | Existing `ExportButtons` component already has stub; need to wire up actual CSV generation from table data |
| PDF export button on every dashboard page | Directors share weekly reports; PDF is the universal format for emailing board packs | HIGH | Capturing React-rendered charts + tables as a formatted PDF is the hardest part of this task |
| Branded PDF header (logo, company name, report title) | Professional appearance; directors share these externally | MEDIUM | Pull branding from admin settings; render as header on every PDF page |
| Week ending date and generation timestamp on exports | Recipients need to know which week the report covers and when it was generated | LOW | Include in PDF header/footer and CSV filename |
| Australian date format (DD/MM/YYYY) in exports | Consistent with display format; AU business convention | LOW | Format all dates before writing to CSV/PDF |
| Currency formatting ($X,XXX.XX) in CSV exports | Raw CSV should still be readable without reformatting | LOW | Pre-format currency values; or include both raw and formatted columns |
| Landscape orientation for wide tables | Financial and regional tables have many columns; portrait truncates | LOW | Detect table width or use landscape as default for Financial and Regional pages |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Export All Pages" single PDF | One click generates a complete weekly report across all dashboard views | HIGH | Extremely valuable for board pack distribution; navigates through each page view and combines into single PDF |
| Page number and table of contents in multi-page PDF | Professional document feel for board distribution | MEDIUM | Useful if Export All Pages is implemented |
| Date range CSV export (not just current week) | Pull 13-week trend data as a single CSV for historical analysis | LOW | Query with date range; highly useful for directors doing their own Excel analysis |
| Export scheduling (auto-generate weekly PDF) | Every Monday morning, PDF of previous week is generated and saved | HIGH | Eliminates manual export step; could email or save to shared drive |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time collaborative PDF editing | "Edit the PDF before sharing" | PDF is a snapshot format, not a collaboration tool; adding editing turns this into a document editor | Export as-is; directors can annotate in their PDF reader or copy to PowerPoint |
| Excel (.xlsx) export | "I want it in Excel, not CSV" | XLSX generation requires additional library (exceljs/xlsx); CSV opens in Excel just fine | Export CSV; it opens directly in Excel. If demand is strong, add XLSX later as enhancement |
| Custom report builder | "Let me pick which charts to include" | Massive UI complexity for a rarely-used feature; fixed dashboard pages already show the right data | Export what's on screen; directors already see the right layout |
| Pixel-perfect Excel replica | "Make the PDF look exactly like the old Excel report" | Old Excel layout is dense, hard to read, and the reason they're replacing it | Use the new dashboard design language; it's cleaner and more professional |

---

### 5. Xero API Integration (Task 17)

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| OAuth2 authorisation flow (connect to Xero) | Required to access any Xero data; standard OAuth2 authorization code grant | MEDIUM | Redirect to Xero consent page, handle callback, exchange code for tokens. Env vars `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` already scaffolded |
| Token storage with encryption | Access tokens and refresh tokens must be stored securely; tokens grant access to financial data | MEDIUM | Store in database (settings or dedicated table); encrypt at rest; never log tokens |
| Automatic token refresh | Xero access tokens expire every 30 minutes; refresh tokens valid for 60 days of inactivity | MEDIUM | Refresh before expiry; handle refresh token expiry gracefully (prompt reconnection). **Confidence: MEDIUM -- token lifetimes from training data, verify against Xero docs** |
| Sync P&L report data | Primary use case: replace manual P&L CSV export with automated Xero pull | HIGH | Map Xero P&L report response to `financial_weekly` schema; handle Xero's reporting period format |
| Sync invoice data | Secondary use case: automated revenue tracking by category | HIGH | Map Xero invoice line items to `revenue_weekly` and `projects_weekly`; aggregate by week |
| Sync bank balances | Tertiary use case: automated cash position updates | MEDIUM | Map Xero bank account balances to `cash_position_weekly` |
| Rate limit compliance | Xero enforces rate limits (training knowledge: 60 calls/minute, 5000/day) | MEDIUM | Queue requests; back off on 429 responses. **Confidence: LOW -- rate limits may have changed; verify against current Xero docs** |
| Sync status display in admin | Admin needs to see: last sync time, success/failure, records synced | LOW | Store sync metadata in `settings` or dedicated `sync_log` table; display on admin settings page |
| Manual "Sync Now" button | Admin triggers immediate sync without waiting for schedule | LOW | Call sync service endpoint; show progress/result |
| Mock mode for development | Xero credentials not available yet; development must not be blocked | MEDIUM | Return realistic mock data matching Excel workbook figures; toggle via env var |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Configurable sync schedule (cron) | Business may want daily at 6 AM AEST, or twice daily, or weekly | MEDIUM | Use node-cron or similar; store schedule in settings |
| Chart of accounts mapping UI | Let admin map Xero account codes to dashboard revenue categories | HIGH | Xero accounts do not 1:1 map to dashboard categories; needs a mapping interface |
| Sync conflict resolution | When Xero data differs from manually-uploaded CSV data for same week, show the conflict and let admin choose | HIGH | Critical for data integrity; prevents silent overwrites |
| Historical backfill from Xero | Pull 6-12 months of Xero data to validate against Excel migration | HIGH | Valuable for validation but heavy on API calls; needs careful rate limit management |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time Xero sync (webhooks) | "Update dashboard instantly when invoice is created in Xero" | Xero webhooks require public URL endpoint and certificate validation; local Windows server cannot receive webhooks without tunnelling | Scheduled sync (daily or on-demand) is sufficient for weekly reporting cadence |
| Two-way sync (write back to Xero) | "Update Xero from dashboard" | Dashboard is a reporting tool, not an accounting tool; writing to Xero risks data corruption in the source of truth | Read-only integration; all writes happen in Xero directly |
| Multi-organisation Xero support | "Connect multiple Xero orgs" | Buildable has one Xero organisation; multi-org adds token management complexity | Single organisation; add multi-org only if business requires it |
| Full Xero API coverage | "Sync contacts, purchase orders, expenses" | Dashboard only needs P&L, invoices, and bank balances; syncing everything wastes API calls and adds maintenance | Sync only the 3-4 endpoints needed for dashboard data |

---

### 6. End-to-End Validation (Task 18)

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Seed script populating database with migrated Excel data + test targets | All dashboard views need realistic data to validate against | MEDIUM | Combines migration script output (Task 13) with target data (Task 12) |
| Automated validation comparing Week 30 values to known reference | Must verify: Net Profit $62,210.45, Budget $40,203, Cairns $24,560.60, SEQ Resi $73,838.32, 257 total leads | MEDIUM | Script queries database and compares to expected values; reports pass/fail per check |
| CSV round-trip test (export then re-import) | Proves export and import are symmetric; data survives the cycle | MEDIUM | Export a table as CSV, re-import via upload wizard, compare records |
| Performance benchmark (Executive Summary < 2 seconds) | Spec mandates 2-second load time | LOW | Time the API call for executive-summary endpoint with 30 weeks of data; fail if > 2000ms |
| Target management validation (create, apply to week, change, verify history) | Target effective date logic is complex; must prove it works end-to-end | MEDIUM | Create target for Week 25, query Week 25 and Week 30 to verify correct target resolves |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Automated regression test suite | Re-run validation after any code change to catch regressions | HIGH | Valuable long-term but significant investment; framework setup (Jest/Vitest) needed |
| Visual regression testing for PDF exports | Ensure PDF output has not changed unexpectedly | HIGH | Tools like Percy or Playwright screenshot comparison; overkill for initial launch |
| Data integrity dashboard (internal) | A meta-dashboard showing data quality: missing weeks, null fields, source distribution | MEDIUM | Very useful for ongoing operations; helps April spot gaps |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| 100% unit test coverage | "Every function needs a test" | Diminishing returns; testing trivial getters wastes time vs testing critical paths | Focus tests on: CSV parsing, import/rollback, KPI calculations, target resolution |
| Load testing with 10,000 concurrent users | "Ensure it scales" | This is a 5-15 user internal tool on a local server; load testing is irrelevant | Validate single-user performance (< 2s page load) with realistic data volume |
| Browser compatibility testing matrix | "Test on IE11, Safari, Firefox, Chrome" | Users are on managed Windows machines (Chrome) and Rod's iPad (Safari); IE11 is dead | Test Chrome desktop + iPad Safari only |

---

## Feature Dependencies

```
[Excel Data Migration]
    |
    v
[Seed Data + End-to-End Validation] (depends on migration data)
    ^
    |
[All Dashboard Views] (already built, but need data to validate)

[Admin Settings]
    |
    +---> [PDF Export] (PDF needs branding from admin settings)
    |
    +---> [Financial Views] (Net Revenue toggle reads pass-through items from settings)
    |
    +---> [Xero Integration] (connection status displayed on admin page)

[User Management]
    |
    +---> [Auth Middleware] (already built; user management is the UI for it)

[Xero Integration]
    |
    +---> [Admin Settings] (sync status, connection management displayed there)

[PDF/CSV Export]
    |
    +---> [Admin Settings] (branding config for PDF header)
    |
    +---> [Dashboard Views] (already built; export captures their content)
```

### Dependency Notes

- **Excel Migration must precede Validation:** Validation compares database values to known Excel reference values. Without migration, there is nothing to validate.
- **Admin Settings should precede PDF Export:** PDF export needs branding (logo, company name) from admin settings. Could hardcode temporarily, but better to build settings first.
- **Admin Settings should precede Xero Integration:** Xero connection status is displayed on admin settings page. Build the page first, then add the Xero status card.
- **User Management is independent:** Backend permissions already work; this is purely a UI task. Can be built in parallel with anything.
- **CSV Export is independent of PDF Export:** CSV generation is simple string formatting. PDF generation is the complex part. They share the `ExportButtons` component but otherwise are separate.
- **Xero Integration is independent but benefits from Validation:** Mock Xero data should match Excel reference values for consistency checking.

---

## MVP Definition

### Launch With (v1 -- This Milestone)

These are all needed to consider the dashboard "complete enough to use in production":

- [x] Excel Data Migration -- Without 30 weeks of historical data, the dashboard shows empty charts
- [x] Admin Settings -- Pass-through items config is needed for Net Revenue toggle (already used in Financial views); branding needed for PDF exports
- [x] User Management -- Directors need role-based access before going live; cannot have everyone as Super Admin
- [x] CSV Export -- Directors need to pull data into Excel for ad-hoc analysis; low complexity
- [x] PDF Export -- Directors need to share weekly reports; high complexity but essential for board packs
- [x] End-to-End Validation -- Must verify data accuracy before going live; directors will not trust the tool if Week 30 numbers do not match their Excel

### Add After Validation (v1.x)

- [ ] Xero API Integration -- Credentials not available yet (pending from 180D). Scaffold the code but do not block launch on it. Manual CSV upload works fine until Xero is connected.
- [ ] Export scheduling (auto-generate weekly PDF) -- Nice to have but manual export is acceptable initially
- [ ] Chart of accounts mapping UI for Xero -- Only needed after Xero is connected

### Future Consideration (v2+)

- [ ] Sales & Pipeline page -- Currently disabled in sidebar ("Coming Soon")
- [ ] Marketing & Leads page -- Currently disabled
- [ ] Operations page -- Currently disabled
- [ ] Live alert engine -- Config UI built in admin settings, but no active alert firing until Phase 2
- [ ] 3CX phone integration -- Phase 3
- [ ] Reportei integration -- Phase 3

---

## Feature Prioritisation Matrix

| Feature | User Value | Implementation Cost | Priority | Notes |
|---------|------------|---------------------|----------|-------|
| Excel Data Migration | HIGH | HIGH | P1 | Dashboard is empty without it; blocks all validation |
| Admin Settings -- Pass-through items | HIGH | LOW | P1 | Net Revenue toggle depends on it; already referenced in Financial views |
| Admin Settings -- Branding | MEDIUM | MEDIUM | P1 | PDF export needs it; reasonable to build alongside other settings |
| Admin Settings -- Alert thresholds | LOW | MEDIUM | P2 | Config only (Phase 2 engine); can defer if time is tight |
| Admin Settings -- System status cards | LOW | LOW | P2 | Informational; Xero not connected yet anyway |
| User Management -- User list + roles | HIGH | LOW | P1 | Must have before production; backend already built |
| User Management -- Permission matrix grid | HIGH | MEDIUM | P1 | Key security feature; middleware exists, UI does not |
| CSV Export | HIGH | LOW | P1 | Simple implementation; high user value |
| PDF Export -- Single page | HIGH | HIGH | P1 | Core director workflow; technically complex |
| PDF Export -- All pages combined | MEDIUM | HIGH | P2 | Nice to have; significant additional effort |
| Xero Integration -- OAuth flow | MEDIUM | MEDIUM | P2 | Credentials not available; scaffold only |
| Xero Integration -- Data sync | MEDIUM | HIGH | P2 | Depends on OAuth; complex mapping logic |
| Xero Integration -- Mock mode | MEDIUM | MEDIUM | P2 | Enables development without live Xero |
| End-to-End Validation script | HIGH | MEDIUM | P1 | Must verify accuracy before go-live |
| Performance testing | MEDIUM | LOW | P1 | Quick to implement; spec mandates < 2s load |

**Priority key:**
- P1: Must have for this milestone launch
- P2: Should have, add when possible within this milestone
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

This is an internal business tool, not a SaaS product. "Competitors" are the tools directors currently use or could use instead.

| Feature | Current Excel Workbook | Power BI / Tableau | Our Dashboard |
|---------|----------------------|-------------------|---------------|
| Historical data | 30 weeks manual entry | Can connect to Xero directly | 30 weeks migrated + ongoing CSV upload |
| PDF reports | Print to PDF (ugly) | Scheduled PDF export | Branded PDF with company identity |
| User access control | None (shared file) | Per-user licenses ($$$) | Role-based with page-level permissions |
| Data entry | April edits cells directly (error-prone) | Requires developer to set up data pipelines | CSV upload wizard with validation |
| Real-time Xero data | Manual export/copy-paste | Direct connector (paid) | Scheduled sync (when credentials available) |
| Cost | Free (but slow and fragile) | $10-70/user/month | One-time build cost; no recurring license |
| Customisation | Full (anyone can edit formulas) | Medium (developer needed) | Fixed dashboard views + configurable settings |

**Key insight:** The dashboard wins on data integrity (validation, rollback, audit trail) and ease of use (April's CSV workflow). It does not need to compete on visualisation sophistication (Power BI wins there) or flexibility (Excel wins there). Focus on reliability and simplicity.

---

## Implementation Approach Notes

### Excel Data Migration

**Library recommendation:** Use `xlsx` (SheetJS) for Node.js or `exceljs` for streaming large files. Both can read `.xlsx` files. `xlsx` is simpler for read-only use. `exceljs` handles streaming better for memory efficiency.

**Confidence: MEDIUM** -- Library capabilities from training data; verify current API against npm/GitHub.

**Key challenge:** The transposed layout. Each sheet has metrics as rows and weeks as columns. The migration script must:
1. Read the header row to extract week-ending dates
2. For each metric row, create one database record per week column
3. Handle merged cells, empty columns, and formula errors

**Recommendation:** Write one migration function per sheet (not a generic parser). Each sheet has different structure. Total: ~10 migration functions (skip "Graphs" sheet, combine overlapping sheets).

### PDF Export

**Library recommendation:** Use Puppeteer for server-side PDF generation. It renders the actual React pages in headless Chrome, capturing charts and tables exactly as they appear. Alternative: `jsPDF` + `html2canvas` runs client-side but produces lower quality PDFs and struggles with responsive layouts.

**Confidence: MEDIUM** -- Puppeteer PDF generation is well-established but verify Windows compatibility and Chromium binary requirements for the local server deployment.

**Key challenge:** Puppeteer requires Chromium binary (~300MB). On a Windows 11 local server, this needs disk space and the binary must be accessible. Consider using an existing Chrome installation instead of downloading Chromium.

**Recommendation:** Use Puppeteer with a server-side endpoint (`POST /api/v1/export/pdf?page=executive_summary&weekEnding=2025-01-25`). The endpoint navigates headless Chrome to the dashboard page, waits for data to load, then generates the PDF. This keeps chart rendering consistent with what users see on screen.

### CSV Export

**Implementation:** Straightforward. For each data table, collect the underlying data array, format headers and values, generate CSV string, trigger browser download. No library needed -- `Array.map().join(',')` with proper escaping handles it. Or use PapaParse's `unparse()` function (already installed).

**Recommendation:** Use PapaParse `unparse()` since it is already a dependency. Handle currency formatting (include $ prefix) and date formatting (DD/MM/YYYY) in the export transform.

### Xero Integration

**Library recommendation:** Use `xero-node` SDK (official Xero Node.js client). It handles OAuth2 flow, token management, and provides typed API methods.

**Confidence: MEDIUM** -- `xero-node` is the official SDK; verify current version and API coverage against GitHub/npm.

**Key challenge:** Token management. Xero access tokens expire frequently (30 minutes per training data). The integration must handle transparent refresh without disrupting sync operations. Refresh tokens expire after 60 days of inactivity -- if no one uses the dashboard for 2 months over holidays, reconnection is required.

**Recommendation:** Build the OAuth flow and token storage first. Implement sync services second. Use mock mode until real credentials are available. Store tokens encrypted in the `settings` table (key: `xero_tokens`, value: encrypted JSON).

---

## Sources

- Direct codebase analysis of `C:\Projects\buildable_dashboard\` (all files listed in research)
- `Buildable_Dashboard_Phase1_Task_Sequence.md` (Tasks 13-18 specifications)
- `.planning/PROJECT.md` (project context and requirements)
- `.planning/codebase/INTEGRATIONS.md` (existing integration scaffolding)
- `.planning/codebase/CONCERNS.md` (known technical debt and risks)
- `.planning/codebase/STACK.md` (current technology versions)
- Prisma schema (`server/prisma/schema.prisma`) -- database structure
- Training knowledge (May 2025 cutoff) for: Puppeteer PDF generation, xlsx/exceljs library capabilities, Xero API OAuth2 flow, xero-node SDK, PapaParse unparse, admin panel UX patterns. **All marked MEDIUM confidence.**

---
*Feature research for: Buildable Dashboard remaining features (Milestone 2)*
*Researched: 2026-02-06*
