# Roadmap: Buildable Dashboard (Remaining Build)

## Overview

The dashboard's core views, CSV upload system, and database schema are complete (Tasks 0-12). This roadmap covers the remaining work to make the system production-ready: admin configuration, user management, historical data migration from Excel, PDF/CSV export, Xero API scaffolding, and end-to-end validation against known reference values. Four phases deliver 33 requirements, with the first two phases running in parallel.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Admin & User Management** - Configuration foundation and access control UI
- [ ] **Phase 2: Excel Data Migration** - Import 30 weeks of historical data from workbook
- [ ] **Phase 3: Export & Xero Integration** - CSV/PDF download and Xero API scaffold
- [ ] **Phase 4: Validation & Go-Live** - Verify data accuracy and system performance

## Phase Details

### Phase 1: Admin & User Management
**Goal**: Administrators can configure system branding, business rules, and user permissions through dedicated settings pages
**Depends on**: Nothing (first phase)
**Requirements**: ADMN-01, ADMN-02, ADMN-03, ADMN-04, ADMN-05, ADMN-06, USER-01, USER-02, USER-03, USER-04, USER-05
**Success Criteria** (what must be TRUE):
  1. Admin can upload a company logo, set company name, and choose accent colours -- changes appear immediately in the app header
  2. Admin can add/remove pass-through items from a list, and the Financial Deep Dive Net Revenue toggle correctly excludes those items
  3. Admin can configure alert thresholds (net profit, team performance, cash position) and see placeholder system status cards for Xero, 3CX, and Reportei
  4. Admin can view all users in a table, assign roles via dropdown, and toggle page-level Read/Write/No Access permissions in a matrix grid
  5. Changing a user's role automatically updates their default permissions (Super Admin gets full access, Staff gets minimal)
**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md -- Admin settings backend and UI (branding, pass-through items, alert thresholds, system status, SettingsContext, N+1 fix)
- [ ] 01-02-PLAN.md -- User management backend and UI (user list, role assignment, permission matrix, dev user creation)

### Phase 2: Excel Data Migration
**Goal**: Dashboard displays 30 weeks of accurate historical data (Jul 2024 - Jan 2025) imported from the Excel workbook
**Depends on**: Nothing (runs in parallel with Phase 1)
**Requirements**: MIGR-01, MIGR-02, MIGR-03, MIGR-04, MIGR-05, MIGR-06
**Success Criteria** (what must be TRUE):
  1. Running the migration script imports all 30 weeks of data into financial_weekly, projects_weekly, team_performance_weekly, leads_weekly, google_reviews_weekly, and cash_position_weekly with data_source set to 'backfilled'
  2. Excel formula errors (#REF!, #DIV/0!) and merged cells are handled gracefully -- cells with errors are set to null, warnings are logged, and migration does not abort
  3. Running the migration script a second time produces identical results (idempotent -- no duplicate rows)
  4. Migration produces a summary report showing row counts per table and any data quality issues found
**Plans**: TBD

Plans:
- [ ] 02-01: Excel parsing and migration scripts (sheet-specific readers, transposed layout handling, data import)

### Phase 3: Export & Xero Integration
**Goal**: Directors can download dashboard data as CSV or branded PDF, and the Xero API integration scaffold is ready for when credentials arrive
**Depends on**: Phase 1 (PDF needs branding config; Xero status displays in admin settings)
**Requirements**: EXPRT-01, EXPRT-02, EXPRT-03, EXPRT-04, EXPRT-05, XERO-01, XERO-02, XERO-03, XERO-04, XERO-05, XERO-06, XERO-07, XERO-08, XERO-09, XERO-10
**Success Criteria** (what must be TRUE):
  1. Every data table across all dashboard pages has a CSV download button that produces a correctly formatted file with Australian date format (DD/MM/YYYY) and AUD currency
  2. Each dashboard page (Executive Summary, Financial, Regional, Target Management) can be exported as a branded PDF with company logo, page title, selected week, generation timestamp, and all visible charts and tables
  3. PDF exports use landscape orientation for wide-table pages (Financial, Regional) and print-optimised layout with clean spacing and no interactive elements
  4. Xero OAuth2 authorisation flow works end-to-end in mock mode (redirect, consent, callback, encrypted token storage, automatic refresh)
  5. Xero sync services can pull P&L, invoices, and bank summary data into the correct database tables, with configurable scheduling, rate limiting, and a manual "Sync Now" button in admin settings
**Plans**: TBD

Plans:
- [ ] 03-01: CSV export (download buttons, server-side formatting, PapaParse)
- [ ] 03-02: PDF export (Puppeteer setup, print layouts, branded generation)
- [ ] 03-03: Xero API integration (OAuth2 flow, sync services, scheduling, mock mode)

### Phase 4: Validation & Go-Live
**Goal**: System accuracy is verified against known Excel reference values and performance meets the 2-second load target
**Depends on**: Phase 2 (migration data to validate), Phase 3 (export to test round-trip)
**Requirements**: VALD-01, VALD-02, VALD-03, VALD-04, VALD-05, VALD-06
**Success Criteria** (what must be TRUE):
  1. Week 30 Executive Summary KPIs match Excel reference values (Net Profit $62,210.45, Budget $40,203)
  2. Week 30 regional team figures match Excel (Cairns $24,560.60 vs $38,580 target, SEQ Resi $73,838.32 vs $51,888, NQ Commercial $35,820.60 vs $16,248)
  3. Week 30 lead source data matches Excel (Google: 70, SEO: 118, Total: ~257)
  4. CSV round-trip works: export data as CSV, reimport via upload wizard, data matches original
  5. Executive Summary page loads in under 2 seconds with 30 weeks of historical data in the database
**Plans**: TBD

Plans:
- [ ] 04-01: Seed data, validation scripts, performance testing, and target workflow verification

## Progress

**Execution Order:**
Phases 1 and 2 run in parallel (no dependencies between them). Phase 3 follows Phase 1. Phase 4 follows Phases 2 and 3.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Admin & User Management | 1/2 | In progress | - |
| 2. Excel Data Migration | 0/1 | Not started | - |
| 3. Export & Xero Integration | 0/3 | Not started | - |
| 4. Validation & Go-Live | 0/1 | Not started | - |
