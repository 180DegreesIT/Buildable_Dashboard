---
phase: 03-export-xero-integration
plan: 02
subsystem: export
tags: [pdf, puppeteer, chromium, printing, react, node]

# Dependency graph
requires:
  - phase: 03-export-xero-integration
    plan: 01
    provides: ExportButtons component with PDF button wired
  - phase: 01-admin-user-management
    provides: Settings branding for PDF headers
  - phase: 02-excel-data-migration
    provides: Dashboard data for PDF rendering
provides:
  - Server-side PDF generation service using Puppeteer
  - Print-optimised page variants for all 4 dashboard pages
  - PDF export API route at /api/v1/exports/pdf/:page
  - Hash-based print routing (#/print/:page?week=) on client
affects: [04-validation]

# Tech tracking
tech-stack:
  added: [puppeteer]
  patterns: [headless-chromium-pdf-generation, hash-based-routing, print-css-media-query, data-ready-attribute]

key-files:
  created:
    - server/src/services/PdfExportService.ts
    - server/src/routes/exports.ts
    - client/src/components/print/PrintLayout.tsx
    - client/src/components/print/PrintExecutiveSummary.tsx
    - client/src/components/print/PrintFinancial.tsx
    - client/src/components/print/PrintRegional.tsx
    - client/src/components/print/PrintTargets.tsx
  modified:
    - server/src/index.ts
    - client/src/App.tsx
    - server/package.json

key-decisions:
  - "Hash-based routing (#/print/:page) to avoid client routing conflicts (app uses state-based page switching)"
  - "data-print-ready attribute signals Puppeteer when content fully loaded (prevents capturing mid-render)"
  - "isAnimationActive={false} on ALL Recharts components (critical for static PDF capture)"
  - "Fixed-width containers for print pages (1200px portrait, 1600px landscape) instead of responsive breakpoints"
  - "PUPPETEER_EXECUTABLE_PATH env var for Edge fallback on Windows 11 (if Chromium download blocked)"
  - "Page orientation defined per page type: Executive Summary and Targets portrait, Financial and Regional landscape"
  - "Browser cleanup in finally block to prevent process leaks"

patterns-established:
  - "Print-optimised component pattern: separate print variants with no interactivity, animations, or loading states"
  - "Puppeteer waitForSelector('[data-print-ready]') for render synchronization"
  - "PAGE_CONFIG map for page-specific PDF settings (orientation, title)"
  - "Print layout wrapper pattern: shared branding header, footer generation via Puppeteer templates"

# Metrics
duration: 13min
completed: 2026-02-06
---

# Phase 3 Plan 02: PDF Export via Puppeteer Summary

**Server-side PDF generation using Puppeteer headless Chromium, rendering print-optimised page variants with branded headers, correct orientation, and static chart capture**

## Performance

- **Duration:** 13 min
- **Started:** 2026-02-06T07:45:32Z
- **Completed:** 2026-02-06T07:50:53Z
- **Tasks:** 2 (+ 1 hooks fix by orchestrator)
- **Files created:** 7
- **Files modified:** 3

## Accomplishments
- Installed Puppeteer and configured headless Chromium with Windows 11 Edge fallback
- Built PDF generation service with per-page orientation support (landscape for Financial/Regional, portrait for Executive/Targets)
- Created API route at /api/v1/exports/pdf/:page with week query param
- Implemented hash-based print routing in App.tsx to avoid client routing conflicts
- Created 5 print-optimised components: shared PrintLayout wrapper + 4 page variants
- Disabled animations on all Recharts components using isAnimationActive={false}
- Added data-print-ready attribute for Puppeteer render synchronization
- Fixed useCallback hook placement issue (9f4edd5 by orchestrator)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Puppeteer and create PDF generation service + API route** - `4d97485` (feat)
2. **Task 2: Create print-optimised page variants on client** - `f2c6f07` (feat)
3. **Hooks fix: Move useCallback before early returns** - `9f4edd5` (fix, by orchestrator)

## Files Created/Modified

**Created:**
- `server/src/services/PdfExportService.ts` - Puppeteer service with PAGE_CONFIG map, browser lifecycle management, PDF generation with branded headers/footers
- `server/src/routes/exports.ts` - Express router with GET /pdf/:page endpoint (validates page slug, calls generatePdf, streams PDF buffer)
- `client/src/components/print/PrintLayout.tsx` - Shared print wrapper with branding header, fixed-width containers, print CSS, data-print-ready attribute
- `client/src/components/print/PrintExecutiveSummary.tsx` - KPI cards, charts (Net Profit, Revenue by Category, Regional Performance), data tables
- `client/src/components/print/PrintFinancial.tsx` - P&L table, revenue breakdown chart, cost analysis chart, cash position table
- `client/src/components/print/PrintRegional.tsx` - 9-team comparison table, regional trend chart
- `client/src/components/print/PrintTargets.tsx` - Target list table grouped by type with effective dates

**Modified:**
- `server/src/index.ts` - Registered exports routes at /api/v1/exports
- `client/src/App.tsx` - Added hash-based print mode detection, PrintRouter component
- `server/package.json` - Added puppeteer dependency

## Decisions Made

- **Hash-based routing (#/print/:page)** instead of full router integration — app uses state-based page switching, hash routing avoids conflicts and works seamlessly with Puppeteer navigation
- **data-print-ready attribute** added to PrintLayout root element only after data loads — prevents Puppeteer from capturing mid-render or loading spinners
- **isAnimationActive={false} on ALL Recharts** — critical setting; without it Puppeteer captures charts mid-animation resulting in blank or partial renders
- **Fixed-width containers** (1200px portrait, 1600px landscape) — print pages use absolute pixel widths instead of responsive breakpoints for consistent PDF layout
- **PUPPETEER_EXECUTABLE_PATH env var** for Edge fallback — if Chromium download is blocked by Windows firewall, can point to existing Edge binary
- **Page-specific orientation via PAGE_CONFIG** — Financial and Regional use landscape (wide tables), Executive Summary and Targets use portrait
- **Browser cleanup in finally block** — ensures Puppeteer processes never leak even if PDF generation throws

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed React hooks ordering violation**
- **Found during:** Task 2 compilation
- **Issue:** useCallback hooks placed after early return statements in App.tsx violated React hooks rules
- **Fix:** Moved all useCallback hooks before conditional return (printMode check)
- **Files modified:** client/src/App.tsx
- **Commit:** 9f4edd5 (by orchestrator)

## Issues Encountered

None beyond the hooks ordering fix.

## User Setup Required

**Puppeteer Chromium binary:**
- Chromium downloads automatically during `npm install puppeteer` (~250MB)
- If Windows firewall blocks download, set env var: `PUPPETEER_EXECUTABLE_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
- Fallback uses existing Edge browser (Chromium-based)

**No external service credentials required.**

## Next Phase Readiness

- PDF export complete and functional across all 4 dashboard pages
- All must-haves satisfied: EXPRT-02 (branded PDF), EXPRT-03 (branding elements), EXPRT-04 (orientation), EXPRT-05 (print layout)
- Phase 3 now complete (03-01 CSV export, 03-02 PDF export, 03-03 Xero integration all done)
- Ready for Phase 4 (Validation) — verifying data accuracy, performance, error handling

---
*Phase: 03-export-xero-integration*
*Completed: 2026-02-06*
