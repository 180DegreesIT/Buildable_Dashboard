# Buildable Dashboard - Phase 1 Build Sequence for Claude Code

## How to Use This Document

This is a sequential task list for Claude Code to build Phase 1 of the Buildable Business Dashboard. Work through tasks in order. Each task includes what to build, where to find the spec detail, and how to know it's done. The full specification lives in `Buildable_Dashboard_Project_Prompt.md` in this project. Refer to it for all business logic, schema details, and design decisions.

**Important context:** This is a real business dashboard for a Queensland building certification company (Buildable Approvals Pty Ltd). The primary user for data entry (April) is non-technical. The directors (Rod, Matt, Grant, Di) need reliable weekly reporting. The system replaces a broken Excel workbook that takes hours to update manually. If the CSV upload system doesn't work well, the project fails regardless of how good the dashboards look.

**Tech stack:** React + TypeScript frontend, Node.js (Express or Fastify) backend, PostgreSQL with Prisma ORM, Tailwind CSS, Recharts for charts. Design language emulates Asana: clean, generous whitespace, card-based, soft colour palette.

**Hosting:** Windows 11 local server initially. All paths and configs must be platform-agnostic. Include `start-dashboard.bat` and `stop-dashboard.bat` scripts.

---

## Pre-Flight: Project Scaffolding

### Task 0: Initialise the monorepo structure

Create the project skeleton matching the file structure in the spec (see "File Structure (Suggested)" section). Use a monorepo layout with `client/` and `server/` directories.

**Build:**
- Initialise `client/` with Vite + React + TypeScript + Tailwind CSS
- Initialise `server/` with Node.js + TypeScript + Express (or Fastify)
- Initialise Prisma in `prisma/` directory
- Create placeholder directories for all component groups (dashboard, charts, upload, admin, layout, alerts, ui)
- Create `start-dashboard.bat` and `stop-dashboard.bat` (see spec "Hosting > Start/Stop Scripts")
- Create a root `package.json` with workspace scripts (`dev`, `build`, `start`, `migrate`)
- Add `.env.example` with all required environment variables (DB connection, server port, Xero client ID/secret, Azure AD client ID/secret, etc.)

**Acceptance:**
- `npm run dev` starts both client and server in development mode
- Client renders a placeholder "Buildable Dashboard" page at `http://localhost:5173`
- Server responds to `GET /api/health` with `{ status: "ok" }`
- Prisma is configured and can connect to a local PostgreSQL instance
- Both `.bat` scripts exist with appropriate commands

---

## Foundation: Database and Core Backend

### Task 1: Database schema and migrations

Implement the full Phase 1 database schema using Prisma. The spec's "Database Schema - Core Tables" section defines 14 table groups. For Phase 1, implement all of them since they're needed for historical data migration and the executive summary view.

**Build all tables from the spec:**
1. `financial_weekly` - P&L summary per week
2. `revenue_weekly` - Revenue breakdown by category
3. `projects_weekly` - Project counts and invoiced amounts by type
4. `sales_weekly` - Quotes issued/won by type
5. `sales_regional_weekly` - Sales by region
6. `team_performance_weekly` - Regional team actuals vs targets
7. `leads_weekly` - Lead source counts and costs
8. `marketing_performance_weekly` - Platform-level marketing metrics
9. `website_analytics_weekly` - GA data
10. `staff_productivity_weekly` - Individual staff performance
11. `phone_weekly` - Call metrics per staff member
12. `cash_position_weekly` - Bank balances and receivables
13. `upcoming_liabilities` - Recurring/one-off liabilities
14. `google_reviews_weekly` - Review count and rating
15. `targets` + `target_history` - Targets with audit trail
16. `csv_uploads` + `csv_column_mappings` - Upload tracking and saved mappings
17. `users` - Dashboard users (populated via M365 SSO)
18. `user_permissions` - Page-level permission matrix

**Key schema decisions:**
- All `week_ending` fields are `Date` type, always a Saturday
- Currency fields use `Decimal` (not Float)
- Enums for all constrained values (project types, regions, roles, etc.)
- Calculated fields (gross_profit, win_rate, percentage_to_target) can be stored or computed at query time. Prefer computed at query time to avoid stale data, but store if performance requires it.
- `targets` table uses `effective_from` / `effective_to` date range pattern (see spec)
- All tables include `created_at` and `updated_at` timestamps
- Add a `data_source` field to tables that receive uploaded data (enum: 'csv_upload', 'xero_api', 'manual_entry', 'backfilled') for audit trail

**Acceptance:**
- `npx prisma migrate dev` runs clean with no errors
- All tables created in PostgreSQL
- Prisma Client generates with full TypeScript types
- Seed script creates at least one record in each table for testing

---

### Task 2: Core API routes and service layer

Build the backend API structure. Every dashboard view needs data endpoints. For Phase 1, focus on the routes that serve the Executive Summary, Financial view, and Data Management pages.

**Build:**

API route groups (all prefixed `/api/v1/`):

1. **Financial routes** (`/api/v1/financial/`)
   - `GET /weekly?weekEnding=YYYY-MM-DD` - Single week P&L summary
   - `GET /weekly/range?from=YYYY-MM-DD&to=YYYY-MM-DD` - Range of weeks (for charts)
   - `GET /revenue/breakdown?weekEnding=YYYY-MM-DD` - Revenue by category
   - `GET /cash-position?weekEnding=YYYY-MM-DD` - Cash position snapshot

2. **Projects routes** (`/api/v1/projects/`)
   - `GET /weekly?weekEnding=YYYY-MM-DD` - Project summary (resi/commercial/retro)
   - `GET /weekly/range?from=YYYY-MM-DD&to=YYYY-MM-DD` - Trend data

3. **Sales routes** (`/api/v1/sales/`)
   - `GET /weekly?weekEnding=YYYY-MM-DD` - Sales pipeline summary
   - `GET /regional?weekEnding=YYYY-MM-DD` - Regional sales breakdown

4. **Team performance routes** (`/api/v1/teams/`)
   - `GET /performance?weekEnding=YYYY-MM-DD` - All 9 teams vs targets
   - `GET /performance/:team?from=YYYY-MM-DD&to=YYYY-MM-DD` - Single team trend

5. **Leads/marketing routes** (`/api/v1/marketing/`)
   - `GET /leads?weekEnding=YYYY-MM-DD` - Lead source breakdown
   - `GET /reviews?weekEnding=YYYY-MM-DD` - Google Reviews

6. **Targets routes** (`/api/v1/targets/`)
   - `GET /current?weekEnding=YYYY-MM-DD` - Active targets for a given week
   - `POST /` - Create new target (with effective_from date)
   - `PUT /:id` - Update target (supersedes old, creates history)
   - `GET /history?targetType=X` - Full change history

7. **Upload routes** (`/api/v1/uploads/`)
   - `POST /parse` - Parse CSV and return headers + preview rows
   - `POST /import` - Commit mapped data to database
   - `GET /history` - Upload audit trail
   - `POST /:id/rollback` - Rollback an upload
   - `GET /mappings` - List saved column mappings
   - `POST /mappings` - Save a new column mapping
   - `PUT /mappings/:id` - Update a mapping
   - `DELETE /mappings/:id` - Delete a mapping

8. **Week utility routes** (`/api/v1/weeks/`)
   - `GET /current` - Returns the current week ending date (Saturday)
   - `GET /list?from=YYYY-MM-DD&to=YYYY-MM-DD` - List of available weeks with data

**Service layer:**
- Create a `WeekService` that handles week ending date logic (find nearest Saturday, validate, list available weeks)
- Create a `TargetService` that resolves which target applies for a given week (using effective_from/effective_to)
- Create a `FinancialService` that computes derived metrics (gross profit, profit %, revenue to staff ratio)
- Implement proper error handling middleware (consistent error response format)
- Add request validation middleware (validate date formats, required params)

**Acceptance:**
- All routes return appropriate responses (200 with data, 404 when no data, 400 for bad params)
- Service layer correctly computes: gross_profit = total_trading_income - total_cost_of_sales, profit_percentage = (net_profit / total_trading_income) * 100, revenue_to_staff_ratio = (wages_and_salaries / total_trading_income) * 100
- Target resolution returns the correct target for any given week (most recent effective_from that's <= the requested week)
- Week utility correctly identifies Saturdays and handles Australian date formats

---

### Task 3: Authentication stub (dev bypass with production-ready structure)

M365 SSO requires Azure AD app registration which isn't done yet (action item for 180D). Build the auth middleware with a dev bypass so development can proceed, but with the production M365 flow fully structured.

**Build:**
- Auth middleware that checks for a valid session/JWT
- In development mode (`NODE_ENV=development`), auto-authenticate as a configurable test user with Super Admin permissions
- Production-ready M365 SSO flow using `@azure/msal-node`:
  - Authorization code flow
  - Token caching and refresh
  - User profile extraction (display name, email, M365 user ID)
  - Auto-provisioning on first login (creates user record with "No Access" default)
- Permission checking middleware: `requirePermission(page, level)` that checks the user's permission matrix
- Four roles: Super Admin, Executive, Manager, Staff (see spec "Role-Based Access" section)
- Page-level permission matrix: Read / Write / No Access per page per user

**Acceptance:**
- In dev mode, all API routes are accessible without authentication
- Auth middleware structure is in place for M365 SSO (ready to enable when Azure AD credentials are provided)
- Permission middleware correctly blocks/allows based on user role and page permissions
- User model includes: m365_id, email, display_name, role, is_active, team, region

---

## Critical Path: CSV Upload System

This is the most important feature. See spec section "CSV Upload System Design (Universal Mapper)" for full detail. Build this thoroughly.

### Task 4: CSV parsing engine (backend)

Build the server-side CSV processing pipeline using PapaParse (or csv-parse).

**Build:**
- CSV file upload endpoint (multipart form data, max 10MB)
- Header detection: read first row(s), handle BOM, detect delimiter (comma, tab, semicolon)
- Data type inference: for each column, sample values to suggest type (date, currency, integer, decimal, percentage, text)
- Preview generation: return first 10 rows of parsed data with detected headers and inferred types
- Validation engine with these rules (from spec "Validation Rules"):
  - Week ending dates must resolve to a Saturday (auto-correct to nearest Saturday if within 3 days, flag if ambiguous)
  - Support DD/MM/YYYY (Australian) and ISO date formats
  - Strip dollar signs, commas, spaces from currency fields and parse as decimal
  - Handle percentage fields: detect 0.54 vs 54% format, normalise to decimal (0.54)
  - Ignore extra/unexpected columns (don't fail the whole file)
  - Reject non-numeric values in numeric fields with clear per-row error messages
  - Handle blank rows gracefully (skip with warning, don't fail)
- Row-level validation results: each row gets a status (pass, warning, error) with specific messages
- Duplicate detection: identify rows where week_ending matches existing database records, return options (overwrite, skip, merge)

**Acceptance:**
- Upload a messy CSV with mixed date formats, dollar signs in numbers, blank rows, extra columns. The parser handles all of it gracefully.
- Validation returns clear, specific error messages per row (not generic "parse error")
- Auto-correction of dates to Saturday works correctly
- Duplicate detection correctly identifies existing weeks in the database

---

### Task 5: Column mapping system (backend + storage)

Build the saved column mapping feature. This is what turns April's weekly process from 10 minutes to 30 seconds.

**Build:**
- Data type registry: define all importable data types with their required and optional fields
  - "Financial - P&L" → maps to `financial_weekly` table fields
  - "Projects - Residential" → maps to `projects_weekly` where project_type = 'residential'
  - "Projects - Commercial" → maps to `projects_weekly` where project_type = 'commercial'
  - "Projects - Retrospective" → maps to `projects_weekly` where project_type = 'retrospective'
  - "Sales - Residential" → maps to `sales_weekly` where sales_type = 'residential'
  - "Sales - Commercial" → maps to `sales_weekly` where sales_type = 'commercial'
  - "Sales - Retrospective" → maps to `sales_weekly` where sales_type = 'retrospective'
  - "Team Performance" → maps to `team_performance_weekly`
  - "Lead Sources" → maps to `leads_weekly`
  - "Marketing Platform Performance" → maps to `marketing_performance_weekly`
  - "Website Analytics" → maps to `website_analytics_weekly`
  - "Staff Productivity" → maps to `staff_productivity_weekly`
  - "Phone Metrics" → maps to `phone_weekly`
  - "Cash Position" → maps to `cash_position_weekly`
  - "Google Reviews" → maps to `google_reviews_weekly`
- Auto-mapping: when a CSV is uploaded and a data type selected, check saved mappings. If a saved mapping has headers that match >= 80% of the CSV's headers, auto-apply it.
- Mapping CRUD: create, read, update, delete saved mappings (stored in `csv_column_mappings` table)
- Mapping application: take a mapping + parsed CSV data → produce database-ready records with validation

**Acceptance:**
- First upload of a new CSV format: user must manually map columns
- Second upload of same format: mapping auto-applies and user just confirms
- If source format changes (new column added), auto-mapping still works for unchanged columns, flags new columns for manual mapping
- All 15+ data types are registered with correct required/optional fields

---

### Task 6: Data import and rollback engine (backend)

Build the commit and rollback system. April needs confidence that mistakes are reversible.

**Build:**
- Import transaction: wrap the entire import in a database transaction
- For each row: validate, transform (apply type conversions, date corrections), insert or update
- Handle duplicate week_ending records based on user's choice (overwrite replaces existing, skip leaves existing, merge updates only non-null fields)
- Record the upload in `csv_uploads` table with: file name, data type, mapping used, row counts (processed, failed, skipped), status, error log (JSONB with per-row details)
- Rollback capability: store enough information to reverse the import. Options:
  - Soft approach: tag all inserted/updated rows with the upload_id, rollback deletes/reverts those rows
  - Recommended: store pre-import state of any overwritten rows in the upload's error_log/rollback_data field
- Rollback endpoint: `POST /api/v1/uploads/:id/rollback` reverses the import atomically

**Acceptance:**
- Upload 30 rows → all 30 appear in the correct table → rollback → all 30 are removed and any overwritten data is restored
- Partial failure: if row 15 of 30 fails validation, rows 1-14 and 16-30 are still imported, row 15 is logged as failed
- Upload history shows accurate counts and status
- Rollback is available for all completed uploads (within a configurable retention period)

---

### Task 7: CSV upload UI (frontend)

Build the upload interface. This is April's primary interaction with the system. It must be intuitive, clear, and confidence-inspiring. See spec "CSV Upload System Design" section and "Design Language" (Asana-style).

**Build a multi-step upload wizard:**

**Step 1 - Select data type:**
- Card-based grid showing all importable data types with icons and descriptions
- Group cards by category (Financial, Projects, Sales, Marketing, Operations)
- Each card shows: name, description, last upload date, record count

**Step 2 - Upload file:**
- Large drag-and-drop zone with file picker fallback
- Accepts .csv and .tsv files
- Show file name and size after selection
- "Upload" button to send to server

**Step 3 - Map columns:**
- Left column: CSV headers (detected from file)
- Right column: dropdown for each, showing target database fields
- If a saved mapping auto-applied, show a banner: "Auto-mapped using [mapping name]. Review and confirm."
- Unmapped columns shown in grey (will be ignored)
- Required fields highlighted if not yet mapped
- "Save mapping as..." button to save/update the mapping for next time

**Step 4 - Preview and validate:**
- Data table showing first 20 rows of mapped data
- Row-level status indicators: green tick (pass), amber warning, red error
- Error/warning details expandable per row
- Summary bar: "28 rows ready, 1 warning, 1 error"
- For duplicate weeks: show modal with options (overwrite all, skip all, choose per row)

**Step 5 - Confirm and import:**
- Final summary: data type, row count, week range, mapping used
- "Import Data" button (primary, prominent)
- Progress indicator during import
- Success screen with: rows imported, any failures, link to view data, link to upload history

**Also build the upload history page:**
- Table of all past uploads: date, user, file name, data type, rows processed/failed/skipped, status
- Rollback button per upload (with confirmation modal)
- Filter by data type, date range, status

**Acceptance:**
- Complete end-to-end flow: select type → upload CSV → map columns → preview → confirm → data appears in database
- A non-technical user (think April) could complete the flow without instructions
- Saved mappings work: first upload requires manual mapping, subsequent uploads auto-map
- Rollback works from the upload history page
- UI is clean, Asana-inspired: generous whitespace, card-based, soft colours, clear typography

---

## Dashboard Views

### Task 8: App shell and navigation

Build the application layout, navigation sidebar, and shared UI components.

**Build:**
- Sidebar navigation (Asana-style: clean, icon + label, collapsible)
  - Executive Summary (default/home)
  - Financial
  - Sales & Pipeline (Phase 2, show as disabled/coming soon)
  - Marketing & Leads (Phase 2, show as disabled/coming soon)
  - Operations (Phase 2, show as disabled/coming soon)
  - Regional Performance
  - Data Management (CSV uploads)
  - Target Management
  - Admin Settings
  - User Management
- Top bar: Buildable logo (placeholder), week selector (date picker defaulting to current week), user avatar/name, logout
- Week selector component: dropdown or date picker that snaps to Saturdays, shows "Week X" label alongside the date
- Alert badge system: navigation items show a red badge when thresholds are breached (wire up the badge, actual alert logic comes later)
- Shared UI components:
  - KPI Card (value, label, comparison value, variance, colour coding)
  - Data Table (sortable, with optional row expansion)
  - Loading skeleton (for async data)
  - Empty state (friendly message when no data for selected week)
  - Export buttons (CSV + PDF, placeholder functionality for now)
  - Net Revenue toggle (checkbox/switch that triggers recalculation, available on financial views)

**Design system:**
- Colour palette: soft, muted tones (not harsh primary colours). Suggest: primary blue (#4573D2), success green (#6AAF50), warning amber (#E8A442), error red (#D94F4F), background (#F9FAFB), card white (#FFFFFF), text dark (#1A1A2E), text secondary (#6B7280)
- Typography: Inter or system sans-serif, generous line height
- Cards: white background, subtle shadow, rounded corners (8px), 24px padding
- Spacing: 16px grid, 24px between cards, 32px section gaps

**Acceptance:**
- Navigation renders all Phase 1 pages, disabled items clearly marked as "Coming Soon"
- Week selector defaults to most recent Saturday with data, clicking navigates all views to that week
- KPI cards render with proper colour coding (green for positive variance, red for negative)
- Layout is responsive enough for desktop and iPad Safari (Rod's device)
- Looks and feels like Asana: clean, modern, not cluttered

---

### Task 9: Executive Summary dashboard

This is the most important view. It's what the directors see first. Build it to match the spec's "Executive Summary (Default View)" section exactly.

**Build:**

**KPI Cards row (7 cards):**
1. Net Profit: actual value, budget value, $ variance, % variance. Green if actual >= budget, red if below.
2. Revenue (Invoiced): Buildable Invoice Total (= Resi + Commercial + Retro Xero Invoiced)
3. Revenue (P&L): Total Trading Income from `financial_weekly`. Show variance to Revenue (Invoiced) with tooltip explaining the difference (see spec "Revenue metrics clarification").
4. Gross Profit Margin: (gross_profit / total_trading_income) * 100, shown as percentage
5. Revenue to Staff Ratio: (wages_and_salaries / total_trading_income) * 100. Show benchmark band indicator (55-65% is healthy, below 55% is great, above 65% is concerning). Note: lower is better.
6. Total Leads: sum from `leads_weekly` for the week. Show average cost per lead.
7. Total Cash Available: from `cash_position_weekly.total_cash_available`

**Charts:**
1. Net Profit trend: line chart, 13-week rolling window ending at selected week. Include budget line as dashed overlay. Use Recharts `LineChart` with `ResponsiveContainer`.
2. Revenue by category: stacked bar chart showing Residential, Commercial, Retrospective per week (13-week window). Data from `projects_weekly.xero_invoiced_amount`.
3. Regional team performance vs target: horizontal bar chart. All 9 teams. Each bar shows actual invoiced, with a vertical line or marker at the target. Colour code: green if >= 80% of target, amber if 50-79%, red if < 50%.

**Tables:**
1. Project summary: 3 rows (Residential, Commercial, Retrospective). Columns: HyperFlo project count, Xero invoiced $, target $, % to target, new business % (resi only).
2. Sales pipeline summary: 3 rows (Residential, Commercial, Retrospective). Columns: quotes issued #, quotes issued $, quotes won #, quotes won $, win rate %.
3. Lead source breakdown: rows for Google, SEO, Meta, Bing, TikTok, Other. Columns: lead count, cost per lead, total cost.
4. Google Reviews: single line showing count this week + cumulative average star rating.

**Active alerts panel:**
- Placeholder panel at the bottom. For now, show a styled empty state: "No active alerts." Actual alert logic is Phase 2, but the UI container should be ready.

**Acceptance:**
- Dashboard loads in under 2 seconds with current week data
- All 7 KPI cards populate correctly from database
- Revenue (Invoiced) correctly sums Resi + Commercial + Retro from `projects_weekly`
- Revenue (P&L) correctly pulls from `financial_weekly.total_trading_income`
- Charts render with 13-week rolling data
- Regional bar chart shows all 9 teams with correct colour coding against targets
- Week selector changes all data on the page
- Looks polished and professional. No dense, cramped layouts.

---

### Task 10: Financial deep dive view

Build the financial detail page. See spec "Financial Deep Dive" section.

**Build:**
- P&L summary view with weekly/monthly toggle
  - Weekly: show the same P&L metrics as the Excel "Weekly Report" sheet (Total Trading Income, Cost of Sales, Gross Profit, Other Income, Operating Expenses, Wages, Net Profit, Budget, % Profit, Revenue to Staff Ratio)
  - Monthly: aggregate weekly data by calendar month
- Revenue breakdown by income category (from `revenue_weekly` table). Display as a treemap or stacked area chart. Categories from the spec enum: Class 1A, Class 10a Sheds, Class 10b Pools, Class 2-9 Commercial, Inspections, Retrospective, Council Fees, Planning 1&10, Planning 2-9, Property Searches, Qleave, Sundry, Access Labour Hire, Insurance Levy.
- Both revenue metrics side by side: Revenue (Invoiced) vs Revenue (P&L) with variance shown and tooltip explaining the difference
- Net Revenue toggle: when enabled, strips council fees and any other items configured as "pass-through" in admin settings. Default is gross (off).
- Cost analysis: wages as % of revenue, trending over time. Show 55-65% benchmark band as a shaded region on the chart.
- Cash position card: show all fields from `cash_position_weekly` in a clean card layout (everyday account, overdraft limit, tax savings, capital account, credit cards, total cash available)
- Aged receivables: total owing broken down by current, 30+, 60+, 90+ days
- Upcoming liabilities: table from `upcoming_liabilities` showing active items sorted by due date

**Acceptance:**
- P&L data matches the values from the Excel "Weekly Report" sheet for the same week
- Monthly toggle correctly aggregates weekly figures
- Net Revenue toggle correctly strips pass-through items (test with council fees)
- Cash position and aged receivables display correctly
- Revenue to Staff Ratio chart shows the 55-65% benchmark band

---

### Task 11: Regional performance view

Build the regional team performance page. See spec "Regional Performance" section.

**Build:**
- Regional comparison table: all 9 teams side by side. Columns: team name, target $, actual invoiced $, % to target, variance $. Colour coded rows.
- Regional trend chart: multi-line chart showing each team's actual invoiced over time (13-week window) with their target as a dashed line
- Drill-down per region: click a team to see their weekly detail (table of weeks with target, actual, %)
- Queensland map view (nice-to-have, can be a simplified SVG with regional pins): show each team's location with a colour-coded indicator of their % to target. If too complex, substitute with a clean card grid showing each region as a card with key metrics.

**The 9 teams (from spec):** Cairns, Mackay, NQ Commercial, SEQ Residential, SEQ Commercial, Town Planning, Townsville, Wide Bay, All In Access

**Acceptance:**
- All 9 teams display with correct targets (resolved from the `targets` table using effective dates)
- Percentage to target is calculated correctly: (actual_invoiced / target_amount) * 100
- Colour coding matches: green >= 80%, amber 50-79%, red < 50%
- Drill-down shows weekly detail for the selected team
- Data matches the Excel "Weekly Report" sheet for the same weeks (verify against the team sections in the PDF sample)

---

### Task 12: Target management interface

Build the target management page. Targets change frequently (every few weeks) and need an audit trail. See spec "Target Management" section and the `targets` / `target_history` tables.

**Build:**
- Target list view: grouped by target type (Net Profit, Residential Revenue, Commercial Revenue, Retrospective Revenue, Team Revenue by region, Breakeven)
- For each target: show current amount, effective from date, who set it, last changed date
- Edit target: modal or inline edit. When changing an amount, must set a new `effective_from` date. The old target gets an `effective_to` date (day before the new effective_from). Creates a `target_history` record automatically.
- Create new target: form with target type, entity (e.g. which team for team targets), amount, effective from date, optional notes
- Bulk update for regional teams: ability to update all 9 team targets at once (table with editable amount fields)
- History view: expandable per target or as a separate tab. Shows all changes: date, previous amount, new amount, changed by, notes.
- Visual preview: when editing a target, show a small preview of how the % to target changes for recent weeks (helpful for directors to understand impact)

**Current targets from the data (as at Week 30, w/e 25 Jan 2025):**
- Net profit budget: $40,203/week
- Residential project revenue: $182,348/week
- Commercial project revenue: $57,003/week (increases slightly week over week, likely rounding)
- Retrospective revenue: $3,490/week
- Cairns: $38,580/wk, Mackay: $12,620/wk, NQ Commercial: $16,248/wk, SEQ Residential: $51,888/wk, SEQ Commercial: $19,669/wk, Town Planning: $12,199/wk, Townsville: $30,572/wk, Wide Bay: $47,352/wk, All In Access: $13,711/wk

**Acceptance:**
- All current targets can be viewed, edited, and created
- Changing a target creates a history record with who/when/what
- Effective date logic works: querying week 25 returns the target that was active for that week, not the latest target
- Bulk update for regional teams works in a single form submission
- History log is complete and accurate

---

## Data Migration

### Task 13: Historical data migration from Excel

The existing Excel workbook (`Weekly_Report__30.xlsx`) contains 30 weeks of data (Week 1 w/e 7 Jul 2024 through Week 30 w/e 25 Jan 2025). Write migration scripts to extract this data and import it via the CSV mapper (or directly into the database with `source: 'backfilled'`).

**The Excel has 12 sheets. Map them to database tables:**

1. **"Weekly Report" sheet** → `financial_weekly`, `projects_weekly`, `team_performance_weekly`, `leads_weekly`, `google_reviews_weekly`
   - This is the main summary sheet. Rows are metrics, columns are weeks (week 1-30).
   - Row structure visible in the PDF sample: Trading Income, Cost of Sales, Gross Profit, Other Income, Operating Expenses, Wages, Net Profit, Budget, % Profit, Revenue to Staff Ratio, then Projects (Resi/Commercial/Retro with targets), then Sales, then Lead Sources, then Google Reviews, then Regional Teams.

2. **"Monthly" sheet** → Monthly aggregates (can be derived from weekly data, but import for validation)

3. **"P&L" sheet** → Single week P&L detail (reference only, Xero API will replace this)

4. **"P&L Monthly" sheet** → `revenue_weekly` (detailed category breakdown by month: Access Labour Hire, Class 10a, etc.)

5. **"Finance This Week" sheet** → `cash_position_weekly` (bank balances, receivables, payables)

6. **"Weekly Revenue Report" sheet** → `revenue_weekly` (weekly revenue by category: Resi Class 1A, Resi Class 10a, Resi Class 10b, Inspections, etc.)

7. **"Sales Weekly" sheet** → `sales_weekly`, `sales_regional_weekly` (quotes issued/won by type and region)

8. **"Marketing Weekly" sheet** → `leads_weekly`, `marketing_performance_weekly`, `website_analytics_weekly`

9. **"Operations Weekly" sheet** → `staff_productivity_weekly` (certifier/cadet metrics)

10. **"Productivity" sheet** → `staff_productivity_weekly` (different cut of same data, may overlap with Operations)

11. **"Phone" sheet** → `phone_weekly` (call counts per staff member)

12. **"Graphs" sheet** → Skip (chart references only, no raw data)

**Build:**
- Python or TypeScript scripts that read each sheet using openpyxl (Python) or xlsx (Node)
- Handle the transposed layout: weeks are columns, metrics are rows. Most sheets use this layout.
- Extract week ending dates from the header row (row 5 in "Weekly Report" sheet contains dates)
- Transform data into the dashboard's schema format
- Import via direct database insert with `data_source: 'backfilled'`
- Log all imports with row counts and any data quality issues
- Handle known data issues: #REF! errors (skip those cells), #DIV/0! errors (set to null), missing weeks (Week 27 appears to have sparse data)

**Acceptance:**
- All 30 weeks of financial data imported and matches the Excel values
- Regional team performance data matches (verify Cairns, SEQ Residential against PDF sample for weeks 27-31)
- Lead source data imported for all weeks
- Staff productivity and phone data imported
- All imported records have `data_source: 'backfilled'`
- No #REF! or #DIV/0! values in the database (replaced with null)
- Migration script is idempotent (can be run multiple times without duplicating data)

---

## Admin and Settings

### Task 14: Admin settings page

Build the admin settings interface. See spec "Admin Settings" section.

**Build:**
- Branding section: upload company logo, set company name, primary colour, accent colour. These values are used in the app header and PDF exports.
- Pass-through items configuration: list of income/expense categories that are considered pass-through (for Net Revenue toggle). Default: Council Fees, Insurance Levy. Admin can add/remove items. Stored as a JSON config in a `settings` table.
- Alert thresholds (Phase 2 functionality, but build the config UI now):
  - Net profit below budget for X consecutive weeks (default: 2)
  - Team below X% of target (default: 50%)
  - Conversion rate below X% (default: historical average)
  - Cash position approaching overdraft limit within $X (default: $50,000)
  - Each threshold: enabled/disabled toggle, threshold value, notification method (in-dashboard only for now)
- System status cards: Xero connection status (connected/disconnected/token expiring), 3CX status (Phase 3 placeholder), Reportei status (Phase 3 placeholder)
- Backup status: last backup timestamp, backup location (informational, actual backup is a scheduled PostgreSQL job)

**Acceptance:**
- Branding changes reflect immediately in the app header
- Pass-through items list is editable and the Net Revenue toggle on financial views uses this list
- Alert threshold config saves and persists
- System status cards show appropriate states

---

### Task 15: User management page (stub)

Build the user management interface. Full M365 integration isn't available yet, but the UI and data model should be ready.

**Build:**
- User list table: display name, email, role, status (active/inactive), last login
- Role assignment: dropdown to change role (Super Admin, Executive, Manager, Staff)
- Permission matrix: grid view with users as rows, pages as columns, toggle between Read/Write/No Access per cell
- In dev mode: manually add test users. In production: users auto-populate on first M365 login.
- Staff-to-system mapping (for future use): fields for team/region assignment, 3CX extension, HyperFlo user (all optional, stored in user record)

**Pages for permission matrix (from spec):**
Executive Summary, Financial Deep Dive, P&L Monthly Detail, Sales & Pipeline, Marketing & Leads, Operations & Productivity, Regional Performance, Cash Position & Liabilities, Data Management, Target Management, Staff Management, Admin Settings, User & Permission Management

**Acceptance:**
- Can create/edit test users in dev mode
- Role assignment works and persists
- Permission matrix grid renders and toggles work
- Changing a user's role updates their default permissions (Super Admin gets full access, Staff gets minimal)

---

## Polish and Integration

### Task 16: PDF and CSV export

Build export functionality for all dashboard views. See spec "Non-Functional Requirements > Export."

**Build:**
- CSV export: on every data table and chart, a "Download CSV" button exports the underlying data as a CSV file with appropriate headers
- PDF export: on every dashboard page, a "Download PDF" button generates a formatted PDF snapshot of the current view
  - Use Puppeteer (headless Chrome) or jsPDF + html2canvas
  - PDF includes: Buildable branding (logo, company name), page title, selected week, generated timestamp, all visible charts and tables
  - Landscape orientation for pages with wide tables
- Export buttons styled consistently with the Asana design language (subtle, not cluttering the interface)

**Acceptance:**
- CSV export downloads a well-formatted CSV with proper headers and AU-formatted dates
- PDF export generates a readable, branded PDF of the Executive Summary view
- PDF export generates a readable PDF of the Financial view
- Export buttons are present on all Phase 1 dashboard pages

---

### Task 17: Xero API integration scaffold

Build the Xero integration structure. The actual connection requires Xero developer app credentials (action item for 180D), but the scaffold should be complete and ready to activate.

**Build:**
- Xero OAuth2 flow using `xero-node` SDK:
  - Authorization endpoint (redirects to Xero for consent)
  - Callback endpoint (receives auth code, exchanges for tokens)
  - Token storage (encrypted in database: access token, refresh token, expiry timestamps)
  - Automatic token refresh (access tokens expire every 30 minutes)
  - Graceful handling of refresh token expiry (60 days of inactivity): show reconnect prompt in dashboard, optionally email admin
- Xero data sync service:
  - `syncProfitAndLoss(fromDate, toDate)` → fetches P&L report, transforms to `financial_weekly` schema
  - `syncInvoices(fromDate, toDate)` → fetches invoices, aggregates by week and category into `revenue_weekly` and `projects_weekly`
  - `syncBankSummary()` → fetches bank balances into `cash_position_weekly`
  - `syncAccounts()` → fetches chart of accounts for category mapping
- Sync scheduling: configurable cron job (default: daily at 6:00 AM AEST) + manual "Sync Now" button in admin
- Rate limiting: respect 60 calls/minute, 5,000/day. Queue requests if needed.
- Sync status tracking: last sync timestamp, success/failure, records synced, displayed in admin settings
- In dev mode: mock Xero responses with sample data matching the Excel workbook's financial figures

**Acceptance:**
- OAuth2 flow is implemented end-to-end (can be tested with Xero demo company when credentials are available)
- Token refresh logic handles edge cases (expired refresh token, network errors)
- Data transformation correctly maps Xero API responses to dashboard schema
- Sync status displays in admin settings
- Mock data mode allows development without live Xero connection
- Rate limiting prevents exceeding Xero's API limits

---

### Task 18: Seed data and end-to-end validation

After all tasks are complete, run a full validation to ensure everything works together.

**Build:**
- Seed script that populates the database with the migrated Excel data (Task 13) plus test targets (Task 12)
- Validation checklist script that verifies:
  - Executive Summary KPI cards match expected values for Week 30 (w/e 25 Jan 2025):
    - Net Profit: $62,210.45 (from PDF)
    - Net Profit Budget: $40,203
    - Revenue to Staff Ratio: ~57% for that week (from PDF)
  - Regional team figures match for Week 30:
    - Cairns: $24,560.60 actual vs $38,580 target (64%)
    - SEQ Residential: $73,838.32 actual vs $51,888 target (142%)
    - NQ Commercial: $35,820.60 actual vs $16,248 target (220%)
  - Lead source data matches for Week 30:
    - Google: 70 leads
    - SEO: 118 leads
    - Total leads: 257.03 (from PDF)
  - CSV upload round-trip: export data as CSV → re-import → data matches
  - Target management: create target → verify it applies to correct weeks → change target → verify history

**Acceptance:**
- All validation checks pass
- Dashboard loads cleanly with 30 weeks of historical data
- No console errors in browser
- No unhandled exceptions in server logs
- Performance: Executive Summary loads in under 2 seconds with 30 weeks of data

---

## Task Dependency Map

```
Task 0 (Scaffold)
  └─→ Task 1 (Database) 
       ├─→ Task 2 (API Routes)
       │    ├─→ Task 9 (Executive Summary)
       │    ├─→ Task 10 (Financial View)
       │    ├─→ Task 11 (Regional View)
       │    └─→ Task 12 (Target Management)
       ├─→ Task 3 (Auth Stub)
       │    └─→ Task 15 (User Management)
       ├─→ Task 4 (CSV Parser) 
       │    └─→ Task 5 (Column Mapping)
       │         └─→ Task 6 (Import/Rollback)
       │              └─→ Task 7 (Upload UI)
       └─→ Task 13 (Data Migration) ←── needs Task 1 schema
            └─→ Task 18 (Validation) ←── needs everything

Task 8 (App Shell) ←── can start after Task 0, parallel to backend work
Task 14 (Admin Settings) ←── after Task 1
Task 16 (Export) ←── after Tasks 9-11 (needs views to export)
Task 17 (Xero Scaffold) ←── after Task 2 (needs API structure)
```

**Suggested build order for maximum parallelism:**
1. Task 0 → Task 1 → Task 2 + Task 3 (backend foundation)
2. Task 8 (app shell, can run parallel to backend)
3. Tasks 4 → 5 → 6 → 7 (CSV pipeline, critical path)
4. Task 13 (migration, needs schema)
5. Tasks 9, 10, 11, 12 (dashboard views, need API routes + data)
6. Tasks 14, 15 (admin, lower priority)
7. Tasks 16, 17 (export and Xero, polish)
8. Task 18 (validation, last)

---

## Notes for Claude Code

- **Australian English throughout:** colour not color, organisation not organization, metre not meter.
- **Date format:** DD/MM/YYYY for display, ISO for storage and API. Week ending dates are always Saturdays.
- **Currency:** AUD, formatted as $X,XXX.XX with negative values shown in red with parentheses or minus sign.
- **Financial year:** July 1 to June 30 (Australian standard).
- **The 9 regions are fixed** (for now): Cairns, Mackay, NQ Commercial, SEQ Residential, SEQ Commercial, Town Planning, Townsville, Wide Bay, All In Access.
- **Buildable Invoice Total** = Residential Invoiced + Commercial Invoiced + Retrospective Invoiced (matches Xero to the cent). Different from Total Trading Income (P&L accrual figure). Dashboard shows both.
- **Revenue to Staff Ratio** = (Wages & Salaries / Total Trading Income) × 100. Lower is better. 55-65% is the benchmark band.
- **Pass-through items** (council fees, insurance levy) inflate revenue. Net Revenue toggle strips these. Gross is default to match Xero.
- **Performance target:** Dashboard loads in under 2 seconds. Don't over-fetch data.
- **Error handling:** Never show raw error messages to users. Log details server-side, show friendly messages client-side.
- **The CSV mapper is the most important feature.** If you're running low on context or need to prioritise, the CSV upload pipeline (Tasks 4-7) is more important than making the charts pretty.
