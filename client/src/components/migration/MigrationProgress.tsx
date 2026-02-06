/**
 * MigrationProgress — Step 2: Real-time progress display via SSE.
 *
 * Shows overall progress bar, current activity, live stats,
 * and phase indicators for each sheet/table being processed.
 */
import { useEffect, useRef, useState } from 'react';
import { useMigrationProgress, type MigrationResult, type ProgressEvent } from '../../lib/migrationApi';

interface Props {
  jobId: string;
  onComplete: (result: MigrationResult) => void;
}

interface PhaseEntry {
  name: string;
  status: 'pending' | 'active' | 'done';
}

export default function MigrationProgress({ jobId, onComplete }: Props) {
  const progress = useMigrationProgress(jobId);
  const [phases, setPhases] = useState<PhaseEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const completedRef = useRef(false);

  // Track which sheets/tables have been processed
  useEffect(() => {
    if (!progress) return;

    if (progress.phase === 'error') {
      setError(progress.message);
      return;
    }

    if (progress.phase === 'complete' && progress.result && !completedRef.current) {
      completedRef.current = true;
      // Mark all phases as done
      setPhases((prev) => prev.map((p) => ({ ...p, status: 'done' as const })));
      // Small delay so user sees the completed state briefly
      setTimeout(() => onComplete(progress.result!), 500);
      return;
    }

    const currentName = progress.sheet || progress.table || progress.message;
    if (!currentName) return;

    setPhases((prev) => {
      const exists = prev.find((p) => p.name === currentName);
      if (exists) {
        // Mark current as active, previous ones as done
        return prev.map((p) => ({
          ...p,
          status: p.name === currentName ? 'active' : p.status === 'active' ? 'done' : p.status,
        }));
      }
      // New phase — mark previous active as done, add new active
      const updated = prev.map((p) => ({
        ...p,
        status: p.status === 'active' ? ('done' as const) : p.status,
      }));
      return [...updated, { name: currentName, status: 'active' as const }];
    });
  }, [progress, onComplete]);

  const percentage = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  // ─── Error state ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#D94F4F]/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#D94F4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[#1A1A2E] mb-2">Import Failed</h3>
        <p className="text-[#6B7280] text-sm mb-6 max-w-md mx-auto">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-[#4573D2] hover:bg-[#3a63b8] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ─── Progress display ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Overall progress */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-[#1A1A2E]">Importing Data</h2>
          <span className="text-sm font-medium text-[#4573D2]">{percentage}%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-[#4573D2] rounded-full transition-all duration-300 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Current activity */}
        {progress && (
          <div className="mt-4 flex items-center gap-2 text-sm text-[#6B7280]">
            <svg className="animate-spin w-4 h-4 text-[#4573D2]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span>{progress.message}</span>
          </div>
        )}
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Records Processed"
          value={progress?.current ?? 0}
          total={progress?.total ?? 0}
          colour="#4573D2"
        />
        <StatCard
          label="Warnings Found"
          value={progress?.warnings ?? 0}
          colour={progress && progress.warnings > 0 ? '#E8A442' : '#6AAF50'}
        />
      </div>

      {/* Phase indicators */}
      {phases.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">Processing Steps</h3>
          <div className="space-y-3">
            {phases.map((phase) => (
              <div key={phase.name} className="flex items-center gap-3">
                <PhaseIndicator status={phase.status} />
                <span className={`text-sm ${
                  phase.status === 'active'
                    ? 'text-[#1A1A2E] font-medium'
                    : phase.status === 'done'
                    ? 'text-[#6AAF50]'
                    : 'text-[#6B7280]'
                }`}>
                  {phase.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  total,
  colour,
}: {
  label: string;
  value: number;
  total?: number;
  colour: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">{label}</p>
      <p className="mt-2 text-2xl font-semibold" style={{ color: colour }}>
        {value.toLocaleString()}
        {total != null && total > 0 && (
          <span className="text-base font-normal text-[#6B7280]"> / {total.toLocaleString()}</span>
        )}
      </p>
    </div>
  );
}

function PhaseIndicator({ status }: { status: 'pending' | 'active' | 'done' }) {
  if (status === 'done') {
    return (
      <div className="w-5 h-5 rounded-full bg-[#6AAF50]/10 flex items-center justify-center flex-shrink-0">
        <svg className="w-3.5 h-3.5 text-[#6AAF50]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  if (status === 'active') {
    return (
      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
        <svg className="animate-spin w-4 h-4 text-[#4573D2]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
      <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
    </div>
  );
}
