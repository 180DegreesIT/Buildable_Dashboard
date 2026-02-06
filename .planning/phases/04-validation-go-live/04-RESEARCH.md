# Phase 4: Validation & Go-Live - Research

**Researched:** 2026-02-06
**Domain:** Data validation testing, performance benchmarking, ExcelJS reference extraction, Puppeteer page timing
**Confidence:** HIGH

## Summary

Phase 4 is a verification/testing phase -- no new features are built. The goal is to confirm that migrated Excel data matches known reference values exactly, that CSV round-trip integrity holds, and that all dashboard pages meet the 2-second warm load target.

The project already has all the infrastructure needed. ExcelJS (v4.4.0) is installed and battle-tested by 6 sheet parsers in Phase 2. Puppeteer (v24.37.1) is installed and working for PDF export in Phase 3. The validation phase reuses both: ExcelJS to extract reference values from the original workbook into a JSON fixture file, and Puppeteer to automate performance measurement across all dashboard pages.

The validation system consists of three components: (1) a reference value extractor script that reads the Excel workbook and outputs a JSON file with expected values per checkpoint week, (2) a validation runner that queries the API endpoints and compares database values against the reference JSON, and (3) a performance benchmarker that uses Puppeteer to measure full page render times. All three output to terminal AND to a dashboard-visible results panel.

**Primary recommendation:** Build a server-side validation script (`server/src/services/ValidationService.ts`) that queries the same API endpoints the dashboard uses, compares against a JSON reference file, and outputs structured results. Reuse the existing Puppeteer launch infrastructure from `PdfExportService.ts` for performance measurement.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ExcelJS | 4.4.0 | Extract reference values from original workbook | Already installed, 6 parsers battle-tested |
| Puppeteer | 24.37.1 | Automated performance measurement | Already installed, PDF export working |
| Node.js fetch/http | built-in | Query API endpoints for data comparison | No additional deps needed |
| Prisma | 6.3.0 | Direct DB queries for validation | Already configured with all table models |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Express | 4.21.2 | Expose validation API route for dashboard display | Already the server framework |
| Zod | 3.24.1 | Validate reference JSON structure | Already installed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom validation runner | Jest/Vitest test framework | Testing framework adds overhead, not needed for one-time go-live check; custom script gives better terminal+dashboard output control |
| API endpoint comparison | Direct Prisma queries | API comparison tests the full stack (service layer, computed fields, JSON serialisation); direct DB only tests raw data |
| Puppeteer performance | Lighthouse CI | Lighthouse measures synthetic scores, not actual warm-load render time; Puppeteer gives precise timing via Performance API |

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
server/src/
├── services/
│   ├── ValidationService.ts      # Core validation logic
│   └── PerformanceBenchmark.ts   # Puppeteer timing measurement
├── routes/
│   └── validation.ts             # API route for dashboard display
├── scripts/
│   └── extract-reference.ts      # One-time: Excel → JSON extractor
└── data/
    └── reference-values.json     # Extracted expected values (checked in)

client/src/
├── components/
│   └── admin/
│       └── ValidationPanel.tsx   # Dashboard display of results
└── lib/
    └── validationApi.ts          # API client for validation endpoint
```

### Pattern 1: Reference Value JSON Structure
**What:** A typed JSON file storing expected values per checkpoint week, organised by table/domain
**When to use:** Always -- this is the single source of truth for validation
**Example:**
```typescript
// Source: Project-specific pattern
interface ReferenceData {
  extractedFrom: string;           // e.g. "Buildable_Weekly_Report.xlsx"
  extractedAt: string;             // ISO timestamp
  checkpointWeeks: string[];       // e.g. ["2025-07-12", "2025-09-13", "2025-11-15", "2025-01-25"]
  financial: Record<string, {      // keyed by week_ending ISO string
    totalTradingIncome: number;
    totalCostOfSales: number;
    grossProfit: number;
    otherIncome: number;
    operatingExpenses: number;
    wagesAndSalaries: number;
    netProfit: number;
  }>;
  teamPerformance: Record<string, Record<string, number>>;  // week -> region -> actualInvoiced
  leads: Record<string, Record<string, number>>;             // week -> source -> leadCount
  projects: Record<string, Record<string, {                  // week -> projectType -> values
    hyperfloCount: number;
    xeroInvoicedAmount: number;
  }>>;
  googleReviews: Record<string, { reviewCount: number }>;
  cashPosition: Record<string, Record<string, number | null>>;
  revenue: Record<string, Record<string, number>>;           // week -> category -> amount
}
```

### Pattern 2: Comparison Result Structure
**What:** Typed result objects for each validation check, supporting the "47/50 checks passed" summary
**When to use:** Both terminal and dashboard display consume this structure
**Example:**
```typescript
// Source: Project-specific pattern
interface ValidationCheck {
  id: string;                        // e.g. "financial.week30.netProfit"
  category: string;                  // e.g. "Financial"
  weekEnding: string;                // e.g. "2025-01-25"
  field: string;                     // e.g. "Net Profit"
  expected: number | string;
  actual: number | string | null;
  passed: boolean;
  difference?: number;               // For currency: actual - expected
  differenceLabel?: string;          // e.g. "-$12.15"
}

interface ValidationResult {
  runAt: string;
  totalChecks: number;
  passed: number;
  failed: number;
  checks: ValidationCheck[];
  performance: PerformanceResult[];
}
```

### Pattern 3: API-Level Comparison (Not Raw DB)
**What:** Validate by calling the same API endpoints the dashboard uses, not querying the database directly
**When to use:** Always -- this tests the full stack including FinancialService.computeDerivedMetrics(), TargetService resolution, and JSON serialisation
**Why:** The dashboard shows computed values (gross profit margin, revenue to staff ratio, team % to target). If the API computes these wrong, raw DB validation would miss it.
**Example:**
```typescript
// Source: Existing API pattern from dashboardApi.ts
async function getExecutiveSummaryForWeek(weekEnding: string) {
  const res = await fetch(`http://localhost:6001/api/v1/dashboard/executive-summary?weekEnding=${weekEnding}`);
  return res.json();
}

// Compare: API response kpis.netProfit.actual vs reference.financial[weekEnding].netProfit
```

### Pattern 4: Puppeteer Performance Measurement
**What:** Use Puppeteer to navigate to each dashboard page, wait for `[data-print-ready]` or equivalent render signal, and measure elapsed time
**When to use:** Performance benchmarking across all dashboard pages
**Example:**
```typescript
// Source: Puppeteer docs (Page.metrics + Performance API) + existing PdfExportService pattern
async function measurePageLoad(pageUrl: string): Promise<number> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    ...(process.env.PUPPETEER_EXECUTABLE_PATH
      ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
      : {}),
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Navigate and measure
  const startTime = Date.now();
  await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 30_000 });

  // Wait for data-print-ready or a custom data-loaded attribute
  await page.waitForSelector('[data-loaded="true"]', { timeout: 15_000 });
  const loadTime = Date.now() - startTime;

  // Also get Performance API timing from the browser
  const perfTiming = await page.evaluate(() => {
    const perf = window.performance.timing;
    return {
      domContentLoaded: perf.domContentLoadedEventEnd - perf.navigationStart,
      fullLoad: perf.loadEventEnd - perf.navigationStart,
    };
  });

  await browser.close();
  return loadTime;
}
```

### Pattern 5: Dual Output (Terminal + Dashboard)
**What:** Validation results are both printed to terminal AND available via an API endpoint for dashboard display
**When to use:** Required by CONTEXT.md decisions
**Example:**
```typescript
// Terminal output
function printResults(result: ValidationResult) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  VALIDATION RESULTS: ${result.passed}/${result.totalChecks} checks passed`);
  console.log(`${'='.repeat(60)}\n`);

  for (const check of result.checks) {
    const icon = check.passed ? 'PASS' : 'FAIL';
    const label = `[${icon}] ${check.category} > ${check.field} (${check.weekEnding})`;
    if (check.passed) {
      console.log(`  ${label}: ${check.actual}`);
    } else {
      console.log(`  ${label}`);
      console.log(`         Expected: ${check.expected}`);
      console.log(`         Actual:   ${check.actual}`);
      console.log(`         Diff:     ${check.differenceLabel}`);
    }
  }
}

// API route stores last result in memory for dashboard
let lastResult: ValidationResult | null = null;

router.post('/run', async (req, res) => {
  lastResult = await runValidation();
  printResults(lastResult);
  res.json(lastResult);
});

router.get('/results', (req, res) => {
  res.json(lastResult ?? { message: 'No validation has been run yet' });
});
```

### Anti-Patterns to Avoid
- **Hard-coding reference values in the script:** Store in JSON file instead. The CONTEXT.md explicitly requires "reference values stored in a separate JSON data file (not hard-coded in script)."
- **Testing only Week 30:** CONTEXT.md requires 3-4 checkpoint weeks across the full range (early, middle, late). Pick 4 representative weeks.
- **Comparing floating-point with strict equality:** Use exact-to-the-cent comparison for currency (compare rounded to 2 decimal places). The reference JSON should store values already rounded.
- **Only checking database values:** Must validate through the API layer to catch computation bugs in FinancialService, TargetService, etc.
- **Blocking the server during validation:** Run validation asynchronously; return results when complete.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel cell extraction | Custom cell reader | Existing `extractCell()` + `extractNumericValue()` from ExcelParserService | Already handles formula errors, uncached formulas, rich text, hyperlinks |
| Week date snapping | Manual day-of-week logic | `WeekService.toSaturday()` | Already handles <=3 day tolerance, UTC-safe |
| Puppeteer browser launch | Custom browser config | Copy pattern from `PdfExportService.generatePdf()` | Already handles PUPPETEER_EXECUTABLE_PATH, --no-sandbox flags |
| Currency comparison | String/float comparison | Compare `Math.round(val * 100) === Math.round(expected * 100)` | Avoids floating-point precision issues while being exact-to-cent |
| API response parsing | Manual fetch wrapper | Existing server-side `fetch` or direct internal function calls | Server-to-server calls can bypass Express middleware |

**Key insight:** This phase is entirely about reuse. Every building block exists. The validation service is new code, but it composes existing utilities (ExcelJS extraction, Puppeteer launch, API endpoint calls, WeekService).

## Common Pitfalls

### Pitfall 1: Decimal Precision Loss in Prisma/JavaScript
**What goes wrong:** Prisma stores currency as `Decimal(14,2)` but JavaScript converts to IEEE 754 floats during JSON serialisation. `$62,210.45` might appear as `62210.44999999999...` in comparisons.
**Why it happens:** Prisma's `Decimal` type becomes a JavaScript `number` after `Number()` conversion. The dashboard API already does this conversion (e.g. `Number(financial.netProfit)`).
**How to avoid:** Compare by rounding both values to 2 decimal places: `Math.round(actual * 100) === Math.round(expected * 100)`. Alternatively, compare string representations after `toFixed(2)`.
**Warning signs:** Tests that pass with integers but fail with cents.

### Pitfall 2: Week Date Timezone Mismatch
**What goes wrong:** Querying the API with `weekEnding=2025-01-25` might match a different database record if the date is interpreted as local time vs UTC.
**Why it happens:** Prisma `@db.Date` stores dates without time. JavaScript `new Date('2025-01-25')` may interpret as UTC midnight, but depending on server timezone, the date could shift.
**How to avoid:** Always append `T00:00:00` to date strings when constructing Date objects. The existing codebase does this inconsistently -- verify reference dates are Saturdays and match exactly.
**Warning signs:** "No data for this week" responses when data clearly exists.

### Pitfall 3: API Auth Bypass Required for Server-Side Validation
**What goes wrong:** The validation script tries to call `http://localhost:6001/api/v1/dashboard/executive-summary` but gets a 401 because auth middleware is applied.
**Why it happens:** All `/api/v1/` routes go through `authenticate` middleware.
**How to avoid:** Either (a) set `NODE_ENV=development` which auto-authenticates as Super Admin (already implemented in auth middleware), or (b) call internal service functions directly instead of HTTP endpoints. Option (a) is simpler and tests the full stack.
**Warning signs:** 401 responses from validation HTTP calls.

### Pitfall 4: Race Condition Between Validation and Data
**What goes wrong:** Running validation before migration data is fully imported leads to failures.
**Why it happens:** Phase 4 depends on Phase 2 migration data being present. If the database is empty or partially populated, validation fails.
**How to avoid:** Validation script should check for data presence first. If no data exists for the checkpoint weeks, output a clear error: "Migration data not found. Run Excel migration first."
**Warning signs:** All checks failing with "actual: null".

### Pitfall 5: Performance Measurement Including Cold Start
**What goes wrong:** First page load measures 4+ seconds because it includes Vite dev server compilation, browser startup, initial JS bundle download.
**Why it happens:** CONTEXT.md specifies "warm load (subsequent page navigation within the app, not cold first-visit)" but Puppeteer opens a fresh browser each time.
**How to avoid:** Load the app once (navigate to home page, wait for it to render), then navigate to each target page. Measure only the subsequent navigation. This simulates a user already in the app switching pages.
**Warning signs:** Executive Summary consistently measuring 3-5 seconds when the real in-app experience is <1 second.

### Pitfall 6: Stale Reference Values After Re-Migration
**What goes wrong:** If the workbook is re-imported or data is modified, the reference JSON becomes stale.
**Why it happens:** Reference values are extracted once from the Excel file and stored as static JSON.
**How to avoid:** Include a "re-extract" script that regenerates the JSON. Document that this should be run whenever the source workbook changes.
**Warning signs:** Validation failures that were previously passing, especially on fields that are imported correctly.

## Code Examples

Verified patterns from the existing codebase:

### ExcelJS Reference Value Extraction
```typescript
// Source: Based on existing ExcelParserService.ts + WeeklyReportParser.ts patterns
import ExcelJS from 'exceljs';
import { extractNumericValue, cellRef } from '../services/ExcelParserService.js';
import { WeekService } from '../services/WeekService.js';

async function extractReferenceValues(workbookPath: string, checkpointWeeks: string[]) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(workbookPath);

  const ws = wb.getWorksheet('Weekly Report');
  if (!ws) throw new Error('Sheet "Weekly Report" not found');

  const DATE_ROW = 3;
  const START_COL = 3;

  // Build column index: weekDate -> column number
  const weekColumns = new Map<string, number>();
  const dateRow = ws.getRow(DATE_ROW);
  for (let c = START_COL; c <= ws.columnCount; c++) {
    const cell = dateRow.getCell(c);
    const extraction = extractCell(cell.value, cellRef(DATE_ROW, c));
    if (extraction.value instanceof Date) {
      const saturday = WeekService.toSaturday(extraction.value);
      const isoDate = saturday.toISOString().split('T')[0];
      weekColumns.set(isoDate, c);
    }
  }

  // Extract values for each checkpoint week
  const financial: Record<string, any> = {};
  for (const week of checkpointWeeks) {
    const col = weekColumns.get(week);
    if (!col) continue;

    financial[week] = {
      netProfit: extractNumericValue(ws.getRow(10).getCell(col).value, cellRef(10, col)).value,
      totalTradingIncome: extractNumericValue(ws.getRow(4).getCell(col).value, cellRef(4, col)).value,
      // ... etc
    };
  }

  return { financial };
}
```

### API Comparison Pattern
```typescript
// Source: Based on existing dashboard.ts API response structure
async function validateFinancialKPIs(
  weekEnding: string,
  reference: ReferenceData,
): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const apiUrl = `http://localhost:${process.env.PORT || 6001}/api/v1/dashboard/executive-summary?weekEnding=${weekEnding}`;
  const res = await fetch(apiUrl);
  const data = await res.json();

  const expected = reference.financial[weekEnding];
  if (!expected) return checks;

  // Net Profit (exact to cent)
  checks.push({
    id: `financial.${weekEnding}.netProfit`,
    category: 'Financial',
    weekEnding,
    field: 'Net Profit',
    expected: expected.netProfit,
    actual: data.kpis.netProfit.actual,
    passed: centsEqual(data.kpis.netProfit.actual, expected.netProfit),
    difference: data.kpis.netProfit.actual != null
      ? Number((data.kpis.netProfit.actual - expected.netProfit).toFixed(2))
      : null,
    differenceLabel: data.kpis.netProfit.actual != null
      ? `$${(data.kpis.netProfit.actual - expected.netProfit).toFixed(2)}`
      : 'No data',
  });

  return checks;
}

function centsEqual(a: number | null, b: number): boolean {
  if (a === null) return false;
  return Math.round(a * 100) === Math.round(b * 100);
}
```

### Puppeteer Performance Benchmark
```typescript
// Source: Based on existing PdfExportService.ts launch pattern
import puppeteer from 'puppeteer';

interface PerformanceResult {
  page: string;
  url: string;
  loadTimeMs: number;
  passed: boolean;        // < 2000ms
  domNodes: number;
}

async function benchmarkPages(): Promise<PerformanceResult[]> {
  const clientPort = process.env.CLIENT_PORT || '4200';
  const pages = [
    { slug: 'executive_summary', path: '' },  // Home page
    { slug: 'financial', path: '' },
    { slug: 'regional_performance', path: '' },
    { slug: 'target_management', path: '' },
  ];

  const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Warm-up: load the app once
  const baseUrl = `http://localhost:${clientPort}`;
  await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 30_000 });
  await page.waitForSelector('[data-loaded="true"]', { timeout: 15_000 }).catch(() => {});

  const results: PerformanceResult[] = [];

  for (const p of pages) {
    // Navigate via in-app navigation (simulates user clicking sidebar)
    // Use page.evaluate to click the sidebar link
    const startTime = Date.now();

    // Trigger page change via sidebar click or direct navigation
    await page.evaluate((pageId) => {
      // Dispatch navigation event or click sidebar
    }, p.slug);

    // Wait for content to render
    await page.waitForSelector('[data-loaded="true"]', { timeout: 15_000 }).catch(() => {});
    const loadTime = Date.now() - startTime;

    const metrics = await page.metrics();

    results.push({
      page: p.slug,
      url: `${baseUrl} (${p.slug})`,
      loadTimeMs: loadTime,
      passed: loadTime < 2000,
      domNodes: metrics.Nodes ?? 0,
    });
  }

  await browser.close();
  return results;
}
```

### CSV Round-Trip Test
```typescript
// Source: Based on existing CSV export (csvExport.ts) + upload API (uploads.ts)
async function testCsvRoundTrip(weekEnding: string): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];
  const baseUrl = `http://localhost:${process.env.PORT || 6001}/api/v1`;

  // 1. Get original data from API
  const originalRes = await fetch(`${baseUrl}/financial/weekly?weekEnding=${weekEnding}`);
  const original = await originalRes.json();

  // 2. Export as CSV (build CSV string server-side using same format as client)
  const csvContent = buildFinancialCsv(original);

  // 3. Re-import via upload API (parse + apply-mapping + import)
  const formData = new FormData();
  formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'roundtrip-test.csv');
  const parseRes = await fetch(`${baseUrl}/uploads/parse`, { method: 'POST', body: formData });
  const parsed = await parseRes.json();

  // 4. Re-query and compare
  const afterRes = await fetch(`${baseUrl}/financial/weekly?weekEnding=${weekEnding}`);
  const after = await afterRes.json();

  // 5. Compare key fields
  const fieldsToCompare = ['totalTradingIncome', 'netProfit', 'wagesAndSalaries'];
  for (const field of fieldsToCompare) {
    checks.push({
      id: `roundtrip.financial.${field}`,
      category: 'CSV Round-Trip',
      weekEnding,
      field,
      expected: Number(original[field]),
      actual: Number(after[field]),
      passed: centsEqual(Number(after[field]), Number(original[field])),
    });
  }

  return checks;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `performance.timing` (Navigation Timing L1) | `performance.getEntriesByType('navigation')` (L2) | 2023+ | L1 is deprecated but still works in Chromium; L2 is more precise. For this use case, wall-clock timing via `Date.now()` is sufficient and simpler. |
| Puppeteer `page.metrics()` only | `page.metrics()` + `page.evaluate(() => performance.now())` | Current | Combine both for comprehensive measurement |
| ExcelJS v3 | ExcelJS v4.4.0 | 2023 | v4 has better TypeScript types; already installed |

**Deprecated/outdated:**
- `performance.timing` (Navigation Timing Level 1): Still works but deprecated in favour of `PerformanceNavigationTiming`. For this project's needs, `Date.now()` wall-clock measurement is simpler and sufficient.

## Existing Infrastructure Inventory

Critical: the planner must understand what already exists to avoid rebuilding.

### ExcelJS Infrastructure (from Phase 2)
- `ExcelParserService.ts`: `extractCell()`, `extractNumericValue()`, `parseTransposedSheet()`, `cellRef()` -- all battle-tested
- `WeeklyReportParser.ts`: Knows exact row numbers for all data (financial rows 4-10, projects 18-31, sales 35-50, leads 55-66, reviews row 70, teams 73-98)
- `RevenueReportParser.ts`: Knows column mappings for revenue categories
- `FinanceThisWeekParser.ts`: Knows cell positions for cash position
- `ExcelMigrationService.ts`: Full workbook loading, buffer handling
- `WeekService.ts`: `toSaturday()`, `getCurrentWeekEnding()`, date range utilities

### Puppeteer Infrastructure (from Phase 3)
- `PdfExportService.ts`: Working browser launch with `PUPPETEER_EXECUTABLE_PATH` support, `--no-sandbox` flags, viewport config
- `PrintLayout.tsx`: `data-print-ready` attribute pattern for signalling content load
- Client port configuration: `CLIENT_PORT` env var, defaults to 4200

### API Endpoints to Validate
- `GET /api/v1/dashboard/executive-summary?weekEnding=` -- Returns KPIs, projects, leads, teams, trends (main validation target)
- `GET /api/v1/dashboard/financial-deep-dive?weekEnding=` -- Returns P&L, revenue breakdown, cash position
- `GET /api/v1/dashboard/regional-performance?weekEnding=` -- Returns team actuals vs targets
- `GET /api/v1/financial/weekly?weekEnding=` -- Raw financial data
- `GET /api/v1/marketing/leads?weekEnding=` -- Lead source data
- `GET /api/v1/teams/performance?weekEnding=` -- Team performance data

### Dashboard Pages to Benchmark
- Executive Summary (`activePage === 'executive_summary'`)
- Financial Deep Dive (`activePage === 'financial'`)
- Regional Performance (`activePage === 'regional_performance'`)
- Target Management (`activePage === 'target_management'`)

### Database Tables to Validate (11 migrated tables)
- `financial_weekly` (rows 4-10 from Weekly Report)
- `projects_weekly` (rows 18-31)
- `sales_weekly` (rows 35-50)
- `leads_weekly` (rows 55-66)
- `google_reviews_weekly` (row 70)
- `team_performance_weekly` (rows 73-98)
- `revenue_weekly` (from Weekly Revenue Report sheet)
- `cash_position_weekly` (from Finance This Week sheet)
- `staff_productivity_weekly` (from Productivity sheet)
- `phone_weekly` (from Phone sheet)
- `marketing_performance_weekly` (from APP + BA sheets)

### Known Week 30 Reference Values (from Roadmap)
These specific values MUST appear in the reference JSON for validation:
- **Net Profit:** $62,210.45
- **Budget (net_profit target):** $40,203
- **Cairns actual:** $24,560.60 vs target $38,580
- **SEQ Residential actual:** $73,838.32 vs target $51,888
- **NQ Commercial actual:** $35,820.60 vs target $16,248
- **Google leads:** 70
- **SEO leads:** 118
- **Total leads:** ~257

## Open Questions

Things that couldn't be fully resolved:

1. **Excel workbook file path**
   - What we know: The original Excel workbook must be available for the reference extraction script. No `.xlsx` file currently exists in the project directory.
   - What's unclear: Where the user stores the workbook file. The migration upload flow uses an in-memory buffer (multer), not a file path.
   - Recommendation: The extract-reference script should accept a file path argument. Document that the user must provide the workbook. Alternatively, provide a route that accepts the workbook upload and outputs the reference JSON.

2. **Checkpoint week numbers**
   - What we know: CONTEXT.md says "3-4 checkpoint weeks across the full range (early, middle, late -- e.g. Weeks 1, 10, 20, 30)". The workbook contains ~30 weeks of data.
   - What's unclear: The exact first and last week dates in the workbook (depends on when data starts).
   - Recommendation: The extract-reference script should auto-detect all available weeks, then pick evenly-spaced checkpoints: first week, ~1/3 through, ~2/3 through, and last week. Week 30 is the last one and must always be included since the roadmap gives concrete values for it.

3. **Dashboard page render signal for non-print pages**
   - What we know: Print pages use `data-print-ready="true"`. Normal dashboard pages use loading skeletons that disappear when data loads, but have no explicit "loaded" attribute.
   - What's unclear: How to detect when a normal page is fully rendered in Puppeteer.
   - Recommendation: Add a `data-loaded="true"` attribute to each dashboard page component (ExecutiveSummary, FinancialDeepDive, RegionalPerformance, TargetManagement) that is set after data fetch completes. This is a minimal change (~1 line per component) and mirrors the `data-print-ready` pattern.

4. **Target values in reference data**
   - What we know: Team targets are stored in the `targets` table, not extracted from Excel columns. The roadmap gives specific target values (e.g. Cairns target $38,580).
   - What's unclear: Whether these target values were seeded, imported via Excel migration (the WeeklyReportParser has `targetRow` references but only parses `actualRow`), or need to be manually entered.
   - Recommendation: The validation should check if targets exist for the checkpoint weeks. If not, the reference JSON should include expected target values, and the validation script should note that targets need to be set up first.

## Sources

### Primary (HIGH confidence)
- `/puppeteer/puppeteer` (Context7) - Page.metrics(), waitForSelector(), navigation timing
- `/exceljs/exceljs` (Context7) - Workbook reading, cell access, row iteration
- Existing codebase: `ExcelParserService.ts`, `PdfExportService.ts`, `dashboard.ts`, `ExcelMigrationService.ts` -- all read directly from project files
- Prisma schema: `server/prisma/schema.prisma` -- all table definitions verified

### Secondary (MEDIUM confidence)
- Performance API: `window.performance.timing` is deprecated but `Date.now()` wall-clock measurement is reliable for warm-load benchmarking
- Puppeteer v24 launch options: Verified against existing working PdfExportService

### Tertiary (LOW confidence)
- None -- all findings verified from codebase or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and working in the project
- Architecture: HIGH - Patterns derived from existing codebase infrastructure, not external assumptions
- Pitfalls: HIGH - Identified from actual code patterns (Prisma Decimal conversion, auth middleware, date timezone handling)

**Research date:** 2026-02-06
**Valid until:** 2026-03-08 (30 days -- stable domain, no external dependencies)
