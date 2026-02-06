---
phase: 03-export-xero-integration
plan: 01
subsystem: ui
tags: [csv, export, pdf, react, typescript, rfc4180]

# Dependency graph
requires:
  - phase: 01-admin-user-management
    provides: ExportButtons stub component, dashboard page layouts
  - phase: 02-excel-data-migration
    provides: Dashboard data populated for export
provides:
  - Client-side CSV generation utility with Australian formatters
  - Enhanced ExportButtons component with CSV + PDF handlers
  - CSV download on all 4 dashboard pages
  - PDF export API client (pending server-side generation in 03-02)
affects: [03-02-pdf-generation, 04-validation]

# Tech tracking
tech-stack:
  added: []
  patterns: [client-side-csv-generation, rfc4180-csv, utf8-bom-excel]

key-files:
  created:
    - client/src/lib/csvExport.ts
    - client/src/lib/exportApi.ts
  modified:
    - client/src/components/ui/ExportButtons.tsx
    - client/src/components/dashboard/ExecutiveSummary.tsx
    - client/src/components/dashboard/FinancialDeepDive.tsx
    - client/src/components/dashboard/RegionalPerformance.tsx
    - client/src/components/targets/TargetManagement.tsx

key-decisions:
  - "No PapaParse on client -- built lightweight RFC 4180 CSV generator instead"
  - "AUD_FORMATTER outputs plain toFixed(2) numbers so Excel can auto-format currency"
  - "Each page exports its primary data table (not all tables combined)"
  - "ExportButtons onCsvExport is a callback prop -- parent owns data and column definitions"

patterns-established:
  - "CsvColumn<T> interface for typed CSV column definitions with optional formatters"
  - "Parent-owned CSV export pattern: page component defines columns, ExportButtons triggers"
  - "downloadPdf() API client pattern for server-side PDF generation"

# Metrics
duration: 6min
completed: 2026-02-06
---

# Phase 3 Plan 01: CSV Export System Summary

**RFC 4180-compliant CSV export utility with Australian date/currency formatters, integrated into all 4 dashboard pages via enhanced ExportButtons component**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-06T07:15:01Z
- **Completed:** 2026-02-06T07:20:52Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Built client-side CSV generator with UTF-8 BOM for Excel, RFC 4180 escaping, CRLF line endings
- Created Australian formatters (AUD plain numbers, DD/MM/YYYY dates, percentage)
- Enhanced ExportButtons with real CSV callback and PDF loading/error state
- Integrated CSV export into Executive Summary, Financial Deep Dive, Regional Performance, and Target Management pages

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CSV export utility and export API client** - `cc25deb` (feat)
2. **Task 2: Enhance ExportButtons and integrate into all dashboard pages** - `9086585` (feat)

## Files Created/Modified
- `client/src/lib/csvExport.ts` - CSV generation utility with CsvColumn type, downloadCsv(), and AU formatters
- `client/src/lib/exportApi.ts` - PDF export API client (calls /api/v1/exports/pdf/)
- `client/src/components/ui/ExportButtons.tsx` - Enhanced with onCsvExport callback, PDF loading/error state
- `client/src/components/dashboard/ExecutiveSummary.tsx` - Export header + project summary CSV
- `client/src/components/dashboard/FinancialDeepDive.tsx` - Export header + P&L weekly CSV
- `client/src/components/dashboard/RegionalPerformance.tsx` - Export header + team comparison CSV
- `client/src/components/targets/TargetManagement.tsx` - Export buttons + target list CSV

## Decisions Made
- No PapaParse on client side -- built a lightweight 90-line RFC 4180 CSV generator instead (PapaParse only installed on server)
- AUD_FORMATTER outputs plain `toFixed(2)` numbers (e.g. `1234.56` not `$1,234.56`) so Excel can natively format them
- Each page exports its primary data table rather than all tables combined (Executive Summary exports project summary, Financial exports P&L, Regional exports team comparison, Targets exports the target list)
- ExportButtons uses a callback prop pattern (`onCsvExport`) so the parent component owns data and column definitions -- cleaner than passing raw data through the button component

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CSV export complete, ready for Plan 03-02 (server-side PDF generation)
- PDF button wired and will work once the `/api/v1/exports/pdf/` endpoint exists
- All pages have export headers positioned for consistent UX

---
*Phase: 03-export-xero-integration*
*Completed: 2026-02-06*
