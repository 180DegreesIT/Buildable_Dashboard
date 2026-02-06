/**
 * Migration API client — upload workbook, trigger import, subscribe to SSE progress.
 */
import { useState, useEffect } from 'react';

const BASE = '/api/v1/migration';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DryRunTable {
  tableName: string;
  recordCount: number;
  sampleRecords: Array<Record<string, any>>;
  warnings: string[];
}

export interface DryRunResult {
  jobId: string;
  fileName: string;
  tables: DryRunTable[];
  totalRecords: number;
  totalWarnings: number;
  allWarnings: string[];
}

export interface MigrationTableResult {
  tableName: string;
  inserted: number;
  updated: number;
  warnings: string[];
}

export interface MigrationResult {
  success: boolean;
  tables: MigrationTableResult[];
  totalInserted: number;
  totalUpdated: number;
  totalWarnings: number;
  allWarnings: string[];
}

export interface ProgressEvent {
  phase: 'parsing' | 'importing' | 'complete' | 'error';
  sheet?: string;
  table?: string;
  current: number;
  total: number;
  warnings: number;
  message: string;
  result?: MigrationResult; // Present when phase === 'complete'
}

// ─── API Calls ────────────────────────────────────────────────────────────────

/**
 * Upload an .xlsx workbook and get a dry-run preview.
 */
export async function uploadWorkbook(file: File): Promise<DryRunResult> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Upload failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Start the actual import for a previously uploaded workbook.
 * Returns immediately; subscribe to SSE for progress.
 */
export async function startImport(jobId: string): Promise<{ status: string; jobId: string }> {
  const res = await fetch(`${BASE}/import/${jobId}`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Import failed: ${res.status}`);
  }
  return res.json();
}

// ─── SSE Hook ─────────────────────────────────────────────────────────────────

/**
 * React hook to subscribe to real-time migration progress via SSE.
 * Returns the latest ProgressEvent, or null if not connected.
 */
export function useMigrationProgress(jobId: string | null): ProgressEvent | null {
  const [progress, setProgress] = useState<ProgressEvent | null>(null);

  useEffect(() => {
    if (!jobId) {
      setProgress(null);
      return;
    }

    const source = new EventSource(`${BASE}/progress/${jobId}`);

    source.onmessage = (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data);
        setProgress(data);
      } catch {
        // Ignore malformed events
      }
    };

    source.onerror = () => {
      // EventSource will attempt to reconnect automatically.
      // If the server has closed the connection (complete/error phase),
      // EventSource will fail to reconnect and we can close it.
      source.close();
    };

    return () => {
      source.close();
    };
  }, [jobId]);

  return progress;
}
