import Papa from 'papaparse';
import { WeekService } from './WeekService.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InferredType = 'date' | 'currency' | 'integer' | 'decimal' | 'percentage' | 'text';

export type RowStatus = 'pass' | 'warning' | 'error';

export interface ColumnInfo {
  name: string;
  inferredType: InferredType;
  sampleValues: string[];
}

export interface RowValidation {
  rowIndex: number;
  status: RowStatus;
  messages: string[];
  data: Record<string, any>;
  original: Record<string, string>;
}

export interface ParseResult {
  headers: string[];
  columns: ColumnInfo[];
  totalRows: number;
  previewRows: Record<string, string>[];
  delimiter: string;
  encoding: string;
}

export interface ValidationResult {
  rows: RowValidation[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    errors: number;
    blankSkipped: number;
  };
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Strip BOM (byte order mark) from the start of a string.
 */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

/**
 * Detect the delimiter by sampling the first few lines.
 */
function detectDelimiter(text: string): string {
  const firstLines = text.split('\n').slice(0, 5).join('\n');
  const counts: Record<string, number> = { ',': 0, '\t': 0, ';': 0 };

  for (const char of firstLines) {
    if (char in counts) counts[char]++;
  }

  // Return the most frequent delimiter
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ',';
}

/**
 * Parse a CSV file buffer into structured data.
 */
export function parseCsv(buffer: Buffer): ParseResult {
  let text = buffer.toString('utf-8');
  text = stripBom(text);

  const delimiter = detectDelimiter(text);

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    delimiter,
    skipEmptyLines: false, // We handle blank rows ourselves
    transformHeader: (h) => h.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  const allRows = parsed.data;

  // Filter out completely blank rows for column inference
  const nonBlankRows = allRows.filter((row) =>
    Object.values(row).some((v) => v != null && v.trim() !== '')
  );

  // Infer types for each column
  const columns: ColumnInfo[] = headers.map((name) => {
    const sampleValues = nonBlankRows
      .slice(0, 20)
      .map((row) => row[name] ?? '')
      .filter((v) => v.trim() !== '');

    return {
      name,
      inferredType: inferType(sampleValues),
      sampleValues: sampleValues.slice(0, 5),
    };
  });

  // Preview: first 10 non-blank rows
  const previewRows = nonBlankRows.slice(0, 10);

  return {
    headers,
    columns,
    totalRows: allRows.length,
    previewRows,
    delimiter: delimiter === '\t' ? 'tab' : delimiter,
    encoding: 'utf-8',
  };
}

// ─── Type Inference ───────────────────────────────────────────────────────────

const CURRENCY_REGEX = /^-?\$?\s*[\d,]+\.?\d*$/;
const PERCENTAGE_REGEX = /^-?\d+\.?\d*\s*%$/;
const DECIMAL_WITH_FRACTION_REGEX = /^-?\d+\.\d+$/;
const INTEGER_REGEX = /^-?\d+$/;
const AU_DATE_REGEX = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Infer the most likely data type from a set of sample values.
 */
function inferType(samples: string[]): InferredType {
  if (samples.length === 0) return 'text';

  const checks = samples.map((v) => {
    const trimmed = v.trim();
    if (AU_DATE_REGEX.test(trimmed) || ISO_DATE_REGEX.test(trimmed)) return 'date';
    if (PERCENTAGE_REGEX.test(trimmed)) return 'percentage';
    if (CURRENCY_REGEX.test(trimmed) && trimmed.includes('$')) return 'currency';
    // Check for currency-like values (with commas but no $)
    if (/^-?[\d,]+\.\d{2}$/.test(trimmed) && trimmed.includes(',')) return 'currency';
    if (DECIMAL_WITH_FRACTION_REGEX.test(trimmed)) return 'decimal';
    if (INTEGER_REGEX.test(trimmed)) return 'integer';
    return 'text';
  });

  // Pick the most common non-text type, or text if no clear winner
  const counts = new Map<string, number>();
  for (const t of checks) {
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }

  // If > 50% agree on a type, use it
  for (const [type, count] of counts) {
    if (type !== 'text' && count / samples.length > 0.5) {
      return type as InferredType;
    }
  }

  // Integer/decimal ambiguity: if we have both, prefer decimal
  if (counts.has('integer') && counts.has('decimal')) return 'decimal';

  return 'text';
}

// ─── Value Cleaning ───────────────────────────────────────────────────────────

/**
 * Parse an Australian DD/MM/YYYY or ISO date string into a Date.
 */
export function parseDate(value: string): Date | null {
  const trimmed = value.trim();

  // ISO format: YYYY-MM-DD
  if (ISO_DATE_REGEX.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  // Australian format: DD/MM/YYYY or D/M/YY
  if (AU_DATE_REGEX.test(trimmed)) {
    const parts = trimmed.split('/');
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
    let year = parseInt(parts[2], 10);

    // Handle 2-digit years
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }

    const d = new Date(Date.UTC(year, month, day));
    // Validate the date is real
    if (d.getUTCDate() !== day || d.getUTCMonth() !== month) return null;
    return d;
  }

  return null;
}

/**
 * Strip currency formatting and parse as a number.
 * Handles: $1,234.56  -$1,234  $1234  1,234.56  ($1,234)
 */
export function parseCurrency(value: string): number | null {
  let cleaned = value.trim();

  // Handle parenthetical negatives: ($1,234) → -1234
  const isNegParen = /^\(.*\)$/.test(cleaned);
  if (isNegParen) {
    cleaned = cleaned.slice(1, -1);
  }

  // Strip $, spaces, commas
  cleaned = cleaned.replace(/[\$\s,]/g, '');

  if (isNegParen && !cleaned.startsWith('-')) {
    cleaned = '-' + cleaned;
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse a percentage value and normalise to decimal.
 * "54%" → 0.54, "0.54" → 0.54, "54.5%" → 0.545
 */
export function parsePercentage(value: string): number | null {
  const trimmed = value.trim();

  if (trimmed.endsWith('%')) {
    const num = parseFloat(trimmed.replace('%', ''));
    return isNaN(num) ? null : num / 100;
  }

  const num = parseFloat(trimmed);
  if (isNaN(num)) return null;

  // If the value is > 1, assume it's a whole percentage (54 → 0.54)
  // If <= 1, assume it's already a decimal (0.54 → 0.54)
  return num > 1 ? num / 100 : num;
}

/**
 * Parse a numeric value (integer or decimal), stripping any formatting.
 */
export function parseNumeric(value: string): number | null {
  let cleaned = value.trim().replace(/[\s,]/g, '');

  // Handle parenthetical negatives
  if (/^\([\d.]+\)$/.test(cleaned)) {
    cleaned = '-' + cleaned.slice(1, -1);
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface FieldMapping {
  csvHeader: string;
  dbField: string;
  expectedType: InferredType;
  required: boolean;
}

/**
 * Validate and transform parsed CSV rows using a field mapping.
 * Returns row-level validation results with cleaned data.
 */
export function validateRows(
  rows: Record<string, string>[],
  mappings: FieldMapping[],
  weekEndingField?: string,
): ValidationResult {
  let blankSkipped = 0;
  const validatedRows: RowValidation[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Check for blank row
    const isBlank = Object.values(row).every((v) => v == null || v.trim() === '');
    if (isBlank) {
      blankSkipped++;
      continue;
    }

    const messages: string[] = [];
    let status: RowStatus = 'pass';
    const data: Record<string, any> = {};

    for (const mapping of mappings) {
      const rawValue = row[mapping.csvHeader] ?? '';
      const trimmed = rawValue.trim();

      // Required field check
      if (mapping.required && trimmed === '') {
        messages.push(`Required field "${mapping.csvHeader}" is empty`);
        status = 'error';
        continue;
      }

      // Skip empty optional fields
      if (trimmed === '') {
        data[mapping.dbField] = null;
        continue;
      }

      // Type-specific parsing and validation
      switch (mapping.expectedType) {
        case 'date': {
          const parsed = parseDate(trimmed);
          if (!parsed) {
            messages.push(`"${mapping.csvHeader}": cannot parse "${trimmed}" as a date`);
            status = 'error';
            break;
          }

          // Auto-correct to Saturday if this is a week_ending field
          if (mapping.dbField === weekEndingField || mapping.dbField === 'weekEnding') {
            const validation = WeekService.validateWeekEnding(parsed.toISOString().split('T')[0]);
            if (!validation.valid) {
              messages.push(`"${mapping.csvHeader}": ${validation.error}`);
              status = 'error';
            } else if (validation.corrected) {
              messages.push(`"${mapping.csvHeader}": auto-corrected to Saturday ${validation.date!.toISOString().split('T')[0]}`);
              if (status !== 'error') status = 'warning';
              data[mapping.dbField] = validation.date;
            } else {
              data[mapping.dbField] = validation.date;
            }
          } else {
            data[mapping.dbField] = parsed;
          }
          break;
        }

        case 'currency': {
          const parsed = parseCurrency(trimmed);
          if (parsed === null) {
            messages.push(`"${mapping.csvHeader}": cannot parse "${trimmed}" as currency`);
            status = 'error';
          } else {
            data[mapping.dbField] = parsed;
          }
          break;
        }

        case 'percentage': {
          const parsed = parsePercentage(trimmed);
          if (parsed === null) {
            messages.push(`"${mapping.csvHeader}": cannot parse "${trimmed}" as percentage`);
            status = 'error';
          } else {
            data[mapping.dbField] = parsed;
          }
          break;
        }

        case 'integer': {
          const parsed = parseNumeric(trimmed);
          if (parsed === null) {
            messages.push(`"${mapping.csvHeader}": cannot parse "${trimmed}" as a number`);
            status = 'error';
          } else {
            data[mapping.dbField] = Math.round(parsed);
          }
          break;
        }

        case 'decimal': {
          const parsed = parseNumeric(trimmed);
          if (parsed === null) {
            messages.push(`"${mapping.csvHeader}": cannot parse "${trimmed}" as a number`);
            status = 'error';
          } else {
            data[mapping.dbField] = parsed;
          }
          break;
        }

        case 'text':
        default:
          data[mapping.dbField] = trimmed;
          break;
      }
    }

    validatedRows.push({
      rowIndex: i + 1, // 1-based for user-facing display
      status,
      messages,
      data,
      original: row,
    });
  }

  const passed = validatedRows.filter((r) => r.status === 'pass').length;
  const warnings = validatedRows.filter((r) => r.status === 'warning').length;
  const errors = validatedRows.filter((r) => r.status === 'error').length;

  return {
    rows: validatedRows,
    summary: {
      total: validatedRows.length,
      passed,
      warnings,
      errors,
      blankSkipped,
    },
  };
}

// ─── Duplicate Detection ──────────────────────────────────────────────────────

export interface DuplicateInfo {
  weekEnding: string;
  rowIndex: number;
  existsInDb: boolean;
}

/**
 * Check which week_ending values in the validated rows already exist in a table.
 */
export async function detectDuplicates(
  rows: RowValidation[],
  weekEndingField: string,
  existingWeeks: Date[],
): Promise<DuplicateInfo[]> {
  const existingSet = new Set(existingWeeks.map((d) => d.toISOString().split('T')[0]));
  const duplicates: DuplicateInfo[] = [];

  for (const row of rows) {
    const weekVal = row.data[weekEndingField];
    if (!weekVal) continue;

    const weekStr = weekVal instanceof Date
      ? weekVal.toISOString().split('T')[0]
      : new Date(weekVal).toISOString().split('T')[0];

    if (existingSet.has(weekStr)) {
      duplicates.push({
        weekEnding: weekStr,
        rowIndex: row.rowIndex,
        existsInDb: true,
      });
    }
  }

  return duplicates;
}
