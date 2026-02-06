/**
 * ValidationService -- Compares live dashboard API responses against reference
 * values extracted from the original Excel workbook.
 *
 * Pattern: API-level comparison. Calls the same endpoints the dashboard uses,
 * testing the full stack including FinancialService.computeDerivedMetrics(),
 * TargetService resolution, and JSON serialisation.
 *
 * Usage:
 *   const result = await ValidationService.runValidation();
 *   ValidationService.printResults(result);
 */
import fs from 'fs';
import path from 'path';

// ---- Types -------------------------------------------------------------------

export interface ValidationCheck {
  id: string;
  category: string;
  weekEnding: string;
  field: string;
  expected: number;
  actual: number | null;
  difference: number;
  passed: boolean;
  note?: string;
}

export interface CategorySummary {
  passed: number;
  failed: number;
  total: number;
}

export interface ValidationResult {
  runAt: string;
  duration: number;
  totalChecks: number;
  passed: number;
  failed: number;
  checks: ValidationCheck[];
  summary: {
    byCategory: Record<string, CategorySummary>;
    byWeek: Record<string, CategorySummary>;
  };
}

interface ReferenceFinancial {
  totalTradingIncome: number;
  totalCostOfSales: number;
  grossProfit: number;
  otherIncome: number;
  operatingExpenses: number;
  wagesAndSalaries: number;
  netProfit: number;
}

interface ReferenceTeam {
  region: string;
  actualInvoiced: number;
}

interface ReferenceLead {
  source: string;
  leadCount: number;
}

interface ReferenceCashPosition {
  everydayAccount: number;
  totalCashAvailable: number;
  totalReceivables: number;
}

interface ReferenceGoogleReviews {
  reviewCount: number;
  cumulativeCount: number;
}

interface ReferenceCheckpointWeek {
  weekEnding: string;
  weekNumber: number;
  financial: ReferenceFinancial;
  teams: ReferenceTeam[];
  leads: ReferenceLead[];
  cashPosition: ReferenceCashPosition;
  googleReviews: ReferenceGoogleReviews;
}

interface ReferenceData {
  extractedAt: string;
  workbookPath: string;
  checkpointWeeks: ReferenceCheckpointWeek[];
}

// ---- ANSI Colours for Terminal Output ----------------------------------------

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

// ---- Comparison Helpers ------------------------------------------------------

/**
 * Compare two currency values exact to the cent.
 * Handles floating-point precision by rounding both to integer cents.
 */
function centsEqual(actual: number | null, expected: number): boolean {
  if (actual === null || actual === undefined) return false;
  return Math.round(actual * 100) === Math.round(expected * 100);
}

/**
 * Compare two integer values (lead counts, review counts).
 */
function integerEqual(actual: number | null, expected: number): boolean {
  if (actual === null || actual === undefined) return false;
  return Math.round(actual) === Math.round(expected);
}

function formatCurrency(val: number | null): string {
  if (val === null || val === undefined) return 'null';
  return `$${val.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---- API Fetching ------------------------------------------------------------

const BASE_URL = `http://localhost:${process.env.PORT || 6001}`;
const FETCH_TIMEOUT = 10_000; // 10 seconds

async function fetchApi(endpoint: string): Promise<any> {
  const url = `${BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { _error: true, status: res.status, message: `HTTP ${res.status}` };
    }
    return await res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { _error: true, status: 0, message: 'Request timed out after 10s' };
    }
    return { _error: true, status: 0, message: err.message || 'Network error' };
  }
}

// ---- Reference Data Loading --------------------------------------------------

function loadReferenceData(): ReferenceData {
  const refPath = path.resolve(__dirname, '..', 'data', 'reference-values.json');

  if (!fs.existsSync(refPath)) {
    throw new Error(
      `Reference values not found at ${refPath}. Run extract-reference.ts first:\n` +
      '  npx tsx server/src/scripts/extract-reference.ts [path-to-workbook]'
    );
  }

  const raw = fs.readFileSync(refPath, 'utf-8');
  return JSON.parse(raw) as ReferenceData;
}

// ---- Validation Logic --------------------------------------------------------

export class ValidationService {
  /**
   * Run the full validation suite: load reference data, call API endpoints
   * for each checkpoint week, compare all fields, return structured results.
   */
  static async runValidation(): Promise<ValidationResult> {
    const startTime = Date.now();
    const reference = loadReferenceData();
    const checks: ValidationCheck[] = [];

    for (const checkpoint of reference.checkpointWeeks) {
      const weekEnding = checkpoint.weekEnding;
      const weekLabel = `week${checkpoint.weekNumber}`;

      // ---- Fetch API data for this checkpoint week ----
      const [execSummary, financialDeepDive, leads] = await Promise.all([
        fetchApi(`/api/v1/dashboard/executive-summary?weekEnding=${weekEnding}`),
        fetchApi(`/api/v1/dashboard/financial-deep-dive?weekEnding=${weekEnding}`),
        fetchApi(`/api/v1/marketing/leads?weekEnding=${weekEnding}`),
      ]);

      // ---- Financial checks (from executive-summary kpis + financial-deep-dive plWeekly) ----
      checks.push(
        ...this.validateFinancial(weekLabel, weekEnding, checkpoint.financial, execSummary, financialDeepDive)
      );

      // ---- Team performance checks ----
      checks.push(
        ...this.validateTeams(weekLabel, weekEnding, checkpoint.teams, execSummary)
      );

      // ---- Lead checks ----
      checks.push(
        ...this.validateLeads(weekLabel, weekEnding, checkpoint.leads, execSummary, leads)
      );

      // ---- Cash position checks ----
      checks.push(
        ...this.validateCashPosition(weekLabel, weekEnding, checkpoint.cashPosition, financialDeepDive)
      );

      // ---- Google reviews checks ----
      checks.push(
        ...this.validateGoogleReviews(weekLabel, weekEnding, checkpoint.googleReviews, execSummary)
      );
    }

    const duration = Date.now() - startTime;
    const passed = checks.filter((c) => c.passed).length;
    const failed = checks.filter((c) => !c.passed).length;

    // Build summary
    const byCategory: Record<string, CategorySummary> = {};
    const byWeek: Record<string, CategorySummary> = {};

    for (const check of checks) {
      // By category
      if (!byCategory[check.category]) {
        byCategory[check.category] = { passed: 0, failed: 0, total: 0 };
      }
      byCategory[check.category].total++;
      if (check.passed) byCategory[check.category].passed++;
      else byCategory[check.category].failed++;

      // By week
      if (!byWeek[check.weekEnding]) {
        byWeek[check.weekEnding] = { passed: 0, failed: 0, total: 0 };
      }
      byWeek[check.weekEnding].total++;
      if (check.passed) byWeek[check.weekEnding].passed++;
      else byWeek[check.weekEnding].failed++;
    }

    return {
      runAt: new Date().toISOString(),
      duration,
      totalChecks: checks.length,
      passed,
      failed,
      checks,
      summary: { byCategory, byWeek },
    };
  }

  // ---- Financial Validation ----

  private static validateFinancial(
    weekLabel: string,
    weekEnding: string,
    expected: ReferenceFinancial,
    execSummary: any,
    deepDive: any,
  ): ValidationCheck[] {
    const checks: ValidationCheck[] = [];
    const hasExecError = execSummary?._error;
    const hasDeepDiveError = deepDive?._error;

    // Net Profit from executive summary kpis
    const actualNetProfit = hasExecError ? null : execSummary?.kpis?.netProfit?.actual ?? null;
    checks.push(this.buildCurrencyCheck(
      `${weekLabel}.financial.netProfit`,
      'Financial', weekEnding, 'Net Profit',
      expected.netProfit, actualNetProfit,
      hasExecError ? `API error: ${execSummary?.message}` : undefined,
    ));

    // Total Trading Income (Revenue P&L) from executive summary
    const actualRevenuePL = hasExecError ? null : execSummary?.kpis?.revenuePL?.actual ?? null;
    checks.push(this.buildCurrencyCheck(
      `${weekLabel}.financial.totalTradingIncome`,
      'Financial', weekEnding, 'Total Trading Income',
      expected.totalTradingIncome, actualRevenuePL,
      hasExecError ? `API error: ${execSummary?.message}` : undefined,
    ));

    // P&L details from financial deep dive
    if (!hasDeepDiveError && deepDive?.plWeekly) {
      const pl = deepDive.plWeekly;

      checks.push(this.buildCurrencyCheck(
        `${weekLabel}.financial.totalCostOfSales`,
        'Financial', weekEnding, 'Total Cost of Sales',
        expected.totalCostOfSales, pl.totalCostOfSales ?? null,
      ));

      checks.push(this.buildCurrencyCheck(
        `${weekLabel}.financial.grossProfit`,
        'Financial', weekEnding, 'Gross Profit',
        expected.grossProfit, pl.grossProfit ?? null,
      ));

      checks.push(this.buildCurrencyCheck(
        `${weekLabel}.financial.otherIncome`,
        'Financial', weekEnding, 'Other Income',
        expected.otherIncome, pl.otherIncome ?? null,
      ));

      checks.push(this.buildCurrencyCheck(
        `${weekLabel}.financial.operatingExpenses`,
        'Financial', weekEnding, 'Operating Expenses',
        expected.operatingExpenses, pl.operatingExpenses ?? null,
      ));

      checks.push(this.buildCurrencyCheck(
        `${weekLabel}.financial.wagesAndSalaries`,
        'Financial', weekEnding, 'Wages & Salaries',
        expected.wagesAndSalaries, pl.wagesAndSalaries ?? null,
      ));
    } else {
      // API error -- mark all deep-dive checks as failed
      const note = hasDeepDiveError ? `API error: ${deepDive?.message}` : 'No P&L data in response';
      for (const field of ['totalCostOfSales', 'grossProfit', 'otherIncome', 'operatingExpenses', 'wagesAndSalaries']) {
        checks.push({
          id: `${weekLabel}.financial.${field}`,
          category: 'Financial',
          weekEnding,
          field: field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
          expected: (expected as any)[field],
          actual: null,
          difference: 0,
          passed: false,
          note,
        });
      }
    }

    return checks;
  }

  // ---- Team Validation ----

  private static validateTeams(
    weekLabel: string,
    weekEnding: string,
    expected: ReferenceTeam[],
    execSummary: any,
  ): ValidationCheck[] {
    const checks: ValidationCheck[] = [];

    if (execSummary?._error) {
      for (const team of expected) {
        checks.push({
          id: `${weekLabel}.team.${team.region}`,
          category: 'Team Performance',
          weekEnding,
          field: `${team.region} Invoiced`,
          expected: team.actualInvoiced,
          actual: null,
          difference: 0,
          passed: false,
          note: `API error: ${execSummary?.message}`,
        });
      }
      return checks;
    }

    const apiTeams: any[] = execSummary?.teamPerformance ?? [];

    for (const team of expected) {
      const apiTeam = apiTeams.find((t: any) => t.region === team.region);
      const actual = apiTeam?.actual ?? null;

      checks.push(this.buildCurrencyCheck(
        `${weekLabel}.team.${team.region}`,
        'Team Performance', weekEnding,
        `${team.region} Invoiced`,
        team.actualInvoiced, actual,
        apiTeam ? undefined : 'Region not found in API response',
      ));
    }

    return checks;
  }

  // ---- Lead Validation ----

  private static validateLeads(
    weekLabel: string,
    weekEnding: string,
    expected: ReferenceLead[],
    execSummary: any,
    leadsApi: any,
  ): ValidationCheck[] {
    const checks: ValidationCheck[] = [];

    // Use executive summary leadBreakdown first, fall back to marketing/leads API
    const apiLeads: any[] = execSummary?._error
      ? (Array.isArray(leadsApi) ? leadsApi : [])
      : (execSummary?.leadBreakdown ?? []);

    for (const lead of expected) {
      const apiLead = apiLeads.find((l: any) => l.source === lead.source);
      const actual = apiLead?.leadCount ?? (apiLead ? Number(apiLead.leadCount) : null);

      checks.push(this.buildIntegerCheck(
        `${weekLabel}.leads.${lead.source}`,
        'Leads', weekEnding,
        `${lead.source} Leads`,
        lead.leadCount, actual,
        apiLead ? undefined : 'Source not found in API response',
      ));
    }

    return checks;
  }

  // ---- Cash Position Validation ----

  private static validateCashPosition(
    weekLabel: string,
    weekEnding: string,
    expected: ReferenceCashPosition,
    deepDive: any,
  ): ValidationCheck[] {
    const checks: ValidationCheck[] = [];

    // Skip checks if expected cash position is all zeroes (non-latest week)
    if (expected.everydayAccount === 0 && expected.totalCashAvailable === 0 && expected.totalReceivables === 0) {
      return checks;
    }

    if (deepDive?._error) {
      for (const [field, val] of Object.entries(expected)) {
        checks.push({
          id: `${weekLabel}.cashPosition.${field}`,
          category: 'Cash Position',
          weekEnding,
          field: field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
          expected: val as number,
          actual: null,
          difference: 0,
          passed: false,
          note: `API error: ${deepDive?.message}`,
        });
      }
      return checks;
    }

    const cashData = deepDive?.cashPosition;

    checks.push(this.buildCurrencyCheck(
      `${weekLabel}.cashPosition.everydayAccount`,
      'Cash Position', weekEnding, 'Everyday Account',
      expected.everydayAccount,
      cashData?.everydayAccount ?? null,
      cashData ? undefined : 'No cash position data in response',
    ));

    checks.push(this.buildCurrencyCheck(
      `${weekLabel}.cashPosition.totalCashAvailable`,
      'Cash Position', weekEnding, 'Total Cash Available',
      expected.totalCashAvailable,
      cashData?.totalCashAvailable ?? null,
      cashData ? undefined : 'No cash position data in response',
    ));

    // Aged receivables from deep dive
    const receivables = deepDive?.agedReceivables;
    checks.push(this.buildCurrencyCheck(
      `${weekLabel}.cashPosition.totalReceivables`,
      'Cash Position', weekEnding, 'Total Receivables',
      expected.totalReceivables,
      receivables?.totalReceivables ?? null,
      receivables ? undefined : 'No receivables data in response',
    ));

    return checks;
  }

  // ---- Google Reviews Validation ----

  private static validateGoogleReviews(
    weekLabel: string,
    weekEnding: string,
    expected: ReferenceGoogleReviews,
    execSummary: any,
  ): ValidationCheck[] {
    const checks: ValidationCheck[] = [];

    if (execSummary?._error) {
      checks.push({
        id: `${weekLabel}.reviews.reviewCount`,
        category: 'Google Reviews',
        weekEnding,
        field: 'Weekly Review Count',
        expected: expected.reviewCount,
        actual: null,
        difference: 0,
        passed: false,
        note: `API error: ${execSummary?.message}`,
      });
      return checks;
    }

    const reviews = execSummary?.reviews;

    checks.push(this.buildIntegerCheck(
      `${weekLabel}.reviews.reviewCount`,
      'Google Reviews', weekEnding, 'Weekly Review Count',
      expected.reviewCount,
      reviews?.reviewCount ?? null,
      reviews ? undefined : 'No review data in response',
    ));

    if (expected.cumulativeCount > 0) {
      checks.push(this.buildIntegerCheck(
        `${weekLabel}.reviews.cumulativeCount`,
        'Google Reviews', weekEnding, 'Cumulative Review Count',
        expected.cumulativeCount,
        reviews?.cumulativeCount ?? null,
        reviews ? undefined : 'No review data in response',
      ));
    }

    return checks;
  }

  // ---- Check Builders ----

  private static buildCurrencyCheck(
    id: string,
    category: string,
    weekEnding: string,
    field: string,
    expected: number,
    actual: number | null,
    note?: string,
  ): ValidationCheck {
    const passed = actual !== null && actual !== undefined
      ? centsEqual(actual, expected)
      : false;
    const difference = actual !== null && actual !== undefined
      ? Math.round((actual - expected) * 100) / 100
      : 0;

    return {
      id,
      category,
      weekEnding,
      field,
      expected,
      actual,
      difference,
      passed,
      note: note || (actual === null ? 'Value missing from database' : undefined),
    };
  }

  private static buildIntegerCheck(
    id: string,
    category: string,
    weekEnding: string,
    field: string,
    expected: number,
    actual: number | null,
    note?: string,
  ): ValidationCheck {
    const passed = actual !== null && actual !== undefined
      ? integerEqual(actual, expected)
      : false;
    const difference = actual !== null && actual !== undefined
      ? actual - expected
      : 0;

    return {
      id,
      category,
      weekEnding,
      field,
      expected,
      actual,
      difference,
      passed,
      note: note || (actual === null ? 'Value missing from database' : undefined),
    };
  }

  // ---- Console Output ----

  /**
   * Print validation results to console with colour-coded output.
   */
  static printResults(result: ValidationResult): void {
    console.log(`\n${BOLD}${'='.repeat(70)}${RESET}`);
    console.log(`${BOLD}  VALIDATION RESULTS${RESET}`);
    console.log(`${BOLD}${'='.repeat(70)}${RESET}`);
    console.log(`  Run at: ${result.runAt}`);
    console.log(`  Duration: ${result.duration}ms`);

    // Summary score
    const pct = result.totalChecks > 0
      ? ((result.passed / result.totalChecks) * 100).toFixed(0)
      : '0';
    const summaryColour = result.failed === 0 ? GREEN : result.passed > result.failed ? YELLOW : RED;
    console.log(`\n  ${summaryColour}${BOLD}${result.passed}/${result.totalChecks} checks passed (${pct}%)${RESET}`);

    // By category summary
    console.log(`\n${CYAN}  By Category:${RESET}`);
    for (const [cat, summary] of Object.entries(result.summary.byCategory)) {
      const catColour = summary.failed === 0 ? GREEN : RED;
      console.log(`    ${catColour}${cat}: ${summary.passed}/${summary.total}${RESET}`);
    }

    // By week summary
    console.log(`\n${CYAN}  By Week:${RESET}`);
    for (const [week, summary] of Object.entries(result.summary.byWeek)) {
      const weekColour = summary.failed === 0 ? GREEN : RED;
      console.log(`    ${weekColour}${week}: ${summary.passed}/${summary.total}${RESET}`);
    }

    // Detailed results
    console.log(`\n${BOLD}${'─'.repeat(70)}${RESET}`);
    console.log(`${BOLD}  DETAILED RESULTS${RESET}`);
    console.log(`${BOLD}${'─'.repeat(70)}${RESET}`);

    // Group by category for readability
    const categories = new Map<string, ValidationCheck[]>();
    for (const check of result.checks) {
      if (!categories.has(check.category)) {
        categories.set(check.category, []);
      }
      categories.get(check.category)!.push(check);
    }

    for (const [category, categoryChecks] of categories) {
      console.log(`\n  ${CYAN}${BOLD}${category}${RESET}`);

      for (const check of categoryChecks) {
        if (check.passed) {
          const isCurrency = check.category !== 'Leads' && check.category !== 'Google Reviews';
          const actualStr = isCurrency ? formatCurrency(check.actual) : String(check.actual);
          console.log(`    ${GREEN}[PASS]${RESET} ${check.id}: expected ${isCurrency ? formatCurrency(check.expected) : check.expected}, actual ${actualStr}`);
        } else {
          const isCurrency = check.category !== 'Leads' && check.category !== 'Google Reviews';
          console.log(`    ${RED}[FAIL]${RESET} ${check.id}:`);
          console.log(`           Expected: ${isCurrency ? formatCurrency(check.expected) : check.expected}`);
          console.log(`           Actual:   ${check.actual !== null ? (isCurrency ? formatCurrency(check.actual) : check.actual) : 'null'}`);
          if (check.difference !== 0) {
            console.log(`           Diff:     ${isCurrency ? formatCurrency(check.difference) : check.difference}`);
          }
          if (check.note) {
            console.log(`           Note:     ${check.note}`);
          }
        }
      }
    }

    console.log(`\n${BOLD}${'='.repeat(70)}${RESET}\n`);
  }
}
