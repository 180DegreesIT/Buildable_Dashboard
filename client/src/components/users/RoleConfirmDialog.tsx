import { useEffect, useRef } from 'react';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  executive: 'Executive',
  manager: 'Manager',
  staff: 'Staff',
};

interface RoleConfirmDialogProps {
  isOpen: boolean;
  userName: string;
  newRole: string;
  onConfirm: (applyDefaults: boolean) => void;
  onCancel: () => void;
}

export default function RoleConfirmDialog({
  isOpen,
  userName,
  newRole,
  onConfirm,
  onCancel,
}: RoleConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const roleLabel = ROLE_LABELS[newRole] ?? newRole;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6"
      >
        <h3 className="text-lg font-semibold text-[#1A1A2E] mb-2">
          Change Role
        </h3>
        <p className="text-sm text-[#6B7280] mb-6">
          Change <span className="font-medium text-[#1A1A2E]">{userName}</span>'s
          role to <span className="font-medium text-[#1A1A2E]">{roleLabel}</span>?
        </p>

        <div className="space-y-3 mb-6">
          <button
            onClick={() => onConfirm(true)}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-[#4573D2] hover:bg-[#3b63b8] transition-colors"
          >
            Apply Default Permissions
          </button>
          <p className="text-xs text-[#6B7280] -mt-1 ml-1">
            This will replace all current permissions with the defaults for {roleLabel}.
          </p>

          <button
            onClick={() => onConfirm(false)}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-[#1A1A2E] bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Keep Current Permissions
          </button>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#1A1A2E] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
