# Phase 4: Validation & Go-Live - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify that imported data matches known Excel reference values across all migrated tables, confirm CSV round-trip integrity, and ensure all dashboard pages meet the 2-second full-render performance target. This is a verification/testing phase -- no new features are built.

</domain>

<decisions>
## Implementation Decisions

### Tolerance & matching rules
- Exact to the cent for all currency values -- any difference is a failure
- Exact match for percentages (same decimal places as Excel)
- Mismatches reported as: expected vs actual + difference (e.g. "Net Profit: expected $62,210.45, got $62,198.30 (diff: -$12.15)")

### Validation reporting
- Dual output: terminal console AND on-screen display in the dashboard
- Summary score at the top (e.g. "47/50 checks passed") followed by detailed breakdown of any failures
- No persistence needed -- terminal + on-screen is sufficient for this one-time go-live check

### Reference data approach
- Validate 3-4 checkpoint weeks across the full range (early, middle, late -- e.g. Weeks 1, 10, 20, 30)
- Reference values stored in a separate JSON data file (not hard-coded in script)
- Reference values extracted automatically from the Excel workbook using ExcelJS (same library as migration)
- Validate ALL migrated tables: financial, projects, team performance, leads, Google reviews, cash position

### Performance testing
- Target: full page load (all charts, tables, and KPIs fully rendered) under 2 seconds
- Measured on warm load (subsequent page navigation within the app, not cold first-visit)
- Test ALL dashboard pages: Executive Summary, Financial, Regional, Target Management
- Automated measurement using Puppeteer (already installed on server)

### Claude's Discretion
- Terminal output format (structured table vs grouped by page -- pick most readable)
- CSV round-trip matching rules (values must match; metadata like data_source and timestamps may differ)
- Specific checkpoint week numbers (pick representative weeks from the 30-week range)
- Which specific fields to extract and compare per table (cover key aggregates and representative detail rows)
- Puppeteer timing methodology (Performance API, navigation timing, or custom markers)

</decisions>

<specifics>
## Specific Ideas

- Reuse ExcelJS infrastructure from Phase 2 migration parsers for reference value extraction
- Reuse Puppeteer infrastructure from Phase 3 PDF export for performance measurement
- The roadmap gives concrete Week 30 values: Net Profit $62,210.45, Budget $40,203, Cairns $24,560.60 vs $38,580 target, SEQ Resi $73,838.32 vs $51,888, NQ Commercial $35,820.60 vs $16,248, Google leads 70, SEO leads 118, Total leads ~257

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 04-validation-go-live*
*Context gathered: 2026-02-06*
