/**
 * ProductivityParser — Parser for Sheet 12 "Productivity" (transposed layout).
 *
 * Row structure: groups of 3 rows per staff member:
 *   - Row N: jobsCompleted (# count)
 *   - Row N+1: revenueGenerated ($ revenue)
 *   - Row N+2: inspectionsCompleted
 *
 * Column B has the clean staff name. Date row is row 3.
 * Data starts at column D (col 4), skipping column C (Average).
 *
 * Staff are grouped by section headers:
 *   "Certifiers (sign off user)" -> role: certifier
 *   "Cadets" -> role: cadet
 */
import type { Workbook } from 'exceljs';
import { extractCell, extractNumericValue, cellRef } from '../ExcelParserService.js';
import { WeekService } from '../WeekService.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductivityRecord {
  weekDate: Date;
  staffName: string;
  role: string;
  values: {
    jobsCompleted: number | null;
    revenueGenerated: number | null;
    inspectionsCompleted: number | null;
  };
  warnings: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHEET_NAME = 'Productivity';
const DATE_ROW = 3;
const START_COL = 4; // Column D (skip A=label, B=name, C=Average)
const NAME_COL = 2;  // Column B has clean staff name

// ─── Parser ───────────────────────────────────────────────────────────────────

export class ProductivityParser {
  parse(workbook: Workbook): ProductivityRecord[] {
    const ws = workbook.getWorksheet(SHEET_NAME);
    if (!ws) {
      return [];
    }

    // First, identify staff member groups and their roles by scanning rows
    const staffGroups = this.identifyStaffGroups(ws);

    // Then, iterate week columns and extract data for each staff member
    const results: ProductivityRecord[] = [];
    const dateRowObj = ws.getRow(DATE_ROW);

    for (let c = START_COL; c <= ws.columnCount; c++) {
      const dateExtraction = extractCell(
        dateRowObj.getCell(c).value,
        `${SHEET_NAME}!${cellRef(DATE_ROW, c)}`,
      );
      if (!(dateExtraction.value instanceof Date)) continue;

      const weekDate = WeekService.toSaturday(dateExtraction.value);

      for (const group of staffGroups) {
        const warnings: string[] = [];

        const jobsRef = `${SHEET_NAME}!${cellRef(group.countRow, c)}`;
        const revenueRef = `${SHEET_NAME}!${cellRef(group.revenueRow, c)}`;
        const inspRef = `${SHEET_NAME}!${cellRef(group.inspectionsRow, c)}`;

        const jobsExt = extractNumericValue(ws.getRow(group.countRow).getCell(c).value, jobsRef);
        const revExt = extractNumericValue(ws.getRow(group.revenueRow).getCell(c).value, revenueRef);
        const inspExt = extractNumericValue(ws.getRow(group.inspectionsRow).getCell(c).value, inspRef);

        if (jobsExt.warning) warnings.push(jobsExt.warning);
        if (revExt.warning) warnings.push(revExt.warning);
        if (inspExt.warning) warnings.push(inspExt.warning);

        // Skip if all values are null (no data for this week)
        if (jobsExt.value === null && revExt.value === null && inspExt.value === null) continue;

        results.push({
          weekDate,
          staffName: group.staffName,
          role: group.role,
          values: {
            jobsCompleted: jobsExt.value !== null ? Math.round(jobsExt.value) : null,
            revenueGenerated: revExt.value,
            inspectionsCompleted: inspExt.value !== null ? Math.round(inspExt.value) : null,
          },
          warnings,
        });
      }
    }

    return results;
  }

  /**
   * Scan rows to identify staff member groups (3 rows each) and their roles.
   */
  private identifyStaffGroups(
    ws: any,
  ): Array<{
    staffName: string;
    role: string;
    countRow: number;
    revenueRow: number;
    inspectionsRow: number;
  }> {
    const groups: Array<{
      staffName: string;
      role: string;
      countRow: number;
      revenueRow: number;
      inspectionsRow: number;
    }> = [];

    let currentRole = 'other';

    // Scan from row 4 (after header rows) to find section headers and staff
    for (let r = 4; r <= ws.rowCount; r++) {
      const labelCell = ws.getRow(r).getCell(1);
      const nameCell = ws.getRow(r).getCell(NAME_COL);

      const labelExt = extractCell(labelCell.value, `${SHEET_NAME}!${cellRef(r, 1)}`);
      const nameExt = extractCell(nameCell.value, `${SHEET_NAME}!${cellRef(r, NAME_COL)}`);

      const label = typeof labelExt.value === 'string' ? labelExt.value : '';
      const name = typeof nameExt.value === 'string' ? nameExt.value : '';

      // Detect section headers
      const labelLower = label.toLowerCase();
      if (labelLower.includes('certifier')) {
        currentRole = 'certifier';
        continue;
      }
      if (labelLower.includes('cadet')) {
        currentRole = 'cadet';
        continue;
      }

      // Detect staff name: must have a non-empty name in column B
      // and the label typically ends with # (count row)
      if (name && label.endsWith('#')) {
        // This is the count row for a staff member
        // Next row is revenue ($), row after is inspections
        groups.push({
          staffName: name.trim(),
          role: currentRole,
          countRow: r,
          revenueRow: r + 1,
          inspectionsRow: r + 2,
        });
        // Skip the next 2 rows since they belong to this staff member
        r += 2;
      }
    }

    return groups;
  }
}
