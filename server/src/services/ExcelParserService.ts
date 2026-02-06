/**
 * ExcelParserService — Low-level cell extraction and transposed-sheet parsing utility.
 *
 * Handles all ExcelJS cell value types including formula errors, uncached formulas,
 * rich text, hyperlinks, and boolean values. Provides a generic parseTransposedSheet()
 * utility used by most sheet-specific parsers.
 */
import type { CellValue, Worksheet } from 'exceljs';
import { WeekService } from './WeekService.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CellExtraction {
  value: number | string | Date | null;
  warning?: string;
}

export interface TransposedConfig {
  dateRow: number;
  startCol: number;
  labelCol: number;
  rowMappings: Array<{
    row: number;
    dbField: string;
    type: 'currency' | 'integer' | 'decimal' | 'percentage';
  }>;
}

export interface ParsedWeek {
  weekDate: Date;
  values: Record<string, number | null>;
  warnings: string[];
}

// ─── Cell Extraction ──────────────────────────────────────────────────────────

/**
 * Extract the actual value from any ExcelJS cell, handling all object types.
 * Returns { value, warning? } — warnings are logged but never abort parsing.
 */
export function extractCell(cellValue: CellValue, ref: string): CellExtraction {
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

    // Formula with cached result: { formula: '...', result: X }
    if ('result' in cellValue) {
      const result = (cellValue as any).result;
      if (result === null || result === undefined) {
        return { value: null };
      }
      // Result itself may be an error object
      if (typeof result === 'object' && result !== null && 'error' in result) {
        return {
          value: 0,
          warning: `${ref}: Formula result error ${result.error}, set to 0`,
        };
      }
      if (result instanceof Date) return { value: result };
      if (typeof result === 'number') return { value: result };
      if (typeof result === 'boolean') return { value: result ? 1 : 0 };
      return { value: String(result).trim() };
    }

    // Uncached formula (cross-sheet reference without cached result)
    if ('formula' in cellValue && !('result' in cellValue)) {
      return {
        value: 0,
        warning: `${ref}: Uncached formula "${(cellValue as any).formula}", set to 0`,
      };
    }

    // Shared formula with result
    if ('sharedFormula' in cellValue && 'result' in cellValue) {
      const result = (cellValue as any).result;
      if (result === null || result === undefined) return { value: null };
      if (typeof result === 'object' && result !== null && 'error' in result) {
        return {
          value: 0,
          warning: `${ref}: Shared formula result error ${result.error}, set to 0`,
        };
      }
      if (result instanceof Date) return { value: result };
      if (typeof result === 'number') return { value: result };
      return { value: String(result).trim() };
    }

    // Shared formula without result
    if ('sharedFormula' in cellValue && !('result' in cellValue)) {
      return {
        value: 0,
        warning: `${ref}: Uncached shared formula, set to 0`,
      };
    }

    // Rich text: { richText: [{text: '...'}] }
    if ('richText' in cellValue) {
      const text = (cellValue as any).richText
        .map((rt: any) => rt.text)
        .join('')
        .trim();
      return { value: text };
    }

    // Hyperlink: { text: '...', hyperlink: '...' }
    if ('text' in cellValue) {
      return { value: (cellValue as any).text.trim() };
    }
  }

  // Fallback
  return { value: String(cellValue).trim() };
}

/**
 * Extract a numeric value from a cell. Calls extractCell then coerces to number.
 * Returns 0 for formula errors, null for empty cells.
 */
export function extractNumericValue(
  cellValue: CellValue,
  ref: string,
): { value: number | null; warning?: string } {
  const extraction = extractCell(cellValue, ref);

  if (extraction.value === null) {
    return { value: null, warning: extraction.warning };
  }

  if (typeof extraction.value === 'number') {
    return { value: extraction.value, warning: extraction.warning };
  }

  if (extraction.value instanceof Date) {
    return { value: null, warning: extraction.warning };
  }

  // String — try to parse as number (handles currency strings like "$1,234.56")
  const cleaned = String(extraction.value).replace(/[$,%\s]/g, '').replace(/,/g, '');
  const parsed = parseFloat(cleaned);
  if (!isNaN(parsed)) {
    return { value: parsed, warning: extraction.warning };
  }

  return { value: null, warning: extraction.warning };
}

// ─── Transposed Sheet Parsing ─────────────────────────────────────────────────

/**
 * Generic utility to parse a transposed Excel sheet where:
 * - Dates are in a header row (dateRow)
 * - Metrics are row labels
 * - Data columns start at startCol
 *
 * Iterates columns, extracts dates, snaps to Saturday, extracts mapped row values.
 * Skips columns where ALL values are null (future/empty weeks).
 */
export function parseTransposedSheet(
  ws: Worksheet,
  config: TransposedConfig,
): ParsedWeek[] {
  const results: ParsedWeek[] = [];
  const dateRowObj = ws.getRow(config.dateRow);

  for (let c = config.startCol; c <= ws.columnCount; c++) {
    const dateCell = dateRowObj.getCell(c);
    const dateExtraction = extractCell(dateCell.value, `${ws.name}!${cellRef(config.dateRow, c)}`);

    // Must be a valid date
    if (!(dateExtraction.value instanceof Date)) continue;

    // Snap to Saturday
    const weekDate = WeekService.toSaturday(dateExtraction.value);

    const values: Record<string, number | null> = {};
    const warnings: string[] = [];

    for (const mapping of config.rowMappings) {
      const cell = ws.getRow(mapping.row).getCell(c);
      const ref = `${ws.name}!${cellRef(mapping.row, c)}`;
      const extracted = extractNumericValue(cell.value, ref);

      if (extracted.warning) {
        warnings.push(extracted.warning);
      }

      values[mapping.dbField] = extracted.value;
    }

    // Skip columns where ALL values are null (empty future weeks)
    if (Object.values(values).every((v) => v === null)) continue;

    results.push({ weekDate, values, warnings });
  }

  return results;
}

/**
 * Convert row+col numbers to an Excel-style cell reference (e.g. "A1", "B3").
 */
export function cellRef(row: number, col: number): string {
  let colStr = '';
  let c = col;
  while (c > 0) {
    const mod = (c - 1) % 26;
    colStr = String.fromCharCode(65 + mod) + colStr;
    c = Math.floor((c - 1) / 26);
  }
  return `${colStr}${row}`;
}
