const BASE = '/api/v1/settings';

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

export interface BrandingSettings {
  companyName: string;
  logoPath: string | null;
  primaryColour: string;
  accentColour: string;
}

export interface AlertThreshold {
  metric: string;
  label: string;
  direction: 'below' | 'above';
  warningValue: number;
  criticalValue: number;
  unit: 'currency' | 'percentage';
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export async function fetchAllSettings(): Promise<Record<string, any>> {
  return request(`${BASE}`);
}

export async function updateBranding(data: {
  companyName: string;
  primaryColour: string;
  accentColour: string;
}): Promise<any> {
  return request(`${BASE}/branding`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function uploadLogo(file: File): Promise<{ logoPath: string }> {
  const form = new FormData();
  form.append('logo', file);
  return request(`${BASE}/branding/logo`, {
    method: 'POST',
    body: form,
  });
}

export async function deleteLogo(): Promise<void> {
  return request(`${BASE}/branding/logo`, {
    method: 'DELETE',
  });
}

export async function updatePassThroughCategories(categories: string[]): Promise<any> {
  return request(`${BASE}/pass-through-categories`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories }),
  });
}

export async function updateAlertThresholds(thresholds: AlertThreshold[]): Promise<any> {
  return request(`${BASE}/alert-thresholds`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ thresholds }),
  });
}
