/**
 * extract-reference.ts -- One-time script to extract reference values from the
 * Buildable Weekly Report Excel workbook into a JSON fixture file.
 *
 * Usage:
 *   npx tsx server/src/scripts/extract-reference.ts [path-to-workbook]
 *
 * Defaults to ./Weekly_Report__30.xlsx if no path is provided.
 *
 * Outputs: server/src/data/reference-values.json
 *
 * Reuses the exact same row mappings and cell extraction logic as the Phase 2
 * migration parsers, ensuring apples-to-apples comparison with imported data.
 */
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractCell,
  extractNumericValue,
  cellRef,
} from '../services/ExcelParserService.js';
import { WeekService } from '../services/WeekService.js';

// ---- Types -------------------------------------------------------------------

interface FinancialValues {
  totalTradingIncome: number;
  totalCostOfSales: number;
  grossProfit: number;
  otherIncome: number;
  operatingExpenses: number;
  wagesAndSalaries: number;
  netProfit: number;
}

interface TeamValue {
  region: string;
  actualInvoiced: number;
}

interface LeadValue {
  source: string;
  leadCount: number;
}

interface CashPositionValues {
  everydayAccount: number;
  totalCashAvailable: number;
  totalReceivables: number;
}

interface GoogleReviewValues {
  reviewCount: number;
  cumulativeCount: number;
}

interface CheckpointWeek {
  weekEnding: string;
  weekNumber: number;
  financial: FinancialValues;
  teams: TeamValue[];
  leads: LeadValue[];
  cashPosition: CashPositionValues;
  googleReviews: GoogleReviewValues;
}

interface ReferenceData {
  extractedAt: string;
  workbookPath: string;
  checkpointWeeks: CheckpointWeek[];
}

// ---- Constants (same as WeeklyReportParser) ----------------------------------

const WEEKLY_REPORT_SHEET = 'Weekly Report';
const FINANCE_THIS_WEEK_SHEET = 'Finance This Week';
const DATE_ROW = 3;
const START_COL = 3;

// Financial rows (from WeeklyReportParser)
const FINANCIAL_ROWS = {
  totalTradingIncome: 4,
  totalCostOfSales: 5,
  grossProfit: 6,
  otherIncome: 7,
  operatingExpenses: 8,
  wagesAndSalaries: 9,
  netProfit: 10,
};

// Lead source rows (from WeeklyReportParser)
const LEAD_SOURCES = [
  { source: 'google', countRow: 55 },
  { source: 'seo', countRow: 57 },
  { source: 'meta', countRow: 59 },
  { source: 'bing', countRow: 61 },
  { source: 'tiktok', countRow: 63 },
  { source: 'other', countRow: 65 },
];

// Team regions with actual-invoiced rows (from WeeklyReportParser)
const REGIONS = [
  { region: 'cairns', actualRow: 74 },
  { region: 'mackay', actualRow: 77 },
  { region: 'nq_commercial', actualRow: 80 },
  { region: 'seq_residential', actualRow: 83 },
  { region: 'seq_commercial', actualRow: 86 },
  { region: 'town_planning', actualRow: 89 },
  { region: 'townsville', actualRow: 92 },
  { region: 'wide_bay', actualRow: 95 },
  { region: 'all_in_access', actualRow: 98 },
];

// Google reviews row (from WeeklyReportParser)
const REVIEW_COUNT_ROW = 70;

// Finance This Week cell positions (from FinanceThisWeekParser)
const CASH_CELLS = {
  anzEveryday: { row: 8, col: 2 },
  nabEveryday: { row: 10, col: 2 },
  totalCashAvailable: { row: 18, col: 2 },
  totalReceivables: { row: 22, col: 2 },
};

// ---- Helpers -----------------------------------------------------------------

function getNumeric(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
): number {
  const ref = `${ws.name}!${cellRef(row, col)}`;
  const ext = extractNumericValue(ws.getRow(row).getCell(col).value, ref);
  return ext.value ?? 0;
}

function roundCents(val: number): number {
  return Math.round(val * 100) / 100;
}

// ---- Main --------------------------------------------------------------------

async function main() {
  const workbookPath = process.argv[2] || './Weekly_Report__30.xlsx';
  const resolvedPath = path.resolve(workbookPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: Workbook not found at ${resolvedPath}`);
    console.error('Usage: npx tsx server/src/scripts/extract-reference.ts [path-to-workbook]');
    process.exit(1);
  }

  console.log(`Reading workbook: ${resolvedPath}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(resolvedPath);

  // ---- Discover available weeks from the Weekly Report sheet ----
  const ws = wb.getWorksheet(WEEKLY_REPORT_SHEET);
  if (!ws) {
    console.error(`Error: Sheet "${WEEKLY_REPORT_SHEET}" not found in workbook`);
    process.exit(1);
  }

  const weekColumns = new Map<string, number>(); // ISO date -> column index
  const dateRowObj = ws.getRow(DATE_ROW);

  for (let c = START_COL; c <= ws.columnCount; c++) {
    const cellVal = dateRowObj.getCell(c).value;
    const extraction = extractCell(cellVal, `${WEEKLY_REPORT_SHEET}!${cellRef(DATE_ROW, c)}`);

    if (extraction.value instanceof Date) {
      const saturday = WeekService.toSaturday(extraction.value);
      const isoDate = saturday.toISOString().split('T')[0];
      weekColumns.set(isoDate, c);
    }
  }

  if (weekColumns.size === 0) {
    console.error('Error: No valid date columns found in the Weekly Report sheet');
    process.exit(1);
  }

  const allWeeks = Array.from(weekColumns.keys()).sort();
  console.log(`Found ${allWeeks.length} weeks: ${allWeeks[0]} to ${allWeeks[allWeeks.length - 1]}`);

  // ---- Select 3-4 checkpoint weeks ----
  const checkpointDates: string[] = [];

  // Always include earliest
  checkpointDates.push(allWeeks[0]);

  // Middle-ish (~1/3 through)
  const oneThird = Math.floor(allWeeks.length / 3);
  if (oneThird > 0 && oneThird < allWeeks.length - 1) {
    checkpointDates.push(allWeeks[oneThird]);
  }

  // Two-thirds (~2/3 through)
  const twoThirds = Math.floor((allWeeks.length * 2) / 3);
  if (twoThirds > oneThird && twoThirds < allWeeks.length - 1) {
    checkpointDates.push(allWeeks[twoThirds]);
  }

  // Always include latest (week 30)
  const lastWeek = allWeeks[allWeeks.length - 1];
  if (!checkpointDates.includes(lastWeek)) {
    checkpointDates.push(lastWeek);
  }

  console.log(`Selected checkpoint weeks: ${checkpointDates.join(', ')}`);

  // ---- Extract reference values for each checkpoint week ----
  const financeSheet = wb.getWorksheet(FINANCE_THIS_WEEK_SHEET);

  const checkpointWeeks: CheckpointWeek[] = [];

  for (const weekDate of checkpointDates) {
    const col = weekColumns.get(weekDate)!;
    const weekNumber = col - START_COL + 1;

    // Financial values (rows 4-10 from Weekly Report)
    const financial: FinancialValues = {
      totalTradingIncome: roundCents(getNumeric(ws, FINANCIAL_ROWS.totalTradingIncome, col)),
      totalCostOfSales: roundCents(getNumeric(ws, FINANCIAL_ROWS.totalCostOfSales, col)),
      grossProfit: roundCents(getNumeric(ws, FINANCIAL_ROWS.grossProfit, col)),
      otherIncome: roundCents(getNumeric(ws, FINANCIAL_ROWS.otherIncome, col)),
      operatingExpenses: roundCents(getNumeric(ws, FINANCIAL_ROWS.operatingExpenses, col)),
      wagesAndSalaries: roundCents(getNumeric(ws, FINANCIAL_ROWS.wagesAndSalaries, col)),
      netProfit: roundCents(getNumeric(ws, FINANCIAL_ROWS.netProfit, col)),
    };

    // Team performance (actual invoiced per region)
    const teams: TeamValue[] = REGIONS.map((reg) => ({
      region: reg.region,
      actualInvoiced: roundCents(getNumeric(ws, reg.actualRow, col)),
    }));

    // Lead counts per source
    const leads: LeadValue[] = LEAD_SOURCES.map((ls) => ({
      source: ls.source,
      leadCount: getNumeric(ws, ls.countRow, col),
    }));

    // Cash position (from Finance This Week sheet -- only has latest week data)
    // This sheet is a single-week snapshot; only extract if this is the latest week
    let cashPosition: CashPositionValues = {
      everydayAccount: 0,
      totalCashAvailable: 0,
      totalReceivables: 0,
    };

    if (financeSheet && weekDate === lastWeek) {
      const anzEveryday = getNumeric(financeSheet, CASH_CELLS.anzEveryday.row, CASH_CELLS.anzEveryday.col);
      const nabEveryday = getNumeric(financeSheet, CASH_CELLS.nabEveryday.row, CASH_CELLS.nabEveryday.col);
      cashPosition = {
        everydayAccount: roundCents(anzEveryday + nabEveryday),
        totalCashAvailable: roundCents(getNumeric(financeSheet, CASH_CELLS.totalCashAvailable.row, CASH_CELLS.totalCashAvailable.col)),
        totalReceivables: roundCents(getNumeric(financeSheet, CASH_CELLS.totalReceivables.row, CASH_CELLS.totalReceivables.col)),
      };
    }

    // Google reviews (row 70, only reviewCount -- cumulativeCount is a running total)
    const reviewCount = getNumeric(ws, REVIEW_COUNT_ROW, col);
    // Cumulative = sum of all review counts up to this week
    let cumulativeCount = 0;
    for (const [wk, wkCol] of weekColumns.entries()) {
      if (wk <= weekDate) {
        cumulativeCount += getNumeric(ws, REVIEW_COUNT_ROW, wkCol);
      }
    }

    const googleReviews: GoogleReviewValues = {
      reviewCount: Math.round(reviewCount),
      cumulativeCount: Math.round(cumulativeCount),
    };

    checkpointWeeks.push({
      weekEnding: weekDate,
      weekNumber,
      financial,
      teams,
      leads,
      cashPosition,
      googleReviews,
    });
  }

  // ---- Write reference JSON ----
  const referenceData: ReferenceData = {
    extractedAt: new Date().toISOString(),
    workbookPath: resolvedPath,
    checkpointWeeks,
  };

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outputPath = path.resolve(__dirname, '..', 'data', 'reference-values.json');

  // Ensure data directory exists
  const dataDir = path.dirname(outputPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(referenceData, null, 2), 'utf-8');
  console.log(`\nReference values written to: ${outputPath}`);

  // ---- Print summary ----
  console.log('\n' + '='.repeat(60));
  console.log('  REFERENCE VALUE EXTRACTION SUMMARY');
  console.log('='.repeat(60));

  for (const cp of checkpointWeeks) {
    console.log(`\n  Week ${cp.weekNumber} (${cp.weekEnding}):`);
    console.log(`    Financial:      ${Object.keys(cp.financial).length} fields`);
    console.log(`    Teams:          ${cp.teams.length} regions`);
    console.log(`    Leads:          ${cp.leads.length} sources`);
    console.log(`    Cash Position:  ${Object.keys(cp.cashPosition).length} fields`);
    console.log(`    Google Reviews: ${Object.keys(cp.googleReviews).length} fields`);

    // Show key values
    console.log(`    -- Net Profit: $${cp.financial.netProfit.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`);
    console.log(`    -- Total Trading Income: $${cp.financial.totalTradingIncome.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`);
    const totalLeads = cp.leads.reduce((s, l) => s + l.leadCount, 0);
    console.log(`    -- Total Leads: ${totalLeads}`);
  }

  const totalValues = checkpointWeeks.reduce((sum, cp) => {
    return sum
      + Object.keys(cp.financial).length
      + cp.teams.length
      + cp.leads.length
      + Object.keys(cp.cashPosition).length
      + Object.keys(cp.googleReviews).length;
  }, 0);

  console.log(`\n  Total: ${checkpointWeeks.length} checkpoint weeks, ${totalValues} reference values`);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
