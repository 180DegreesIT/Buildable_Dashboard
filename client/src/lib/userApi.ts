const BASE = '/api/v1/users';

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

export interface UserPermissionEntry {
  id: number;
  page: string;
  permissionLevel: string;
}

export interface UserRecord {
  id: number;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  permissions: UserPermissionEntry[];
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export async function fetchUsers(): Promise<UserRecord[]> {
  return request(`${BASE}`);
}

export async function fetchUser(userId: number): Promise<UserRecord> {
  return request(`${BASE}/${userId}`);
}

export async function updateUserRole(
  userId: number,
  role: string,
  applyDefaults: boolean
): Promise<UserRecord> {
  return request(`${BASE}/${userId}/role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, applyDefaults }),
  });
}

export async function updateUserPermissions(
  userId: number,
  permissions: Array<{ page: string; permissionLevel: string }>
): Promise<UserRecord> {
  return request(`${BASE}/${userId}/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions }),
  });
}

export async function toggleUserStatus(
  userId: number,
  isActive: boolean
): Promise<UserRecord> {
  return request(`${BASE}/${userId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive }),
  });
}

export async function createUser(data: {
  email: string;
  displayName: string;
  role?: string;
}): Promise<UserRecord> {
  return request(`${BASE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
