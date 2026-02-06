import { useState, useMemo } from 'react';
import type { UserRecord } from '../../lib/userApi';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  executive: 'Executive',
  manager: 'Manager',
  staff: 'Staff',
};

const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'executive', label: 'Executive' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
];

type SortField = 'displayName' | 'email' | 'role' | 'isActive' | 'lastLogin';
type SortDir = 'asc' | 'desc';

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

const ITEMS_PER_PAGE = 10;

interface UserTableProps {
  users: UserRecord[];
  onSelectUser: (user: UserRecord) => void;
  onRoleChange: (user: UserRecord, newRole: string) => void;
  onToggleStatus: (user: UserRecord) => void;
  selectedUserId?: number;
}

export default function UserTable({
  users,
  onSelectUser,
  onRoleChange,
  onToggleStatus,
  selectedUserId,
}: UserTableProps) {
  const [sortField, setSortField] = useState<SortField>('displayName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkRoleOpen, setBulkRoleOpen] = useState(false);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(0);
  }

  const sorted = useMemo(() => {
    const copy = [...users];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'displayName':
          cmp = a.displayName.localeCompare(b.displayName);
          break;
        case 'email':
          cmp = a.email.localeCompare(b.email);
          break;
        case 'role':
          cmp = a.role.localeCompare(b.role);
          break;
        case 'isActive':
          cmp = Number(b.isActive) - Number(a.isActive);
          break;
        case 'lastLogin':
          cmp =
            (a.lastLogin ?? '').localeCompare(b.lastLogin ?? '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [users, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paged = sorted.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === paged.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paged.map((u) => u.id)));
    }
  }

  function handleBulkRole(role: string) {
    setBulkRoleOpen(false);
    const selectedUsers = users.filter((u) => selected.has(u.id));
    selectedUsers.forEach((u) => onRoleChange(u, role));
    setSelected(new Set());
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">&#x2195;</span>;
    return (
      <span className="text-[#4573D2] ml-1">
        {sortDir === 'asc' ? '\u2191' : '\u2193'}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Bulk action toolbar */}
      {selected.size >= 2 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-[#4573D2]/5 border-b border-gray-200">
          <span className="text-sm text-[#4573D2] font-medium">
            {selected.size} user{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="relative">
            <button
              onClick={() => setBulkRoleOpen(!bulkRoleOpen)}
              className="px-3 py-1.5 text-xs font-medium bg-[#4573D2] text-white rounded-lg hover:bg-[#3b63b8] transition-colors"
            >
              Set Role
            </button>
            {bulkRoleOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[140px]">
                {ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleBulkRole(opt.value)}
                    className="block w-full text-left px-3 py-1.5 text-sm text-[#1A1A2E] hover:bg-gray-50"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-[#6B7280] hover:text-[#1A1A2E] transition-colors ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
            <th className="px-4 py-3 w-10">
              <input
                type="checkbox"
                checked={paged.length > 0 && selected.size === paged.length}
                onChange={toggleSelectAll}
                className="rounded border-gray-300 text-[#4573D2] focus:ring-[#4573D2]"
              />
            </th>
            <th
              className="px-4 py-3 cursor-pointer select-none"
              onClick={() => handleSort('displayName')}
            >
              Name <SortIcon field="displayName" />
            </th>
            <th
              className="px-4 py-3 cursor-pointer select-none"
              onClick={() => handleSort('email')}
            >
              Email <SortIcon field="email" />
            </th>
            <th
              className="px-4 py-3 cursor-pointer select-none"
              onClick={() => handleSort('role')}
            >
              Role <SortIcon field="role" />
            </th>
            <th
              className="px-4 py-3 cursor-pointer select-none"
              onClick={() => handleSort('isActive')}
            >
              Status <SortIcon field="isActive" />
            </th>
            <th
              className="px-4 py-3 cursor-pointer select-none"
              onClick={() => handleSort('lastLogin')}
            >
              Last Login <SortIcon field="lastLogin" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {paged.map((user) => {
            const isSelected = user.id === selectedUserId;
            return (
              <tr
                key={user.id}
                onClick={() => onSelectUser(user)}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[#4573D2]/5'
                    : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(user.id)}
                    onChange={() => toggleSelect(user.id)}
                    className="rounded border-gray-300 text-[#4573D2] focus:ring-[#4573D2]"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#4573D2]/10 text-[#4573D2] flex items-center justify-center text-xs font-bold shrink-0">
                      {getInitials(user.displayName)}
                    </div>
                    <span className="text-sm font-medium text-[#1A1A2E] truncate">
                      {user.displayName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-[#6B7280] truncate max-w-[200px]">
                  {user.email}
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={user.role}
                    onChange={(e) => onRoleChange(user, e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-[#1A1A2E] focus:border-[#4573D2] focus:ring-1 focus:ring-[#4573D2] outline-none"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onToggleStatus(user)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      user.isActive
                        ? 'bg-[#6AAF50]/10 text-[#6AAF50]'
                        : 'bg-gray-100 text-[#6B7280]'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        user.isActive ? 'bg-[#6AAF50]' : 'bg-gray-400'
                      }`}
                    />
                    {user.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3 text-sm text-[#6B7280]">
                  {formatDate(user.lastLogin)}
                </td>
              </tr>
            );
          })}
          {paged.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#6B7280]">
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <span className="text-xs text-[#6B7280]">
            Showing {page * ITEMS_PER_PAGE + 1}–{Math.min((page + 1) * ITEMS_PER_PAGE, sorted.length)} of{' '}
            {sorted.length} users
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-[#6B7280] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-[#6B7280] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
