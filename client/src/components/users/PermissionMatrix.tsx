import { useState, useEffect, useMemo } from 'react';
import type { UserRecord } from '../../lib/userApi';

// ─── Page metadata ──────────────────────────────────────────────────────────

interface PageMeta {
  value: string;
  label: string;
  group: 'dashboard' | 'management';
}

const ALL_PAGES: PageMeta[] = [
  { value: 'executive_summary', label: 'Executive Summary', group: 'dashboard' },
  { value: 'financial_deep_dive', label: 'Financial Deep Dive', group: 'dashboard' },
  { value: 'pl_monthly_detail', label: 'P&L Monthly Detail', group: 'dashboard' },
  { value: 'sales_pipeline', label: 'Sales & Pipeline', group: 'dashboard' },
  { value: 'marketing_leads', label: 'Marketing & Leads', group: 'dashboard' },
  { value: 'operations_productivity', label: 'Operations', group: 'dashboard' },
  { value: 'regional_performance', label: 'Regional Performance', group: 'dashboard' },
  { value: 'cash_position', label: 'Cash Position', group: 'dashboard' },
  { value: 'data_management', label: 'Data Management', group: 'management' },
  { value: 'target_management', label: 'Target Management', group: 'management' },
  { value: 'staff_management', label: 'Staff Management', group: 'management' },
  { value: 'admin_settings', label: 'Admin Settings', group: 'management' },
  { value: 'user_permission_management', label: 'User Management', group: 'management' },
];

const PERMISSION_OPTIONS = [
  { value: 'write', label: 'Write' },
  { value: 'read', label: 'Read' },
  { value: 'no_access', label: 'No Access' },
];

// ─── Role defaults (mirrors server logic) ───────────────────────────────────

const ADMIN_ONLY_PAGES = ['admin_settings', 'user_permission_management'];
const STAFF_READABLE_PAGES = ['executive_summary', 'regional_performance'];

function getRoleDefault(role: string, page: string): string {
  if (role === 'super_admin') return 'write';
  if (ADMIN_ONLY_PAGES.includes(page)) return 'no_access';
  if (role === 'staff') {
    return STAFF_READABLE_PAGES.includes(page) ? 'read' : 'no_access';
  }
  // executive and manager
  return 'read';
}

function getAllDefaults(role: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const p of ALL_PAGES) {
    result[p.value] = getRoleDefault(role, p.value);
  }
  return result;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface PermissionMatrixProps {
  user: UserRecord;
  onSave: (userId: number, permissions: Array<{ page: string; permissionLevel: string }>) => void;
  saving: boolean;
}

export default function PermissionMatrix({ user, onSave, saving }: PermissionMatrixProps) {
  // Build initial permission map from user data
  const initialPerms = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of ALL_PAGES) {
      const explicit = user.permissions.find((up) => up.page === p.value);
      map[p.value] = explicit ? explicit.permissionLevel : getRoleDefault(user.role, p.value);
    }
    return map;
  }, [user]);

  // Track which pages have explicit permissions vs role defaults
  const explicitPages = useMemo(() => {
    const set = new Set<string>();
    for (const up of user.permissions) {
      set.add(up.page);
    }
    return set;
  }, [user]);

  const [perms, setPerms] = useState<Record<string, string>>(initialPerms);
  const [dirty, setDirty] = useState(false);

  // Reset when user changes
  useEffect(() => {
    setPerms(initialPerms);
    setDirty(false);
  }, [initialPerms]);

  function handleChange(page: string, level: string) {
    setPerms((prev) => ({ ...prev, [page]: level }));
    setDirty(true);
  }

  function handleResetToDefaults() {
    setPerms(getAllDefaults(user.role));
    setDirty(true);
  }

  function handleSave() {
    const entries = ALL_PAGES.map((p) => ({
      page: p.value,
      permissionLevel: perms[p.value],
    }));
    onSave(user.id, entries);
  }

  const dashboardPages = ALL_PAGES.filter((p) => p.group === 'dashboard');
  const managementPages = ALL_PAGES.filter((p) => p.group === 'management');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-[#1A1A2E]">
            Permissions for {user.displayName}
          </h3>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Configure page-level access. Changes take effect on the user's next request.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetToDefaults}
            className="px-3 py-1.5 text-xs font-medium text-[#6B7280] border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="px-4 py-1.5 text-xs font-medium text-white bg-[#4573D2] rounded-lg hover:bg-[#3b63b8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </div>

      {/* Dashboard Pages group */}
      <div className="mb-6">
        <h4 className="text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-3">
          Dashboard Pages
        </h4>
        <div className="space-y-2">
          {dashboardPages.map((page) => (
            <PermissionRow
              key={page.value}
              page={page}
              value={perms[page.value]}
              isExplicit={explicitPages.has(page.value)}
              isDirty={perms[page.value] !== initialPerms[page.value]}
              onChange={handleChange}
            />
          ))}
        </div>
      </div>

      {/* Management Pages group */}
      <div>
        <h4 className="text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-3">
          Management Pages
        </h4>
        <div className="space-y-2">
          {managementPages.map((page) => (
            <PermissionRow
              key={page.value}
              page={page}
              value={perms[page.value]}
              isExplicit={explicitPages.has(page.value)}
              isDirty={perms[page.value] !== initialPerms[page.value]}
              onChange={handleChange}
            />
          ))}
        </div>
      </div>

      {dirty && (
        <p className="text-xs text-[#E8A442] mt-4">
          You have unsaved changes.
        </p>
      )}
    </div>
  );
}

// ─── Row subcomponent ───────────────────────────────────────────────────────

function PermissionRow({
  page,
  value,
  isExplicit,
  isDirty,
  onChange,
}: {
  page: PageMeta;
  value: string;
  isExplicit: boolean;
  isDirty: boolean;
  onChange: (page: string, level: string) => void;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors ${
        isDirty ? 'bg-[#4573D2]/5' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm text-[#1A1A2E]">{page.label}</span>
        {!isExplicit && !isDirty && (
          <span className="text-[10px] text-[#6B7280] italic">(default)</span>
        )}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(page.value, e.target.value)}
        className={`text-sm border rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#4573D2] focus:border-[#4573D2] ${
          value === 'write'
            ? 'border-[#6AAF50]/30 bg-[#6AAF50]/5 text-[#6AAF50]'
            : value === 'read'
            ? 'border-[#4573D2]/30 bg-[#4573D2]/5 text-[#4573D2]'
            : 'border-[#D94F4F]/30 bg-[#D94F4F]/5 text-[#D94F4F]'
        }`}
      >
        {PERMISSION_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
