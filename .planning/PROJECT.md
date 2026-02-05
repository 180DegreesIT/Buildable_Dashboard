# Buildable Business Dashboard

## What This Is

A web-based business dashboard for Buildable Approvals Pty Ltd (Queensland building certification company) that replaces a manual Excel workbook with automated weekly reporting. Data entry user (April, non-technical) uploads CSV data; directors (Rod, Matt, Grant, Di) consume financial, regional, and operational reports. The CSV upload system is the most critical feature.

## Core Value

April can upload weekly data from Xero/HyperFlo exports and directors see accurate, reliable financial and operational reports without manual spreadsheet work.

## Requirements

### Validated

- ✓ Monorepo scaffold with client (React/Vite/Tailwind) and server (Express/Prisma/PostgreSQL) — existing
- ✓ Full database schema (18 table groups) with Prisma migrations and seed data — existing
- ✓ Core API routes grouped by domain (financial, projects, sales, teams, marketing, targets, uploads, weeks) — existing
- ✓ Service layer: WeekService (Saturday snapping), TargetService (effective date resolution), FinancialService (derived metrics) — existing
- ✓ Auth middleware with dev bypass and production-ready M365 SSO structure — existing
- ✓ Permission middleware with four roles (Super Admin, Executive, Manager, Staff) — existing
- ✓ CSV parsing engine: header detection, type inference, validation (date/currency/percentage normalisation) — existing
- ✓ Column mapping system: 15+ data types, auto-mapping at 80% header match, mapping CRUD — existing
- ✓ Data import/rollback engine: transaction-based import, duplicate detection, rollback capability — existing
- ✓ CSV upload UI: 5-step wizard (select type, upload, map columns, preview/validate, confirm) with upload history — existing
- ✓ App shell: Asana-style sidebar navigation, top bar with week selector (Saturday snap), shared UI components — existing
- ✓ Executive Summary: 7 KPI cards, 3 charts (Net Profit trend, Revenue by category, Regional performance), 4 data tables — existing
- ✓ Financial Deep Dive: P&L weekly/monthly, revenue breakdown, net revenue toggle, cost analysis, cash position, aged receivables — existing
- ✓ Regional Performance: 9-team comparison table, trend chart, drill-down per region, colour-coded indicators — existing
- ✓ Target Management: CRUD interface grouped by type, bulk team update, change history timeline, effective date logic — existing (uncommitted)

### Active

- [ ] Historical data migration: Extract 30 weeks (Jul 2024 – Jan 2025) from Excel workbook into database with `data_source: 'backfilled'`
- [ ] Admin settings page: branding config, pass-through items list (for net revenue toggle), alert thresholds, system status cards
- [ ] User management page: user list, role assignment, page-level permission matrix grid
- [ ] PDF and CSV export: download buttons on all dashboard views, branded PDF generation
- [ ] Xero API integration scaffold: OAuth2 flow, sync services (P&L, invoices, bank summary), scheduling, rate limiting, mock mode
- [ ] Seed data and end-to-end validation: validation scripts verifying Week 30 figures match Excel, performance testing

### Out of Scope

- Real-time chat or notifications — not needed for weekly reporting workflow
- Mobile native app — desktop/iPad web is sufficient for the user base
- Sales & Pipeline page — Phase 2
- Marketing & Leads page — Phase 2
- Operations page — Phase 2
- Live alert engine — Phase 2 (config UI built in admin settings, but no active alert firing)
- 3CX phone integration — Phase 3
- Reportei integration — Phase 3

## Context

- **Existing codebase:** 11 tasks complete and committed (Tasks 0-11), Task 12 functionally complete but uncommitted. React + TypeScript frontend, Express + Prisma backend, PostgreSQL database.
- **Users:** April (non-technical data entry), Rod/Matt/Grant/Di (directors consuming reports). April's workflow is the critical path — CSV uploads must be intuitive.
- **Data source:** Weekly Excel workbook (`Weekly_Report__30.xlsx`) with 12 sheets, 30 weeks of historical data. Xero API will eventually replace manual exports.
- **Server TS issues:** Pre-existing Prisma generated type import path issues in server (non-blocking, dev server runs fine).
- **Design language:** Asana-inspired — clean, generous whitespace, card-based, soft colour palette. Primary #4573D2, success #6AAF50, warning #E8A442, error #D94F4F.

## Constraints

- **Platform**: Windows 11 local server — all paths/configs must be platform-agnostic
- **Australian English**: colour, organisation, metre throughout codebase and UI
- **Date format**: DD/MM/YYYY display, ISO storage. Week ending = always Saturday.
- **Currency**: AUD, `$X,XXX.XX`. Negatives in red with parentheses.
- **Financial year**: 1 July – 30 June (Australian standard)
- **Performance**: Executive Summary loads in under 2 seconds. 13-week rolling window for charts.
- **Regions**: 9 fixed regions — Cairns, Mackay, NQ Commercial, SEQ Residential, SEQ Commercial, Town Planning, Townsville, Wide Bay, All In Access
- **Auth dependency**: M365 SSO requires Azure AD app registration (pending from 180D). Dev bypass in place.
- **Xero dependency**: Xero developer app credentials pending from 180D. Scaffold with mock mode.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React + Vite + Tailwind frontend | Fast dev cycle, matches team capability | ✓ Good |
| Express + Prisma + PostgreSQL backend | Familiar stack, strong ORM typing | ✓ Good |
| Asana-inspired design language | Clean, professional, accessible for non-technical users | ✓ Good |
| Saturday-based week ending | Matches existing Excel reporting cadence | ✓ Good |
| CSV upload as critical path (Tasks 4-7 before dashboards) | System fails if April can't upload data | ✓ Good |
| Effective date pattern for targets | Supports historical queries without losing audit trail | ✓ Good |
| Dev auth bypass (NODE_ENV=development) | Unblocks development while waiting for Azure AD credentials | ✓ Good |
| Two revenue metrics (Invoiced vs P&L) | Matches business reality — Xero accrual vs invoice totals differ | ✓ Good |

---
*Last updated: 2026-02-06 after GSD initialization (brownfield resume)*
