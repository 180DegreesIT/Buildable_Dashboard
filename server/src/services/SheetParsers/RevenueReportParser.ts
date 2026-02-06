/**
 * RevenueReportParser — Parser for Sheet 7 "Weekly Revenue Report" (standard table layout).
 *
 * This sheet has rows as weeks and columns as revenue categories.
 * Dates are in column 1 and are already Saturdays.
 * Maps to revenue_weekly table.
 */
import type { Workbook } from 'exceljs';
import { extractCell, extractNumericValue, cellRef } from '../ExcelParserService.js';
import { WeekService } from '../WeekService.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RevenueRecord {
  weekDate: Date;
  category: string;
  amount: number | null;
  warnings: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHEET_NAME = 'Weekly Revenue Report';

/**
 * Column-to-RevenueCategory mapping.
 * Skip total columns (9, 17, 29, 30) as they are calculated sums.
 * Skip columns that duplicate an already-mapped category.
 */
const COLUMN_MAPPINGS: Array<{ col: number; category: string }> = [
  { col: 2, category: 'class_1a' },
  { col: 3, category: 'class_10a_sheds' },
  { col: 4, category: 'class_10b_pools' },
  { col: 5, category: 'inspections' },
  { col: 6, category: 'retrospective' },
  { col: 7, category: 'class_2_9_commercial' },
  { col: 8, category: 'planning_1_10' },
  { col: 28, category: 'access_labour_hire' },
];

// ─── Parser ───────────────────────────────────────────────────────────────────

export class RevenueReportParser {
  parse(workbook: Workbook): RevenueRecord[] {
    const ws = workbook.getWorksheet(SHEET_NAME);
    if (!ws) {
      return [];
    }

    const results: RevenueRecord[] = [];

    // Iterate rows starting from row 2 (row 1 is header)
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const dateCell = row.getCell(1);
      const dateExtraction = extractCell(dateCell.value, `${SHEET_NAME}!${cellRef(r, 1)}`);

      // Must be a valid date
      if (!(dateExtraction.value instanceof Date)) continue;

      // Dates are already Saturdays but snap to be safe
      const weekDate = WeekService.toSaturday(dateExtraction.value);

      for (const mapping of COLUMN_MAPPINGS) {
        const ref = `${SHEET_NAME}!${cellRef(r, mapping.col)}`;
        const extracted = extractNumericValue(row.getCell(mapping.col).value, ref);

        const warnings: string[] = [];
        if (extracted.warning) warnings.push(extracted.warning);

        // Skip entirely null amounts (no data for this category this week)
        if (extracted.value === null) continue;

        results.push({
          weekDate,
          category: mapping.category,
          amount: extracted.value,
          warnings,
        });
      }
    }

    return results;
  }
}
