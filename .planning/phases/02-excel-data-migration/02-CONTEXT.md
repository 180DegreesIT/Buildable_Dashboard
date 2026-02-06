# Phase 2: Excel Data Migration - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Import 30 weeks of historical data (Jul 2024 - Jan 2025) from the Excel workbook into 6 database tables: financial_weekly, projects_weekly, team_performance_weekly, leads_weekly, google_reviews_weekly, and cash_position_weekly. The workbook uses a transposed layout (weeks as columns, metrics as rows). Migration must be idempotent, handle formula errors and merged cells gracefully, and produce a detailed summary report.

**Workbook location:** `C:\Users\Dev180D\Downloads\Client_Files\Reporting\Weekly Report - 30.xlsx`

</domain>

<decisions>
## Implementation Decisions

### Error & edge case handling
- Formula errors (#REF!, #DIV/0!, #N/A) → set to **zero**, log warning (not null)
- Missing week columns (present in one sheet but not another) → **insert row with null values** so the timeline has no gaps
- Unknown/unrecognised row labels → **skip and warn** (log which rows were skipped)
- Negative currency values use standard minus sign format (-$1,234)
- Percentage format uncertain — may be whole numbers or decimals depending on sheet; **auto-detect and normalise**
- Date values in data cells uncertain — **handle both date and non-date cells gracefully**
- Layout may vary per sheet (not all sheets guaranteed to be transposed) — **auto-detect layout during parsing**

### Migration workflow
- **Admin UI button** under the existing Data Management page (not a CLI-only script)
- **Two-step flow:** Upload & Preview (dry-run) → Confirm & Import
- **Real-time progress** during import (show which sheet is being processed, row counts, live updates)
- **File source:** Support both UI upload AND server-side file path
- **Re-runnable (idempotent):** Admin can re-upload and re-run anytime — upserts overwrite existing data for the same week
- **Access control:** Super Admin and Executive roles can access the migration tool

### Data quality reporting
- **Detailed report with sample values:** Row counts per table, all warnings, AND sample values from each table for spot-checking
- **Warning display:** Summary warnings inline in the UI, PLUS a downloadable file with complete details
- **Dry-run preview:** Shows parsed data preview so admin can verify correctness before committing

### Sheet-to-table mapping
- Sheet names may not match database table names exactly — **researcher must examine the actual workbook** to determine the mapping
- Regional data layout (one sheet per region vs all-on-one) unknown — **researcher must determine from workbook**
- **Import everything useful** — try to map every sheet that has data matching a database table; no sheets explicitly excluded
- Sheets that are purely summary/calculated may exist — researcher should identify and skip these

### Claude's Discretion
- Merged cell handling strategy (unmerge and fill down vs read top-left only — pick based on context)
- Blocking error vs warning criteria (sensible thresholds based on data integrity risk)
- Dry-run preview format (pick the most useful preview layout for a 30-week dataset)
- Exact real-time progress mechanism (SSE, polling, or WebSocket — pick simplest reliable option)
- Sheet-to-table mapping logic once workbook structure is examined

</decisions>

<specifics>
## Specific Ideas

- The existing CSV Upload Wizard (5-step flow) is on the Data Management page — the Excel migration tool should feel visually consistent with it
- Two-step flow mirrors the CSV wizard's "preview → confirm" pattern but simplified for one-off migration
- Workbook is "Weekly Report - 30.xlsx" — the "30" likely refers to 30 weeks of data
- data_source should be set to 'backfilled' for all migrated records

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-excel-data-migration*
*Context gathered: 2026-02-06*
