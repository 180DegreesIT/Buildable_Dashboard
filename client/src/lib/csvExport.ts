/**
 * Client-side CSV export utility with Australian formatting conventions.
 * RFC 4180 compliant, produces Excel-compatible files with UTF-8 BOM.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CsvColumn<T = any> {
  key: string;
  label: string;
  format?: (value: any, row: T) => string;
}

// ─── Formatters for Australian Conventions ────────────────────────────────────

/** Format currency as plain number (e.g. 1234.56) so Excel can handle it */
export const AUD_FORMATTER = (val: number | string | null | undefined): string => {
  if (val == null) return '';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '';
  return num.toFixed(2);
};

/** Format date as DD/MM/YYYY Australian format */
export const DATE_FORMATTER_AU = (val: string | null | undefined): string => {
  if (!val) return '';
  const d = new Date(val + (val.includes('T') ? '' : 'T00:00:00'));
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

/** Format percentage (e.g. 65.2%) */
export const PCT_FORMATTER = (val: number | null | undefined): string => {
  if (val == null) return '';
  return `${val.toFixed(1)}%`;
};

/** Format plain number (no decimals, no currency symbol) */
export const NUM_FORMATTER = (val: number | null | undefined): string => {
  if (val == null) return '';
  return String(val);
};

// ─── RFC 4180 CSV Escape ──────────────────────────────────────────────────────

function escapeCsvValue(value: string): string {
  // If value contains comma, double quote, or newline, wrap in double quotes
  // and escape any double quotes by doubling them
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ─── CSV Download ─────────────────────────────────────────────────────────────

/**
 * Generate and download a CSV file.
 *
 * @param filename - The filename for the download (will append .csv if needed)
 * @param columns - Column definitions with keys, labels, and optional formatters
 * @param data - Array of data rows
 */
export function downloadCsv<T extends Record<string, any>>(
  filename: string,
  columns: CsvColumn<T>[],
  data: T[],
): void {
  // Build header row
  const headerRow = columns.map((col) => escapeCsvValue(col.label)).join(',');

  // Build data rows
  const dataRows = data.map((row) => {
    return columns
      .map((col) => {
        const rawValue = row[col.key];
        const formatted = col.format
          ? col.format(rawValue, row)
          : rawValue != null
            ? String(rawValue)
            : '';
        return escapeCsvValue(formatted);
      })
      .join(',');
  });

  // Join with CRLF line endings (RFC 4180)
  const csvContent = [headerRow, ...dataRows].join('\r\n');

  // Prepend UTF-8 BOM for Excel compatibility
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Ensure filename ends with .csv
  const safeName = filename.endsWith('.csv') ? filename : `${filename}.csv`;

  // Trigger download via anchor element
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
