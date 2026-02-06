# Requirements: Buildable Dashboard (Remaining Build)

**Defined:** 2026-02-06
**Core Value:** April can upload weekly data and directors see accurate, reliable financial and operational reports

## v1 Requirements

### Excel Data Migration

- [ ] **MIGR-01**: Parse Weekly Report sheet (transposed layout — weeks as columns, metrics as rows) into financial_weekly, projects_weekly, team_performance_weekly, leads_weekly, google_reviews_weekly
- [ ] **MIGR-02**: Parse Finance This Week sheet into cash_position_weekly (bank balances, receivables, payables)
- [ ] **MIGR-03**: Handle #REF! and #DIV/0! errors gracefully (skip cells, set to null, log warnings)
- [ ] **MIGR-04**: Import all 30 weeks (Jul 2024 – Jan 2025) with `data_source: 'backfilled'`
- [ ] **MIGR-05**: Migration script is idempotent (re-runnable without duplicating data)
- [ ] **MIGR-06**: Migration produces summary report (row counts per table, data quality issues found)

### Admin Settings

- [ ] **ADMN-01**: Branding config UI (upload logo, set company name, primary/accent colour)
- [ ] **ADMN-02**: Branding changes reflect immediately in app header and PDF exports
- [ ] **ADMN-03**: Pass-through items list (add/remove items, used by Net Revenue toggle on financial views)
- [ ] **ADMN-04**: Alert threshold configuration (net profit below budget X weeks, team below X%, cash approaching overdraft within $X)
- [ ] **ADMN-05**: System status cards (Xero connection status, 3CX placeholder, Reportei placeholder)
- [ ] **ADMN-06**: Backup status display (last backup timestamp, informational)

### User Management

- [ ] **USER-01**: User list table showing display name, email, role, active/inactive status, last login
- [ ] **USER-02**: Role assignment via dropdown (Super Admin, Executive, Manager, Staff)
- [ ] **USER-03**: Permission matrix grid — users as rows, pages as columns, toggle Read/Write/No Access per cell
- [ ] **USER-04**: Changing role updates default permissions (Super Admin = full access, Staff = minimal)
- [ ] **USER-05**: Dev mode manual user creation for testing

### PDF & CSV Export

- [ ] **EXPRT-01**: CSV download button on every data table across all dashboard pages
- [ ] **EXPRT-02**: Branded PDF snapshot of each dashboard page (Executive Summary, Financial, Regional, Target Management)
- [ ] **EXPRT-03**: PDF includes Buildable branding (logo, company name), page title, selected week, generation timestamp, all visible charts and tables
- [ ] **EXPRT-04**: Landscape orientation for pages with wide tables (Financial, Regional)
- [ ] **EXPRT-05**: Print-optimised layout for PDF rendering (clean spacing, no interactive elements)

### Xero API Integration

- [ ] **XERO-01**: OAuth2 authorisation flow (redirect to Xero consent, callback endpoint)
- [ ] **XERO-02**: Encrypted token storage (access token, refresh token, expiry timestamps in database)
- [ ] **XERO-03**: Automatic token refresh handling (30-min access token lifecycle, 60-day refresh token inactivity window)
- [ ] **XERO-04**: Sync service: P&L report → financial_weekly
- [ ] **XERO-05**: Sync service: invoices → revenue_weekly and projects_weekly
- [ ] **XERO-06**: Sync service: bank summary → cash_position_weekly
- [ ] **XERO-07**: Configurable sync scheduling (cron job, default daily 6am AEST) plus manual "Sync Now" button
- [ ] **XERO-08**: Rate limiting respecting Xero limits (60 calls/min, 5,000/day)
- [ ] **XERO-09**: Mock mode for development without live Xero connection
- [ ] **XERO-10**: Xero connection status displayed in admin settings

### End-to-End Validation

- [ ] **VALD-01**: Week 30 KPI values match Excel reference (Net Profit $62,210.45, Budget $40,203)
- [ ] **VALD-02**: Regional team figures match for Week 30 (Cairns $24,560.60 vs $38,580 target, SEQ Resi $73,838.32 vs $51,888, NQ Commercial $35,820.60 vs $16,248)
- [ ] **VALD-03**: Lead source data matches for Week 30 (Google: 70, SEO: 118, Total: ~257)
- [ ] **VALD-04**: CSV upload round-trip test (export data as CSV → reimport → data matches)
- [ ] **VALD-05**: Target management workflow test (create target → verify applies to correct weeks → change target → verify history)
- [ ] **VALD-06**: Executive Summary loads in under 2 seconds with 30 weeks of historical data

## v2 Requirements

### Extended Data Migration

- **MIGR-07**: Parse remaining Excel sheets (Sales Weekly, Marketing Weekly, Operations, Productivity, Phone)
- **MIGR-08**: Monthly aggregation validation against Excel Monthly sheet

### Alerts & Notifications

- **ALRT-01**: Active alert engine fires when thresholds breached (config UI in v1, engine in v2)
- **ALRT-02**: In-dashboard alert notifications with dismissal
- **ALRT-03**: Email alerts for critical thresholds

### External Integrations

- **INTG-01**: 3CX phone system integration (call metrics auto-import)
- **INTG-02**: Reportei marketing integration (automated marketing data sync)

### Additional Dashboard Views

- **VIEW-01**: Sales & Pipeline page
- **VIEW-02**: Marketing & Leads page
- **VIEW-03**: Operations & Productivity page

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time chat/notifications | Not needed for weekly reporting workflow |
| Mobile native app | Desktop/iPad web sufficient for user base |
| OAuth/social login | M365 SSO only (pending Azure AD credentials) |
| Live alert engine | Phase 2 — config UI built in v1, engine deferred |
| Full 12-sheet Excel migration | Core sheets cover primary financial/team/lead data; remaining sheets deferred to v2 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MIGR-01 | TBD | Pending |
| MIGR-02 | TBD | Pending |
| MIGR-03 | TBD | Pending |
| MIGR-04 | TBD | Pending |
| MIGR-05 | TBD | Pending |
| MIGR-06 | TBD | Pending |
| ADMN-01 | TBD | Pending |
| ADMN-02 | TBD | Pending |
| ADMN-03 | TBD | Pending |
| ADMN-04 | TBD | Pending |
| ADMN-05 | TBD | Pending |
| ADMN-06 | TBD | Pending |
| USER-01 | TBD | Pending |
| USER-02 | TBD | Pending |
| USER-03 | TBD | Pending |
| USER-04 | TBD | Pending |
| USER-05 | TBD | Pending |
| EXPRT-01 | TBD | Pending |
| EXPRT-02 | TBD | Pending |
| EXPRT-03 | TBD | Pending |
| EXPRT-04 | TBD | Pending |
| EXPRT-05 | TBD | Pending |
| XERO-01 | TBD | Pending |
| XERO-02 | TBD | Pending |
| XERO-03 | TBD | Pending |
| XERO-04 | TBD | Pending |
| XERO-05 | TBD | Pending |
| XERO-06 | TBD | Pending |
| XERO-07 | TBD | Pending |
| XERO-08 | TBD | Pending |
| XERO-09 | TBD | Pending |
| XERO-10 | TBD | Pending |
| VALD-01 | TBD | Pending |
| VALD-02 | TBD | Pending |
| VALD-03 | TBD | Pending |
| VALD-04 | TBD | Pending |
| VALD-05 | TBD | Pending |
| VALD-06 | TBD | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 0
- Unmapped: 33 (pending roadmap creation)

---
*Requirements defined: 2026-02-06*
*Last updated: 2026-02-06 after initial definition*
