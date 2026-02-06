/**
 * API client for validation endpoints.
 * Provides typed access to the validation suite for the admin dashboard.
 */

const BASE = '/api/v1/validation';

async function request<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? body?.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidationCheck {
  id: string;
  category: string;
  weekEnding: string;
  field: string;
  expected: number;
  actual: number | null;
  difference: number;
  passed: boolean;
  note?: string;
}

export interface CategorySummary {
  passed: number;
  failed: number;
  total: number;
}

export interface ValidationResult {
  runAt: string;
  duration: number;
  totalChecks: number;
  passed: number;
  failed: number;
  checks: ValidationCheck[];
  summary: {
    byCategory: Record<string, CategorySummary>;
    byWeek: Record<string, CategorySummary>;
  };
}

export interface PageBenchmark {
  page: string;
  url: string;
  loadTimeMs: number;
  passed: boolean;
  target: number;
}

export interface BenchmarkResult {
  runAt: string;
  allPassed: boolean;
  pages: PageBenchmark[];
}

export interface RoundTripField {
  field: string;
  original: number;
  exported: string;
  reimported: number;
  passed: boolean;
}

export interface RoundTripResult {
  weekEnding: string;
  fields: RoundTripField[];
  allPassed: boolean;
  error?: string;
}

export interface TargetWorkflowStep {
  step: string;
  passed: boolean;
  detail: string;
}

export interface TargetWorkflowResult {
  steps: TargetWorkflowStep[];
  allPassed: boolean;
}

export interface FullValidationResult {
  dataValidation: ValidationResult;
  csvRoundTrip: RoundTripResult;
  targetWorkflow: TargetWorkflowResult;
  performance: BenchmarkResult;
  overallPassed: boolean;
  summary: string;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export async function runFullValidation(): Promise<FullValidationResult> {
  return request(`${BASE}/full`);
}

export async function runDataValidation(): Promise<ValidationResult> {
  return request(`${BASE}/run`);
}

export async function runBenchmark(): Promise<BenchmarkResult> {
  return request(`${BASE}/benchmark`);
}

export async function getReference(): Promise<any> {
  return request(`${BASE}/reference`);
}
