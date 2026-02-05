const BASE = '/api/v1/uploads';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DataTypeDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  targetTable: string;
  fixedFields: Record<string, string>;
  fields: FieldDefinition[];
}

export interface FieldDefinition {
  dbField: string;
  label: string;
  type: string;
  required: boolean;
}

export interface ParseResult {
  fileName: string;
  fileSize: number;
  headers: string[];
  columns: { name: string; inferredType: string; sampleValues: string[] }[];
  totalRows: number;
  previewRows: Record<string, string>[];
  delimiter: string;
  encoding: string;
}

export interface AutoMapResult {
  autoMapped: boolean;
  mappingId?: number;
  mappingName?: string;
  score?: number;
  mapping?: Record<string, string>;
  matchedHeaders?: string[];
  missingHeaders?: string[];
  unmappedCsvHeaders?: string[];
  message: string;
}

export interface RowValidation {
  rowIndex: number;
  status: 'pass' | 'warning' | 'error';
  messages: string[];
  data: Record<string, any>;
  original: Record<string, string>;
}

export interface ApplyMappingResult {
  dataType: { id: string; name: string; targetTable: string };
  fixedFields: Record<string, string>;
  fieldMappings: any[];
  rows: RowValidation[];
  summary: { total: number; passed: number; warnings: number; errors: number; blankSkipped: number };
  duplicates: { weekEnding: string; rowIndex: number; existsInDb: boolean }[];
}

export interface ImportResult {
  uploadId: number;
  status: 'completed' | 'failed';
  rowsProcessed: number;
  rowsFailed: number;
  rowsSkipped: number;
  rowsInserted: number;
  rowsUpdated: number;
  errors: { rowIndex: number; messages: string[] }[];
}

export interface UploadRecord {
  id: number;
  fileName: string;
  dataType: string;
  mappingId: number | null;
  rowsProcessed: number;
  rowsFailed: number;
  rowsSkipped: number;
  status: string;
  errorLog: any;
  rollbackData: any;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
  mapping: { name: string } | null;
}

export interface SavedMapping {
  id: number;
  name: string;
  dataType: string;
  mapping: Record<string, string>;
  createdAt: string;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export async function fetchDataTypes(): Promise<{ dataTypes: DataTypeDefinition[]; grouped: Record<string, DataTypeDefinition[]> }> {
  return request(`${BASE}/data-types`);
}

export async function parseFile(file: File): Promise<ParseResult> {
  const form = new FormData();
  form.append('file', file);
  return request(`${BASE}/parse`, { method: 'POST', body: form });
}

export async function autoMap(dataTypeId: string, csvHeaders: string[]): Promise<AutoMapResult> {
  return request(`${BASE}/auto-map`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataTypeId, csvHeaders }),
  });
}

export async function applyMapping(
  dataTypeId: string,
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): Promise<ApplyMappingResult> {
  return request(`${BASE}/apply-mapping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataTypeId, rows, mapping }),
  });
}

export async function importData(params: {
  dataTypeId: string;
  fileName: string;
  mappingId?: number;
  rows: RowValidation[];
  duplicateStrategy: 'overwrite' | 'skip' | 'merge';
}): Promise<ImportResult> {
  return request(`${BASE}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function fetchHistory(filters?: {
  dataType?: string;
  status?: string;
  from?: string;
  to?: string;
}): Promise<UploadRecord[]> {
  const params = new URLSearchParams();
  if (filters?.dataType) params.set('dataType', filters.dataType);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  const qs = params.toString();
  return request(`${BASE}/history${qs ? '?' + qs : ''}`);
}

export async function rollbackUpload(id: number): Promise<{ uploadId: number; rowsDeleted: number; rowsRestored: number }> {
  return request(`${BASE}/${id}/rollback`, { method: 'POST' });
}

export async function saveMapping(name: string, dataType: string, mapping: Record<string, string>): Promise<SavedMapping> {
  return request(`${BASE}/mappings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, dataType, mapping }),
  });
}

export async function fetchMappings(): Promise<SavedMapping[]> {
  return request(`${BASE}/mappings`);
}
