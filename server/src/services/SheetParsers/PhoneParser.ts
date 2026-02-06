/**
 * PhoneParser — Parser for Sheet 16 "Phone (2)" (transposed layout).
 *
 * Uses Phone (2) instead of Phone (Sheet 17 has 628 formula errors).
 * Row structure: staff name rows with inbound/outbound/missed calls per week.
 * Date row 3, data starts col 3.
 *
 * Staff are identified by non-empty label in column 1.
 * Each staff member has 3 consecutive metric rows:
 *   - inboundCalls
 *   - outboundCalls
 *   - missedCalls
 */
import type { Workbook } from 'exceljs';
import { extractCell, extractNumericValue, cellRef } from '../ExcelParserService.js';
import { WeekService } from '../WeekService.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhoneRecord {
  weekDate: Date;
  staffName: string;
  values: {
    inboundCalls: number | null;
    outboundCalls: number | null;
    missedCalls: number | null;
  };
  warnings: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHEET_NAME = 'Phone (2)';
const DATE_ROW = 3;
const START_COL = 3;  // Data starts column C
const LABEL_COL = 1;  // Column A has staff name/metric labels

// ─── Parser ───────────────────────────────────────────────────────────────────

export class PhoneParser {
  parse(workbook: Workbook): PhoneRecord[] {
    const ws = workbook.getWorksheet(SHEET_NAME);
    if (!ws) {
      return [];
    }

    // Identify staff groups by scanning rows
    const staffGroups = this.identifyStaffGroups(ws);

    // Iterate week columns
    const results: PhoneRecord[] = [];
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

        const inRef = `${SHEET_NAME}!${cellRef(group.inboundRow, c)}`;
        const outRef = `${SHEET_NAME}!${cellRef(group.outboundRow, c)}`;
        const missRef = `${SHEET_NAME}!${cellRef(group.missedRow, c)}`;

        const inExt = extractNumericValue(ws.getRow(group.inboundRow).getCell(c).value, inRef);
        const outExt = extractNumericValue(ws.getRow(group.outboundRow).getCell(c).value, outRef);
        const missExt = extractNumericValue(ws.getRow(group.missedRow).getCell(c).value, missRef);

        if (inExt.warning) warnings.push(inExt.warning);
        if (outExt.warning) warnings.push(outExt.warning);
        if (missExt.warning) warnings.push(missExt.warning);

        // Skip if all values are null
        if (inExt.value === null && outExt.value === null && missExt.value === null) continue;

        results.push({
          weekDate,
          staffName: group.staffName,
          values: {
            inboundCalls: inExt.value !== null ? Math.round(inExt.value) : null,
            outboundCalls: outExt.value !== null ? Math.round(outExt.value) : null,
            missedCalls: missExt.value !== null ? Math.round(missExt.value) : null,
          },
          warnings,
        });
      }
    }

    return results;
  }

  /**
   * Scan rows to identify staff member groups.
   * Each staff member has a name label row followed by metric rows.
   * Pattern: staff name label, then rows for Inbound, Outbound, Missed.
   */
  private identifyStaffGroups(
    ws: any,
  ): Array<{
    staffName: string;
    inboundRow: number;
    outboundRow: number;
    missedRow: number;
  }> {
    const groups: Array<{
      staffName: string;
      inboundRow: number;
      outboundRow: number;
      missedRow: number;
    }> = [];

    // Scan rows starting after header
    for (let r = 4; r <= ws.rowCount - 2; r++) {
      const labelExt = extractCell(
        ws.getRow(r).getCell(LABEL_COL).value,
        `${SHEET_NAME}!${cellRef(r, LABEL_COL)}`,
      );
      const label = typeof labelExt.value === 'string' ? labelExt.value.trim() : '';

      if (!label) continue;

      // Check if this looks like a staff name row (not a metric like "Inbound", "Outbound", "Missed", "Total")
      const labelLower = label.toLowerCase();
      if (
        labelLower === 'inbound' ||
        labelLower === 'outbound' ||
        labelLower === 'missed' ||
        labelLower === 'total' ||
        labelLower.includes('total') ||
        labelLower === 'team' ||
        labelLower === 'average'
      ) {
        continue;
      }

      // Check next 3 rows for Inbound/Outbound/Missed pattern
      const nextLabels: string[] = [];
      for (let offset = 1; offset <= 3; offset++) {
        const nextExt = extractCell(
          ws.getRow(r + offset).getCell(LABEL_COL).value,
          `${SHEET_NAME}!${cellRef(r + offset, LABEL_COL)}`,
        );
        nextLabels.push(typeof nextExt.value === 'string' ? nextExt.value.trim().toLowerCase() : '');
      }

      // Check if the pattern matches: name then inbound/outbound/missed
      if (
        nextLabels[0].includes('inbound') &&
        nextLabels[1].includes('outbound') &&
        nextLabels[2].includes('missed')
      ) {
        groups.push({
          staffName: label,
          inboundRow: r + 1,
          outboundRow: r + 2,
          missedRow: r + 3,
        });
        r += 3; // Skip past this staff member's metric rows
      }
    }

    return groups;
  }
}
