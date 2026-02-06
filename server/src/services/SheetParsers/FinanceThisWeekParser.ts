/**
 * FinanceThisWeekParser — Parser for Sheet 6 "Finance This Week" (single-week snapshot).
 *
 * Returns exactly 1 record for cash_position_weekly. This sheet has no date column;
 * the week date must be provided from the most recent Saturday in the Weekly Report sheet.
 *
 * Cell layout is NOT a standard table — it's a narrative email-format report.
 * Values are in specific rows/columns.
 */
import type { Workbook } from 'exceljs';
import { extractNumericValue, cellRef } from '../ExcelParserService.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CashPositionRecord {
  weekDate: Date;
  values: Record<string, number | null>;
  warnings: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHEET_NAME = 'Finance This Week';

// ─── Parser ───────────────────────────────────────────────────────────────────

export class FinanceThisWeekParser {
  /**
   * Parse the Finance This Week sheet.
   * @param workbook ExcelJS workbook
   * @param weekDate The week ending date (from the Weekly Report sheet's most recent Saturday)
   */
  parse(workbook: Workbook, weekDate: Date): CashPositionRecord | null {
    const ws = workbook.getWorksheet(SHEET_NAME);
    if (!ws) {
      return null;
    }

    const warnings: string[] = [];

    const getVal = (row: number, col: number = 2): number | null => {
      const ref = `${SHEET_NAME}!${cellRef(row, col)}`;
      const ext = extractNumericValue(ws.getRow(row).getCell(col).value, ref);
      if (ext.warning) warnings.push(ext.warning);
      return ext.value;
    };

    // Bank account balances
    const anzEveryday = getVal(8);
    const nabEveryday = getVal(10);
    const everydayAccount =
      anzEveryday !== null || nabEveryday !== null
        ? (anzEveryday ?? 0) + (nabEveryday ?? 0)
        : null;

    const taxSavings = getVal(11);
    const capitalAccount = getVal(12);
    const creditCards = getVal(17);
    const totalCashAvailable = getVal(18);

    // Receivables — row 22 across columns
    // The exact column positions vary; try columns B-F (2-6) for the receivables row
    const totalReceivables = getVal(22, 2);
    const currentReceivables = getVal(22, 3);
    const over30Days = getVal(22, 4);
    const over60Days = getVal(22, 5);
    const over90Days = getVal(22, 6);

    // Payables
    const totalPayables = getVal(25);

    const values: Record<string, number | null> = {
      everydayAccount,
      taxSavings,
      capitalAccount,
      creditCards,
      totalCashAvailable,
      totalReceivables,
      currentReceivables,
      over30Days,
      over60Days,
      over90Days,
      totalPayables,
    };

    // Only return if at least some data exists
    if (Object.values(values).every((v) => v === null)) {
      return null;
    }

    return { weekDate, values, warnings };
  }
}
