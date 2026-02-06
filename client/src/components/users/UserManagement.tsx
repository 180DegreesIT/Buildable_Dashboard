import { useState, useEffect, useCallback } from 'react';
import {
  fetchUsers,
  updateUserRole,
  updateUserPermissions,
  toggleUserStatus,
  createUser,
  type UserRecord,
} from '../../lib/userApi';
import UserTable from './UserTable';
import PermissionMatrix from './PermissionMatrix';
import RoleConfirmDialog from './RoleConfirmDialog';

export default function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [saving, setSaving] = useState(false);

  // Role change dialog state
  const [roleChangeTarget, setRoleChangeTarget] = useState<{
    user: UserRecord;
    newRole: string;
  } | null>(null);

  // Create user form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createData, setCreateData] = useState({ email: '', displayName: '', role: 'staff' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const data = await fetchUsers();
      setUsers(data);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Keep selectedUser in sync after refresh
  useEffect(() => {
    if (selectedUser) {
      const updated = users.find((u) => u.id === selectedUser.id);
      if (updated) setSelectedUser(updated);
    }
  }, [users]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handleSelectUser(user: UserRecord) {
    setSelectedUser((prev) => (prev?.id === user.id ? null : user));
  }

  function handleRoleChange(user: UserRecord, newRole: string) {
    if (user.role === newRole) return;
    setRoleChangeTarget({ user, newRole });
  }

  async function handleRoleConfirm(applyDefaults: boolean) {
    if (!roleChangeTarget) return;
    const { user, newRole } = roleChangeTarget;
    setRoleChangeTarget(null);

    try {
      await updateUserRole(user.id, newRole, applyDefaults);
      await loadUsers();
    } catch (err: any) {
      setError(err.message ?? 'Failed to update role');
    }
  }

  async function handlePermissionSave(
    userId: number,
    permissions: Array<{ page: string; permissionLevel: string }>
  ) {
    setSaving(true);
    try {
      await updateUserPermissions(userId, permissions);
      await loadUsers();
    } catch (err: any) {
      setError(err.message ?? 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(user: UserRecord) {
    try {
      await toggleUserStatus(user.id, !user.isActive);
      await loadUsers();
    } catch (err: any) {
      setError(err.message ?? 'Failed to update status');
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      await createUser(createData);
      setCreateData({ email: '', displayName: '', role: 'staff' });
      setShowCreateForm(false);
      await loadUsers();
    } catch (err: any) {
      setCreateError(err.message ?? 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1A1A2E]">User Management</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Manage users, roles, and page-level permissions
          </p>
        </div>
        {import.meta.env.DEV && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#4573D2] rounded-lg hover:bg-[#3b63b8] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create User
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-[#D94F4F]/10 border border-[#D94F4F]/20 rounded-lg">
          <span className="text-sm text-[#D94F4F]">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-[#D94F4F] hover:text-[#c43e3e] text-sm"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create user form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-[#1A1A2E] mb-4">Create Test User</h3>
          <form onSubmit={handleCreateUser} className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-[#6B7280] mb-1">
                Display Name
              </label>
              <input
                type="text"
                required
                value={createData.displayName}
                onChange={(e) => setCreateData((d) => ({ ...d, displayName: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-[#4573D2] focus:ring-1 focus:ring-[#4573D2] outline-none"
                placeholder="April Smith"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-[#6B7280] mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={createData.email}
                onChange={(e) => setCreateData((d) => ({ ...d, email: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-[#4573D2] focus:ring-1 focus:ring-[#4573D2] outline-none"
                placeholder="april@buildable.com.au"
              />
            </div>
            <div className="min-w-[140px]">
              <label className="block text-xs font-medium text-[#6B7280] mb-1">
                Role
              </label>
              <select
                value={createData.role}
                onChange={(e) => setCreateData((d) => ({ ...d, role: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-[#4573D2] focus:ring-1 focus:ring-[#4573D2] outline-none bg-white"
              >
                <option value="super_admin">Super Admin</option>
                <option value="executive">Executive</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-white bg-[#6AAF50] rounded-lg hover:bg-[#5d9a46] disabled:opacity-50 transition-colors"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreateForm(false); setCreateError(null); }}
                className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#1A1A2E] transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
          {createError && (
            <p className="mt-3 text-sm text-[#D94F4F]">{createError}</p>
          )}
        </div>
      )}

      {/* User table */}
      <UserTable
        users={users}
        onSelectUser={handleSelectUser}
        onRoleChange={handleRoleChange}
        onToggleStatus={handleToggleStatus}
        selectedUserId={selectedUser?.id}
      />

      {/* Permission matrix (shown when a user is selected) */}
      {selectedUser && (
        <PermissionMatrix
          user={selectedUser}
          onSave={handlePermissionSave}
          saving={saving}
        />
      )}

      {/* Role change confirmation dialog */}
      <RoleConfirmDialog
        isOpen={roleChangeTarget !== null}
        userName={roleChangeTarget?.user.displayName ?? ''}
        newRole={roleChangeTarget?.newRole ?? ''}
        onConfirm={handleRoleConfirm}
        onCancel={() => setRoleChangeTarget(null)}
      />
    </div>
  );
}
