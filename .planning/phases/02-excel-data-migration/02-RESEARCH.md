# Phase 02: Excel Data Migration - Research

**Researched:** 2026-02-06
**Domain:** Excel workbook parsing, transposed data extraction, database migration
**Confidence:** HIGH

## Summary

Comprehensive analysis of the "Weekly Report - 30.xlsx" workbook reveals 19 sheets with varying layouts, date ranges, and data quality. The workbook contains FY2025-26 data (July 2025 to January 2026), not FY2024-25 as originally assumed. Only 30 of the 52 template columns have actual data (the rest are future placeholders). The workbook uses a **transposed layout** (weeks as columns, metrics as rows) in most sheets, with one exception: the Weekly Revenue Report uses a standard table layout.

Critical findings include: (1) dates in most sheets are **Sundays, not Saturdays** -- must snap to previous Saturday; (2) 67 formula errors (#DIV/0!) and 168 uncached cross-sheet formula references in the main sheet alone; (3) some cells contain ExcelJS object types (hyperlinks, richtext, formulas without cached results) that need special handling; (4) the Finance This Week sheet is a **single-week narrative snapshot**, not a weekly time series -- it cannot provide historical cash_position_weekly data.

**Primary recommendation:** Use ExcelJS as the sole parsing library. Build sheet-specific parsers for each mappable sheet. Implement SSE for real-time progress. The migration UI should be a new tab on the existing Data Management page.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ExcelJS | ^4.4.0 | Read .xlsx files, handle merged cells, detect formula errors | Only mature Node.js library that exposes cell-level metadata (formula results, error types, hyperlinks, richtext). Already verified against actual workbook. |
| Prisma (existing) | ^6.3.0 | Database upserts for idempotent import | Already in project; upsert with unique constraints is the correct idempotency mechanism. |
| Express (existing) | ^4.21.2 | API routes for migration endpoints | Already in project; SSE works natively. |
| multer (existing) | ^1.4.5-lts.1 | File upload handling | Already in project; increase size limit for .xlsx files (~1.3MB). |
| zod (existing) | ^3.24.1 | Request validation | Already in project. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (native SSE) | N/A | Real-time progress streaming | Use Express `res.write()` with `text/event-stream` headers. No library needed. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ExcelJS | xlsx (SheetJS) | SheetJS is faster but has weaker TypeScript support and less granular cell metadata. ExcelJS exposes formula error types directly, which is critical for this workbook. |
| Native SSE | better-sse library | Library adds dependency for a simple use case. Native SSE is ~20 lines of code. |

**Installation:**
```bash
cd server && npm install exceljs
cd server && npm install -D @types/exceljs  # Note: ExcelJS ships its own types, may not need separate package
```

## Workbook Analysis

### Overview
- **File:** Weekly Report - 30.xlsx (1.29 MB)
- **Sheets:** 19 total
- **Data range:** 30 weeks with data (July 2025 - January 2026)
- **Financial year:** FY2025-26 (1 July 2025 - 30 June 2026)

### Sheet Inventory

| # | Sheet Name | Layout | Rows | Cols | Date Range | Errors | Uncached | Importable? |
|---|-----------|--------|------|------|-----------|--------|----------|-------------|
| 1 | Weekly Report | Transposed | 161 | 62 | 2025-07-06 to 2026-06-28 (30 with data) | 67 | 168 | YES - primary data source |
| 2 | Weekly Approvable | Transposed | 93 | 55 | 2025-07-06 to 2026-06-28 | 5 | 27 | PARTIAL - leads/sales for Approvable brand |
| 3 | Monthly | Summary | 15 | 20 | Quarterly aggregates | 17 | 40 | NO - calculated summary |
| 4 | P&L | Snapshot | 76 | 3 | Single period | 0 | 0 | NO - single-period snapshot |
| 5 | P&L Monthly | Standard | 103 | 12 | Jul 2024 - Jun 2025 | 0 | 0 | NO - monthly (not weekly), different FY |
| 6 | Finance This Week | Snapshot | 104 | 10 | Single week snapshot | 0 | 0 | YES - cash_position_weekly (single week only) |
| 7 | Weekly Revenue Report | Standard | 63 | 34 | 2025-07-05 to 2026-01-24 (30 rows) | 0 | 1 | YES - revenue_weekly breakdown |
| 8 | Sales Weekly | Transposed | 158 | 55 | 2024-07-06 to 2025-06-29 (FY24-25!) | 202 | 211 | PARTIAL - different FY, regional sales |
| 9 | Marketing Weekly APP | Transposed | 77 | 54 | 2025-07-06 to 2026-06-28 | 0 | 5 | YES - marketing metrics (Approvable brand) |
| 10 | Marketing Weekly BA | Transposed | 79 | 54 | 2025-07-06 to 2026-06-28 | 0 | 2 | YES - marketing metrics (Buildable brand) |
| 11 | Operations Weekly | Transposed | 68 | 54 | 2024-07-07 to 2025-06-29 (FY24-25!) | 0 | 0 | NO - different FY (prior year) |
| 12 | Productivity | Transposed | 106 | 55 | 2025-07-06 to 2025-06-29 | 0 | 468 | YES - staff_productivity_weekly |
| 13 | Assessment | Pivot table | 79 | 30 | Week numbers only | 0 | 0 | NO - pivot summary, no dates |
| 14 | Inspection | Pivot table | 37 | 31 | Week numbers only | 0 | 0 | NO - pivot summary, no dates |
| 15 | Sign Off | Pivot table | 49 | 30 | Week numbers only | 0 | 0 | NO - pivot summary, no dates |
| 16 | Phone (2) | Transposed | 56 | 53 | 2025-07-06 to 2026-06-28 | 1 | 0 | YES - phone metrics (simplified) |
| 17 | Phone | Transposed | 74 | 56 | 2025-07-06 to 2026-06-28 | 628 | 1 | YES - phone_weekly (detailed) |
| 18 | Phone Team (RG) | Transposed | 63 | 49 | 2025-08-24 to 2026-06-28 | 44 | 4 | NO - partial date range, ring group |
| 19 | Phone Individual (RG) | Transposed | 71 | 49 | 2025-08-24 to 2026-06-28 | 33 | 79 | NO - partial date range, ring group |

### Critical Date Discovery

**Dates in the workbook are Sundays, not Saturdays (except Weekly Revenue Report).**

| Sheet | Day of Week | Example | Action Required |
|-------|-------------|---------|-----------------|
| Weekly Report | Sunday | 2025-07-06 (Sun) | Snap to previous Saturday (2025-07-05) |
| Sales Weekly | Sunday | 2024-07-06 (Sun) | Snap to previous Saturday |
| Marketing Weekly APP/BA | Sunday | 2025-07-06 (Sun) | Snap to previous Saturday |
| Operations Weekly | Sunday | 2024-07-07 (Sun) | Different FY -- skip |
| Productivity | Sunday | 2025-07-06 (Sun) | Snap to previous Saturday |
| Phone/Phone (2) | Sunday | 2025-07-06 (Sun) | Snap to previous Saturday |
| **Weekly Revenue Report** | **Saturday** | 2025-07-05 (Sat) | **Already correct** |

The existing `WeekService.toSaturday()` already handles this -- Sunday is 1 day from Saturday, within the 3-day tolerance.

### Financial Year Mismatch

Two sheets contain **FY2024-25** data (Jul 2024 - Jun 2025), not FY2025-26:
- **Sales Weekly** (rows 5+): 2024-07-06 to 2025-06-29
- **Operations Weekly**: 2024-07-07 to 2025-06-29

The main Weekly Report and all other FY2025-26 sheets have data from 2025-07-06 to 2026-01-25. The Sales Weekly sheet contains regional breakdowns that could populate `sales_regional_weekly`, but it's a prior-year dataset. The planner should decide whether to import FY24-25 data or skip these sheets.

**Recommendation:** Import Sales Weekly regional data as prior-year historical data. Skip Operations Weekly (it duplicates data now in the Productivity sheet for FY25-26). The user can re-run the migration with a newer workbook later.

## Sheet-to-Table Mapping

### Definitive Mapping (IMPORTABLE)

#### Sheet 1: "Weekly Report" --> Multiple Tables

The main transposed sheet maps to 6 database tables:

**financial_weekly** (rows 4-10):
| Row | Label | DB Field | Type |
|-----|-------|----------|------|
| 4 | Total Trading Income | totalTradingIncome | Decimal |
| 5 | Total Cost of Sales | totalCostOfSales | Decimal |
| 6 | Gross Profit | grossProfit | Decimal |
| 7 | Total Other Income | otherIncome | Decimal |
| 8 | Total Operating Expenses | operatingExpenses | Decimal |
| 9 | Wages and Salaries | wagesAndSalaries | Decimal |
| 10 | Net Profit | netProfit | Decimal |

**projects_weekly** (rows 15-32):
| Rows | Project Type | Fields |
|------|-------------|--------|
| 17-21 | residential | hyperfloCount (row 18), xeroInvoicedAmount (row 19), newBusinessPercentage (row 21) |
| 25-28 | commercial | hyperfloCount (row 26), xeroInvoicedAmount (row 27) |
| 29-32 | retrospective | hyperfloCount (row 30), xeroInvoicedAmount (row 31) |

Note: Row 18 "HF Total Projects Residential #" is sometimes a formula, sometimes raw. Row 30 sometimes contains an uncached formula `{formula: "'Sales Weekly'!AF26"}`.

**sales_weekly** (rows 34-51):
| Rows | Sales Type | Fields |
|------|-----------|--------|
| 34-39 | residential | quotesIssuedCount (35), quotesIssuedValue (36), quotesWonCount (37), quotesWonValue (38) |
| 40-45 | commercial | quotesIssuedCount (41), quotesIssuedValue (42), quotesWonCount (43), quotesWonValue (44) |
| 46-51 | retrospective | quotesIssuedCount (47), quotesIssuedValue (48), quotesWonCount (49), quotesWonValue (50) |

**WARNING:** Retrospective sales rows (47-50) are **uncached cross-sheet formulas** referencing `'Sales Weekly'!CXX`. These will have no cached result in ExcelJS. Must set to 0 and log warning.

**leads_weekly** (rows 55-66):
| Row | Label | Lead Source | Fields |
|-----|-------|-------------|--------|
| 55 | Google Lead # | google | leadCount |
| 56 | Google - Ave Cost per Lead $ | google | costPerLead |
| 57 | SEO Lead # | seo | leadCount |
| 58 | SEO Average Cost Per Lead | seo | costPerLead |
| 59 | Meta Lead # (reportei) | meta | leadCount |
| 60 | Meta Ave Cost Per Lead | meta | costPerLead |
| 61 | Bing Lead # (reportei) | bing | leadCount |
| 62 | Bing Ave Cost Per Lead | bing | costPerLead |
| 63 | TikTok # (reportei) | tiktok | leadCount |
| 64 | TikTok Ave Cost Per Lead | tiktok | costPerLead |
| 65 | Other Leads # | other | leadCount |
| 66 | Other Ave Cost Per Lead | other | costPerLead |
| 67 | Total Lead # | (derived) | SKIP - calculated total |
| 68 | Total Cost $ | (derived) | SKIP - use for totalCost per source |

**google_reviews_weekly** (row 70):
| Row | Label | DB Field | Note |
|-----|-------|----------|------|
| 70 | Google Review | reviewCount | Single count per week. No rating data in workbook. |

**team_performance_weekly** (rows 73-108):
| Rows | Region | DB Field |
|------|--------|----------|
| 73-75 | cairns | target (73), actualInvoiced (74) |
| 76-78 | mackay | target (76), actualInvoiced (77) |
| 79-81 | nq_commercial | target (79), actualInvoiced (80) |
| 82-84 | seq_residential | target (82), actualInvoiced (83) |
| 85-87 | seq_commercial | target (85), actualInvoiced (86) |
| 88-90 | town_planning | target (88), actualInvoiced (89) |
| 91-93 | townsville | target (91), actualInvoiced (92) |
| 94-96 | wide_bay | target (94), actualInvoiced (95) |
| 97-99 | all_in_access | target (97), actualInvoiced (98) |

Note: Row 95 (Wide Bay Team $) has a hyperlink cell (`{text: "Wide Bay Team $ (Xero)", hyperlink: "mailto:SEQ@..."}`). Must extract `.text` or use label from row mapping.

Rows 100-108 (Approvable Retro, Toowoomba, SEQ+Wide Bay Combined) are **supplementary aggregations** that don't match the 9 standard regions. Skip these.

#### Sheet 6: "Finance This Week" --> cash_position_weekly (SINGLE WEEK)

This sheet is a narrative email-format report for the **most recent week only**. It contains:

| Row | Label | DB Field | Value |
|-----|-------|----------|-------|
| 8 | ANZ Everyday | (part of everydayAccount aggregate) | 351,648.96 |
| 10 | NAB Everyday | (part of everydayAccount aggregate) | 319,010.38 |
| 11 | NAB Tax Account | taxSavings | 1,081,212.05 |
| 12 | Profit Savings Account | capitalAccount | 45,559.81 |
| 17 | CC Debt/Credit - ANZ | creditCards | 8,586.70 |
| 18 | Total Cash Avail | totalCashAvailable | 1,952,745.96 |
| 22 (col A) | Total Owing | totalReceivables | 840,838.69 |
| 22 (col B) | Current | currentReceivables | 555,737.18 |
| 22 (col C) | 30+ | over30Days | 137,527.69 |
| 22 (col D) | 60+ | over60Days | 78,875.70 |
| 22 (col E) | 90+ | over90Days | 68,698.12 |
| 25 | Total AP's | totalPayables | 643,578.00 |

**This yields only 1 row for cash_position_weekly**, not 30. The workbook does not contain historical bank balances.

**Recommendation:** Import this single week. For future workbook versions, check if this sheet's data changes.

#### Sheet 7: "Weekly Revenue Report" --> revenue_weekly

Standard table layout (not transposed). 30 rows of data with Saturday dates. Maps to `revenue_weekly` with category breakdown.

| Column | Header | Revenue Category Mapping |
|--------|--------|------------------------|
| 2 | Resi Class 1 A | class_1a |
| 3 | Resi Class 10a | class_10a_sheds |
| 4 | Resi Class 10b | class_10b_pools |
| 5 | Resi Inspections | inspections |
| 6 | Resi Retro/Sundry AR | retrospective |
| 7 | Resi Class2-9 | class_2_9_commercial |
| 8 | Resi Planning 1&10 | planning_1_10 |
| 10 | Retro Retro | retrospective (already mapped) |
| 18 | Com- Class 2-9 | class_2_9_commercial (already mapped) |
| 28 | Com AIA | access_labour_hire |

**Note:** Multiple columns map to the same RevenueCategory. The revenue_weekly table has a unique constraint on `[weekEnding, category]`. The migration should **aggregate** columns that share the same category, or import with the most specific category interpretation. This needs careful mapping -- see Open Questions.

#### Sheet 12: "Productivity" --> staff_productivity_weekly

Transposed layout. Row structure: groups of 3 rows per person (approvals #, revenue $, inspections #).

| Pattern | Row Label Example | DB Field |
|---------|------------------|----------|
| Name # | "Beatrix King #" | jobsCompleted |
| Name $ | "Beatrix King $" | revenueGenerated |
| Name Inspections | "Beatrix King Inspections" | inspectionsCompleted |

Column B contains the clean staff name (e.g., "Beatrix King"). Column A has the display label.
Column C contains "Average" header (skip). Data starts at column D (first week date in row 3).

Staff are grouped by section:
- Row 4: "Certifiers (sign off user)" -> role: certifier
- Later section: "Cadets" -> role: cadet

#### Sheet 16: "Phone (2)" or Sheet 17: "Phone" --> phone_weekly

Both contain phone metrics in transposed layout. Phone (2) is simpler; Phone has more detail but 628 formula errors.

**Recommendation:** Use Phone (2) for import -- fewer errors, simpler structure. Phone (2) row structure: staff name rows with inbound/outbound/missed call data by week.

### Sheets to SKIP

| Sheet | Reason |
|-------|--------|
| Monthly | Quarterly summary aggregation -- calculated, not source data |
| P&L | Single-period snapshot, not weekly |
| P&L Monthly | Monthly granularity, different FY (2024-25) |
| Operations Weekly | FY2024-25 data (prior year), superseded by Productivity sheet |
| Assessment | Pivot table with week numbers only, no dates |
| Inspection | Pivot table summary, no dates |
| Sign Off | Pivot table summary, no dates |
| Phone Team (RG) | Partial date range (starts week 8), ring group aggregates |
| Phone Individual (RG) | Partial date range (starts week 8), ring group detail |

## Architecture Patterns

### Recommended Project Structure
```
server/src/
  services/
    ExcelMigrationService.ts    # Main orchestrator
    ExcelParserService.ts       # Low-level cell extraction + error handling
    SheetParsers/
      WeeklyReportParser.ts     # Sheet 1 -> financial, projects, sales, leads, reviews, teams
      RevenueReportParser.ts    # Sheet 7 -> revenue_weekly
      FinanceThisWeekParser.ts  # Sheet 6 -> cash_position_weekly (single week)
      ProductivityParser.ts     # Sheet 12 -> staff_productivity_weekly
      PhoneParser.ts            # Sheet 16 -> phone_weekly
      MarketingParser.ts        # Sheets 9+10 -> marketing_performance_weekly
  routes/
    migration.ts                # API endpoints: upload, dry-run, import, progress SSE
client/src/
  components/
    migration/
      ExcelMigration.tsx        # Two-step wizard container
      MigrationUpload.tsx       # Step 1: Upload + dry-run preview
      MigrationProgress.tsx     # Step 2: Real-time progress + results
      MigrationReport.tsx       # Summary report display
```

### Pattern 1: Cell Value Extraction
**What:** Safely extract the actual value from any ExcelJS cell, handling all object types.
**When to use:** Every cell read operation.
**Example:**
```typescript
// Source: Verified against actual workbook analysis
function extractCellValue(cell: ExcelJS.Cell): number | string | Date | null {
  const val = cell.value;
  if (val === null || val === undefined) return null;

  // Plain values
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return val.trim();
  if (val instanceof Date) return val;

  // Object types
  if (typeof val === 'object') {
    // Formula error: { error: '#DIV/0!' }
    if ('error' in val) return 0; // Decision: errors -> 0, log warning

    // Formula with cached result: { formula: '...', result: ... }
    if ('result' in val) {
      const result = val.result;
      if (result === null || result === undefined) return null;
      if (typeof result === 'object' && 'error' in result) return 0; // Error in result
      if (result instanceof Date) return result;
      return result;
    }

    // Formula without cached result: { formula: '...' } (no result key)
    if ('formula' in val && !('result' in val)) return 0; // Uncached -> 0, log warning

    // Rich text: { richText: [{text: '...'}] }
    if ('richText' in val) {
      return (val as any).richText.map((rt: any) => rt.text).join('').trim();
    }

    // Hyperlink: { text: '...', hyperlink: '...' }
    if ('text' in val) return (val as any).text.trim();
  }

  return String(val).trim();
}
```

### Pattern 2: Transposed Sheet Parsing
**What:** Read a transposed sheet where dates are in a header row and metrics are row labels.
**When to use:** Most sheets in this workbook.
**Example:**
```typescript
// Source: Derived from workbook analysis
interface TransposedConfig {
  dateRow: number;         // Row containing week dates (e.g., 3)
  startCol: number;        // First data column (e.g., 3, skipping label + total cols)
  labelCol: number;        // Column containing row labels (e.g., 1)
  rowMappings: Array<{
    row: number;
    label: string;         // Expected label (for validation)
    dbField: string;
    type: 'currency' | 'integer' | 'decimal' | 'percentage';
  }>;
}

function parseTransposedSheet(
  ws: ExcelJS.Worksheet,
  config: TransposedConfig
): { weekDate: Date; values: Record<string, number | null> }[] {
  const results: { weekDate: Date; values: Record<string, number | null> }[] = [];
  const dateRow = ws.getRow(config.dateRow);

  for (let c = config.startCol; c <= ws.columnCount; c++) {
    const dateVal = extractCellValue(dateRow.getCell(c));
    if (!(dateVal instanceof Date)) continue;

    // Snap to Saturday
    const saturday = WeekService.toSaturday(dateVal);

    const values: Record<string, number | null> = {};
    for (const mapping of config.rowMappings) {
      const cellVal = extractCellValue(ws.getRow(mapping.row).getCell(c));
      if (cellVal === null) {
        values[mapping.dbField] = null;
      } else if (typeof cellVal === 'number') {
        values[mapping.dbField] = cellVal;
      } else {
        values[mapping.dbField] = parseFloat(String(cellVal)) || 0;
      }
    }

    // Skip columns where ALL values are null (future weeks)
    if (Object.values(values).every(v => v === null)) continue;

    results.push({ weekDate: saturday, values });
  }

  return results;
}
```

### Pattern 3: SSE Progress Streaming
**What:** Stream real-time progress to the client during import.
**When to use:** During the import phase (Step 2).
**Example:**
```typescript
// Source: Express native SSE + MDN EventSource spec
// Server-side (Express route)
router.get('/migration/progress/:jobId', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Register this connection for the job
  const jobId = req.params.jobId;
  progressEmitter.on(jobId, sendEvent);

  req.on('close', () => {
    progressEmitter.off(jobId, sendEvent);
  });
});

// Client-side (React)
function useMigrationProgress(jobId: string | null) {
  const [progress, setProgress] = useState<MigrationProgress | null>(null);

  useEffect(() => {
    if (!jobId) return;
    const source = new EventSource(`/api/v1/migration/progress/${jobId}`);
    source.onmessage = (e) => setProgress(JSON.parse(e.data));
    source.onerror = () => source.close();
    return () => source.close();
  }, [jobId]);

  return progress;
}
```

### Pattern 4: Idempotent Upsert
**What:** Use Prisma upsert with unique constraints for re-runnable imports.
**When to use:** All database writes during migration.
**Example:**
```typescript
// Source: Prisma documentation + existing ImportService pattern
await prisma.financialWeekly.upsert({
  where: { weekEnding: saturday },
  update: {
    totalTradingIncome: values.totalTradingIncome,
    // ... all fields
    dataSource: 'backfilled',
  },
  create: {
    weekEnding: saturday,
    totalTradingIncome: values.totalTradingIncome,
    // ... all fields
    dataSource: 'backfilled',
  },
});
```

### Anti-Patterns to Avoid
- **Don't read cell.text or cell.toString():** These lose formula error information. Always read `cell.value` and handle the object types.
- **Don't assume all cells are numbers:** Even numeric cells can be formula objects, error objects, hyperlinks, or richtext.
- **Don't parse all 52 columns:** Check for null/empty data columns. The workbook has 52 template columns but only 30 have data.
- **Don't import "Total" columns:** Column B in transposed sheets is typically a sum/total column. Skip it.
- **Don't attempt formula evaluation:** ExcelJS does not evaluate formulas. Uncached cross-sheet references will have no result. Accept 0 + warning.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sunday-to-Saturday date snapping | Custom date math | `WeekService.toSaturday()` | Already exists, handles edge cases, has 3-day tolerance |
| Database upsert logic | Manual find + insert/update | Prisma `upsert()` | Atomic, handles race conditions, uses unique constraints |
| File upload handling | Manual multipart parsing | `multer` (existing) | Already configured in uploads route, just extend file filter for .xlsx |
| Progress event system | Custom WebSocket server | Native SSE with `EventEmitter` | SSE is simpler, auto-reconnects, no library needed |
| Cell value extraction | Per-cell type checking inline | Shared `extractCellValue()` utility | 7+ cell value types in this workbook; centralise once |

**Key insight:** The existing CSV import infrastructure (`ImportService`, `CsvParserService`, `DataTypeRegistry`) is designed for CSV files with standard row-per-record layout. The Excel migration needs a parallel but separate parsing pipeline because the transposed layout requires column-iteration (weeks) with row-based field mapping. The existing import service's `importRows()` function and upsert logic can potentially be reused, but the parsing layer must be entirely new.

## Common Pitfalls

### Pitfall 1: Uncached Formula References
**What goes wrong:** Cross-sheet formula cells like `{formula: "'Sales Weekly'!C44"}` have no `.result` property. Code that accesses `.result` gets `undefined`, which could silently produce null values in the database.
**Why it happens:** ExcelJS reads the formula text but cannot evaluate it. If Excel didn't cache the result before saving, ExcelJS cannot provide it.
**How to avoid:** Check for `'formula' in val && !('result' in val)` explicitly. Set to 0, log a warning with the cell reference and formula text.
**Warning signs:** 168 uncached formulas in Weekly Report, 468 in Productivity, 211 in Sales Weekly. These are concentrated in specific rows (retrospective sales, staff productivity).

### Pitfall 2: Hyperlink and RichText Cell Labels
**What goes wrong:** Row 95 (Wide Bay Team $ label) is a hyperlink object `{text: "Wide Bay Team $ (Xero)", hyperlink: "mailto:SEQ@..."}`. Code that does `String(cell.value)` gets `[object Object]`.
**Why it happens:** Someone accidentally created a hyperlink in a label cell.
**How to avoid:** The `extractCellValue()` utility handles all object types. Never use `String(cell.value)` directly.
**Warning signs:** Any `[object Object]` in console output when logging cell values.

### Pitfall 3: Date Column Off-by-One
**What goes wrong:** Importing Sunday dates as-is creates records that don't align with the rest of the system (which uses Saturdays).
**Why it happens:** The workbook consistently uses Sunday dates (except Revenue Report which uses Saturday).
**How to avoid:** Always pass dates through `WeekService.toSaturday()`. Add validation that confirms every imported date is a Saturday.
**Warning signs:** Dates ending in Sunday in the database.

### Pitfall 4: Empty Future Week Columns
**What goes wrong:** Importing 52 columns of data when only 30 have values, creating 22 rows of all-null data per table.
**Why it happens:** The workbook template has columns for the entire financial year.
**How to avoid:** Check if ALL data values in a column are null/0 before creating a record. Skip empty columns.
**Warning signs:** Row counts much higher than expected (e.g., 52 instead of 30).

### Pitfall 5: Finance This Week is Not a Time Series
**What goes wrong:** Treating the "Finance This Week" sheet as a weekly time series, expecting 30 rows of cash position data.
**Why it happens:** The sheet name suggests weekly data, but it's actually a narrative email snapshot for one week only.
**How to avoid:** Parse this sheet for a single `cash_position_weekly` record. Accept that historical bank balances are not available.
**Warning signs:** Only getting 1 row from the cash position import.

### Pitfall 6: Multer File Size and MIME Type
**What goes wrong:** Upload rejected because multer is configured for CSV only (10MB, text/csv).
**Why it happens:** Existing upload route only allows .csv/.tsv files.
**How to avoid:** Create a separate multer config for the migration route that accepts .xlsx files up to 10MB.
**Warning signs:** "Only .csv and .tsv files are accepted" error.

## Code Examples

### Cell Value Extraction (complete implementation)
```typescript
// Source: Verified against actual "Weekly Report - 30.xlsx" cell types
import type { CellValue } from 'exceljs';

interface CellExtraction {
  value: number | string | Date | null;
  warning?: string;
}

function extractCell(cellValue: CellValue, ref: string): CellExtraction {
  if (cellValue === null || cellValue === undefined) {
    return { value: null };
  }

  if (typeof cellValue === 'number') return { value: cellValue };
  if (typeof cellValue === 'string') return { value: cellValue.trim() };
  if (typeof cellValue === 'boolean') return { value: cellValue ? 1 : 0 };
  if (cellValue instanceof Date) return { value: cellValue };

  if (typeof cellValue === 'object') {
    // Error value: { error: '#DIV/0!' }
    if ('error' in cellValue) {
      return {
        value: 0,
        warning: `${ref}: Formula error ${(cellValue as any).error}, set to 0`,
      };
    }

    // Formula with result
    if ('result' in cellValue) {
      const result = (cellValue as any).result;
      if (result === null || result === undefined) {
        return { value: null };
      }
      if (typeof result === 'object' && 'error' in result) {
        return {
          value: 0,
          warning: `${ref}: Formula result error ${result.error}, set to 0`,
        };
      }
      if (result instanceof Date) return { value: result };
      if (typeof result === 'number') return { value: result };
      return { value: String(result).trim() };
    }

    // Uncached formula (cross-sheet reference without cached result)
    if ('formula' in cellValue && !('result' in cellValue)) {
      return {
        value: 0,
        warning: `${ref}: Uncached formula "${(cellValue as any).formula}", set to 0`,
      };
    }

    // Rich text
    if ('richText' in cellValue) {
      const text = (cellValue as any).richText
        .map((rt: any) => rt.text)
        .join('')
        .trim();
      return { value: text };
    }

    // Hyperlink
    if ('text' in cellValue) {
      return { value: (cellValue as any).text.trim() };
    }
  }

  return { value: String(cellValue).trim() };
}
```

### Idempotent Batch Upsert Pattern
```typescript
// Source: Prisma upsert + existing unique constraints in schema
async function upsertFinancialWeekly(
  records: Array<{weekDate: Date; values: Record<string, number | null>}>,
  onProgress: (count: number, total: number) => void,
): Promise<{inserted: number; updated: number; warnings: string[]}> {
  let inserted = 0, updated = 0;
  const warnings: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const { weekDate, values } = records[i];
    const existing = await prisma.financialWeekly.findUnique({
      where: { weekEnding: weekDate },
    });

    await prisma.financialWeekly.upsert({
      where: { weekEnding: weekDate },
      update: {
        totalTradingIncome: values.totalTradingIncome ?? 0,
        totalCostOfSales: values.totalCostOfSales ?? 0,
        grossProfit: values.grossProfit ?? 0,
        otherIncome: values.otherIncome ?? 0,
        operatingExpenses: values.operatingExpenses ?? 0,
        wagesAndSalaries: values.wagesAndSalaries ?? 0,
        netProfit: values.netProfit ?? 0,
        dataSource: 'backfilled',
      },
      create: {
        weekEnding: weekDate,
        totalTradingIncome: values.totalTradingIncome ?? 0,
        totalCostOfSales: values.totalCostOfSales ?? 0,
        grossProfit: values.grossProfit ?? 0,
        otherIncome: values.otherIncome ?? 0,
        operatingExpenses: values.operatingExpenses ?? 0,
        wagesAndSalaries: values.wagesAndSalaries ?? 0,
        netProfit: values.netProfit ?? 0,
        dataSource: 'backfilled',
      },
    });

    if (existing) updated++; else inserted++;
    onProgress(i + 1, records.length);
  }

  return { inserted, updated, warnings };
}
```

### SSE Progress Implementation
```typescript
// Source: Express native SSE (no library needed)
import { EventEmitter } from 'events';

const migrationEmitter = new EventEmitter();
migrationEmitter.setMaxListeners(20);

interface ProgressEvent {
  phase: string;          // 'parsing' | 'importing' | 'complete' | 'error'
  sheet?: string;         // Current sheet being processed
  table?: string;         // Current target table
  current: number;        // Records processed so far
  total: number;          // Total records to process
  warnings: number;       // Warning count
  message: string;        // Human-readable status
}

// Emit from migration service:
function emitProgress(jobId: string, event: ProgressEvent) {
  migrationEmitter.emit(jobId, event);
}

// SSE endpoint:
router.get('/progress/:jobId', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering if applicable
  });
  res.flushHeaders();

  const handler = (data: ProgressEvent) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (data.phase === 'complete' || data.phase === 'error') {
      setTimeout(() => res.end(), 100);
    }
  };

  migrationEmitter.on(req.params.jobId, handler);
  req.on('close', () => migrationEmitter.off(req.params.jobId, handler));
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SheetJS (xlsx) community edition | ExcelJS for full cell metadata | Ongoing | ExcelJS has better TypeScript support, exposes formula errors directly |
| WebSocket for progress | SSE for unidirectional progress | Mature pattern | SSE is simpler, auto-reconnects, works through proxies |
| Manual SQL for upserts | Prisma upsert with unique constraints | Prisma 4+ | Atomic operations, type-safe, handles race conditions |

**Deprecated/outdated:**
- SheetJS Pro (paid) has better features but ExcelJS is sufficient for this use case
- `node-xlsx` package is unmaintained

## Open Questions

1. **Revenue category mapping ambiguity**
   - What we know: The Weekly Revenue Report has 28 revenue columns (Resi Class 1A, Retro Retro, Com Class 2-9, etc.) but the database has 14 `RevenueCategory` enum values.
   - What's unclear: Several workbook columns may map to the same category (e.g., "Retro Retro" and "Resi Retro/Sundry AR" both relate to retrospective). Some categories like `qleave`, `sundry`, and `insurance_levy` don't appear in the workbook.
   - Recommendation: Create a static mapping table. Where workbook columns don't cleanly map to a single category, choose the best fit. Revenue Report columns 9 (Resi Total), 17 (Retro Total), 29 (Com Total), 30 (Buildable Total) are calculated totals -- skip these. Import the granular columns.

2. **FY2024-25 data from Sales Weekly sheet**
   - What we know: Sales Weekly contains FY2024-25 regional sales data (Jul 2024 - Jun 2025) with regional breakdowns (Cairns, Mackay, NQ Commercial, SEQ, etc.)
   - What's unclear: Should prior-year data be imported? The phase spec says "30 weeks Jul 2024 - Jan 2025" but the main sheet contains FY2025-26 data.
   - Recommendation: Import it as historical context. The dashboard's 13-week rolling window won't show it, but yearly comparisons need it. Mark with `data_source: 'backfilled'`.

3. **Marketing data: two brand sheets**
   - What we know: Marketing Weekly APP (Approvable) and Marketing Weekly BA (Buildable) have similar structures but different data.
   - What's unclear: Should they be combined into a single `marketing_performance_weekly` record per week, or kept separate? The database table has a `platform` key (google_ads, meta_ads, etc.) but no "brand" dimension.
   - Recommendation: Combine them. Sum the metrics from both brands per platform per week. Or pick BA (Buildable) as the primary and skip APP. This should be clarified with the user before implementation.

4. **Leads data: Weekly Report vs Marketing sheets**
   - What we know: Leads data appears in both the Weekly Report (rows 55-66) and the Weekly Approvable sheet (rows 40-50). The Weekly Report leads appear to be for the Buildable brand.
   - What's unclear: Whether the leads in Weekly Report are for all brands or just Buildable, and whether Approvable leads should also be imported.
   - Recommendation: Import leads from the Weekly Report (rows 55-66) only. This matches the main dashboard's expectations.

5. **Total Cost calculation for leads**
   - What we know: Row 68 "Total Cost $" in Weekly Report gives total marketing spend per week. Individual lead sources have costPerLead but not totalCost.
   - What's unclear: Whether to compute `totalCost = leadCount * costPerLead` per source, or import total cost from row 68 and distribute.
   - Recommendation: Calculate `totalCost = leadCount * costPerLead` per source. This matches the database schema which has `totalCost` per lead source.

## Sources

### Primary (HIGH confidence)
- `/exceljs/exceljs` (Context7) - Cell value types, merged cells, error values, formula handling
- Direct workbook analysis - All 19 sheets examined programmatically with actual data validation
- Existing codebase analysis - Prisma schema, ImportService, CsvParserService, DataTypeRegistry, WeekService

### Secondary (MEDIUM confidence)
- [MDN EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) - SSE client API
- [Express SSE pattern](https://masteringjs.io/tutorials/express/server-sent-events) - Native SSE implementation
- [better-sse](https://github.com/MatthewWid/better-sse) - TypeScript SSE library (not recommended, native is sufficient)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - ExcelJS verified against actual workbook, all other libraries already in project
- Architecture: HIGH - Patterns derived from actual workbook structure analysis and existing codebase conventions
- Pitfalls: HIGH - All pitfalls discovered through direct workbook examination (not theoretical)
- Sheet mapping: HIGH - Every row/column verified against actual cell values
- Open questions: MEDIUM - Revenue category mapping needs user confirmation

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable -- workbook structure won't change)
