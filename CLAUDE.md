# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Business dashboard for Buildable Approvals Pty Ltd (Queensland building certification company). Replaces a manual Excel workbook with a web-based reporting system. The primary data entry user (April) is non-technical; directors need reliable weekly reporting.

**The CSV upload system (Tasks 4-7) is the most critical feature.** It is more important than polished charts.

## Tech Stack

- **Frontend:** React + TypeScript, Vite, Tailwind CSS, Recharts
- **Backend:** Node.js + TypeScript, Express (or Fastify)
- **Database:** PostgreSQL with Prisma ORM
- **Monorepo:** `client/` and `server/` directories with root workspace scripts
- **Hosting:** Windows 11 local server (all paths/configs must be platform-agnostic)

## Build & Run Commands

```bash
npm run dev          # Start both client and server in dev mode
npm run build        # Production build
npm run start        # Start production
npm run migrate      # Run Prisma migrations (npx prisma migrate dev)
```

Start/stop scripts: `start-dashboard.bat` / `stop-dashboard.bat`

Client dev server: `http://localhost:4200` (proxies `/api` to server)
Server API: `http://localhost:6001`
Health check: `GET /api/health`
API prefix: `/api/v1/`

## Architecture

### Backend Structure
- **Routes** grouped by domain: financial, projects, sales, teams, marketing, targets, uploads, weeks
- **Service layer** for business logic: `WeekService` (Saturday date snapping), `TargetService` (effective date resolution), `FinancialService` (derived metrics)
- **Auth middleware** with dev bypass (`NODE_ENV=development` auto-authenticates as Super Admin)
- **Permission middleware:** `requirePermission(page, level)` — four roles: Super Admin, Executive, Manager, Staff

### Frontend Structure
- **App shell:** Asana-style sidebar navigation, top bar with week selector (snaps to Saturdays)
- **Dashboard pages:** Executive Summary (home), Financial, Regional Performance, Data Management, Target Management, Admin Settings, User Management
- **Shared UI components:** KPI Card, Data Table, Loading skeleton, Empty state, Export buttons
- **CSV Upload Wizard:** 5-step flow (select type → upload → map columns → preview/validate → confirm)

### Database
- 18 table groups (see `Buildable_Dashboard_Phase1_Task_Sequence.md` Task 1 for full list)
- All `week_ending` fields are `Date` type, always a Saturday
- Currency fields use `Decimal` (not Float)
- `data_source` enum on upload-receiving tables: `csv_upload`, `xero_api`, `manual_entry`, `backfilled`
- Targets use `effective_from`/`effective_to` date range pattern with `target_history` audit trail

## Key Business Rules

- **Australian English:** colour, organisation, metre
- **Date format:** DD/MM/YYYY for display, ISO for storage/API. Week ending = always Saturday.
- **Currency:** AUD, formatted `$X,XXX.XX`. Negatives in red with parentheses or minus.
- **Financial year:** 1 July – 30 June (Australian standard)
- **9 fixed regions:** Cairns, Mackay, NQ Commercial, SEQ Residential, SEQ Commercial, Town Planning, Townsville, Wide Bay, All In Access
- **Revenue (Invoiced)** = Resi + Commercial + Retro Xero Invoiced (matches Xero). Different from **Revenue (P&L)** = Total Trading Income from `financial_weekly`.
- **Revenue to Staff Ratio** = (Wages & Salaries / Total Trading Income) × 100. Lower is better. 55–65% benchmark band.
- **Net Revenue toggle** strips pass-through items (council fees, insurance levy). Gross is default.
- **Gross Profit** = Total Trading Income − Total Cost of Sales
- **Target resolution:** most recent `effective_from` ≤ requested week

## CSV Upload System

Column mapping auto-applies when ≥80% of CSV headers match a saved mapping. 15+ importable data types map to specific database tables (e.g. "Financial - P&L" → `financial_weekly`). Validation rules: dates auto-correct to nearest Saturday (within 3 days), strips `$`/`,` from currency, normalises percentage formats, skips blank rows with warnings.

## Design Language

Emulates Asana: clean, generous whitespace, card-based, soft colour palette.
- Colours: primary `#4573D2`, success `#6AAF50`, warning `#E8A442`, error `#D94F4F`, bg `#F9FAFB`, card `#FFFFFF`, text `#1A1A2E`, secondary text `#6B7280`
- Cards: white, subtle shadow, 8px radius, 24px padding
- Spacing: 16px grid, 24px between cards, 32px section gaps
- Typography: Inter or system sans-serif

## Performance Target

Executive Summary loads in under 2 seconds. Don't over-fetch data. 13-week rolling window for charts.

## Task Sequence

Full build sequence with dependencies is in `Buildable_Dashboard_Phase1_Task_Sequence.md`. Tasks 0–18 with dependency map and suggested parallel build order.
