const BASE = '/api/v1/xero';

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

export interface XeroStatus {
  connected: boolean;
  tenantName?: string;
  lastSyncAt?: string | null;
  mockMode: boolean;
  schedulerRunning: boolean;
}

export interface XeroSyncLogEntry {
  id: number;
  syncType: string;
  weekEnding: string;
  status: string;
  recordCount: number;
  errorLog: unknown | null;
  startedAt: string;
  completedAt: string | null;
}

export interface SyncResult {
  success: boolean;
  syncResults: XeroSyncLogEntry[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export async function fetchXeroStatus(): Promise<XeroStatus> {
  return request(`${BASE}/status`);
}

export async function connectXero(): Promise<{ url: string }> {
  return request(`${BASE}/connect`);
}

export async function disconnectXero(): Promise<{ success: boolean }> {
  return request(`${BASE}/disconnect`, { method: 'POST' });
}

export async function triggerXeroSync(weekEnding?: string): Promise<SyncResult> {
  return request(`${BASE}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weekEnding }),
  });
}

export async function fetchSyncLogs(): Promise<XeroSyncLogEntry[]> {
  return request(`${BASE}/sync-logs`);
}

export async function startXeroScheduler(cronExpression?: string): Promise<{ running: boolean; cronExpression: string }> {
  return request(`${BASE}/scheduler/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cronExpression }),
  });
}

export async function stopXeroScheduler(): Promise<{ running: boolean }> {
  return request(`${BASE}/scheduler/stop`, { method: 'POST' });
}
