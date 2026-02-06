import { useState, useEffect, useCallback } from 'react';
import { useWeek } from '../../lib/WeekContext';
import {
  fetchCurrentTargets,
  fetchTargetHistory,
  type Target,
  type TargetWithHistory,
  type TargetType,
  type Region,
  TARGET_TYPE_LABELS,
  TARGET_TYPE_GROUPS,
  REGION_LABELS,
  ALL_REGIONS,
} from '../../lib/targetApi';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import EmptyState from '../ui/EmptyState';
import ExportButtons from '../ui/ExportButtons';
import TargetEditModal from './TargetEditModal';
import BulkTeamUpdate from './BulkTeamUpdate';
import TargetHistory from './TargetHistory';
import { downloadCsv, type CsvColumn, AUD_FORMATTER, DATE_FORMATTER_AU } from '../../lib/csvExport';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtAUD(val: number | string | null): string {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (num == null || isNaN(num)) return '—';
  return num.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getTargetLabel(target: Target): string {
  if (target.targetType === 'team_revenue' && target.entity) {
    return REGION_LABELS[target.entity] ?? target.entity;
  }
  return TARGET_TYPE_LABELS[target.targetType] ?? target.targetType;
}

// ─── Component ────────────────────────────────────────────────────────────────

type Tab = 'current' | 'history';

export default function TargetManagement() {
  const { selectedWeek, loading: weekLoading } = useWeek();
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('current');

  // Modal state
  const [editTarget, setEditTarget] = useState<Target | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);

  // History state
  const [historyType, setHistoryType] = useState<TargetType | null>(null);
  const [historyEntity, setHistoryEntity] = useState<Region | undefined>(undefined);
  const [historyData, setHistoryData] = useState<TargetWithHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadTargets = useCallback(async () => {
    if (!selectedWeek) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCurrentTargets(selectedWeek);
      setTargets(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedWeek]);

  useEffect(() => { loadTargets(); }, [loadTargets]);

  // Load history when tab switches or type changes
  useEffect(() => {
    if (activeTab !== 'history' || !historyType) return;
    let cancelled = false;
    setHistoryLoading(true);
    fetchTargetHistory(historyType, historyEntity)
      .then((data) => { if (!cancelled) setHistoryData(data); })
      .catch(() => { if (!cancelled) setHistoryData([]); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, historyType, historyEntity]);

  const handleCsvExport = useCallback(() => {
    const columns: CsvColumn<Target>[] = [
      {
        key: 'targetType',
        label: 'Target Type',
        format: (v, row) => {
          if (row.targetType === 'team_revenue' && row.entity) {
            return REGION_LABELS[row.entity] ?? row.entity;
          }
          return TARGET_TYPE_LABELS[v as TargetType] ?? v;
        },
      },
      { key: 'amount', label: 'Amount (Weekly $)', format: (v) => AUD_FORMATTER(v) },
      { key: 'effectiveFrom', label: 'Effective From', format: (v) => DATE_FORMATTER_AU(v) },
      { key: 'effectiveTo', label: 'Effective To', format: (v) => DATE_FORMATTER_AU(v) },
      { key: 'setBy', label: 'Set By', format: (v) => v ?? '' },
      { key: 'notes', label: 'Notes', format: (v) => v ?? '' },
    ];
    downloadCsv(`targets-${selectedWeek}`, columns, targets);
  }, [targets, selectedWeek]);

  function handleSaved() {
    setEditTarget(null);
    setShowCreate(false);
    setShowBulkUpdate(false);
    loadTargets();
  }

  // Group targets by type group
  function getGroupedTargets() {
    return TARGET_TYPE_GROUPS.map((group) => {
      const groupTargets: Target[] = [];
      for (const type of group.types) {
        if (type === 'team_revenue') {
          // Show all 9 regions
          for (const region of ALL_REGIONS) {
            const t = targets.find((t) => t.targetType === 'team_revenue' && t.entity === region);
            if (t) groupTargets.push(t);
          }
        } else {
          const t = targets.find((t) => t.targetType === type && !t.entity);
          if (t) groupTargets.push(t);
        }
      }
      return { ...group, targets: groupTargets };
    });
  }

  if (weekLoading || loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  if (error) return <EmptyState title="Error loading targets" message={error} />;

  const grouped = getGroupedTargets();

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1A1A2E]">Target Management</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Manage targets for net profit, revenue, and team performance. Week ending {fmtDate(selectedWeek)}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButtons
            disabled={targets.length === 0}
            onCsvExport={handleCsvExport}
            pageSlug="targets"
            weekEnding={selectedWeek}
          />
          <button
            onClick={() => setShowBulkUpdate(true)}
            className="px-4 py-2 text-sm font-medium text-[#4573D2] bg-[#4573D2]/10 rounded-lg hover:bg-[#4573D2]/20 transition-colors"
          >
            Bulk Update Teams
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-[#4573D2] rounded-lg hover:bg-[#3A62B5] transition-colors"
          >
            + New Target
          </button>
        </div>
      </div>

      {/* ── Tab nav ── */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setActiveTab('current')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'current'
              ? 'bg-[#4573D2]/10 text-[#4573D2]'
              : 'text-[#6B7280] hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Current Targets
        </button>
        <button
          onClick={() => {
            setActiveTab('history');
            if (!historyType) setHistoryType('net_profit');
          }}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-[#4573D2]/10 text-[#4573D2]'
              : 'text-[#6B7280] hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Change History
        </button>
      </div>

      {/* ── Current Targets ── */}
      {activeTab === 'current' && (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.label}>
              <h2 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider mb-3">
                {group.label}
              </h2>

              {group.targets.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center text-sm text-[#6B7280]">
                  No targets set for this category. Click "New Target" to create one.
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Target</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Amount (Weekly)</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Effective From</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Set By</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Notes</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {group.targets.map((target) => (
                          <tr key={target.id} className="hover:bg-gray-50/50">
                            <td className="px-6 py-3">
                              <span className="font-medium text-[#1A1A2E]">{getTargetLabel(target)}</span>
                            </td>
                            <td className="px-6 py-3 text-right">
                              <span className="font-semibold text-[#1A1A2E]">{fmtAUD(target.amount)}</span>
                            </td>
                            <td className="px-6 py-3 text-[#6B7280]">{fmtDate(target.effectiveFrom)}</td>
                            <td className="px-6 py-3 text-[#6B7280]">{target.setBy ?? '—'}</td>
                            <td className="px-6 py-3 text-[#6B7280] max-w-[200px] truncate">{target.notes ?? '—'}</td>
                            <td className="px-6 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setEditTarget(target)}
                                  className="text-xs font-medium text-[#4573D2] hover:text-[#3A62B5] hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    setHistoryType(target.targetType);
                                    setHistoryEntity(target.entity ?? undefined);
                                    setActiveTab('history');
                                  }}
                                  className="text-xs font-medium text-[#6B7280] hover:text-gray-900 hover:underline"
                                >
                                  History
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── History Tab ── */}
      {activeTab === 'history' && (
        <TargetHistory
          selectedType={historyType}
          selectedEntity={historyEntity}
          data={historyData}
          loading={historyLoading}
          onChangeType={(type) => { setHistoryType(type); setHistoryEntity(undefined); }}
          onChangeEntity={setHistoryEntity}
        />
      )}

      {/* ── Edit Modal ── */}
      {editTarget && (
        <TargetEditModal
          mode="edit"
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {/* ── Create Modal ── */}
      {showCreate && (
        <TargetEditModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={handleSaved}
        />
      )}

      {/* ── Bulk Update Modal ── */}
      {showBulkUpdate && (
        <BulkTeamUpdate
          currentTargets={targets.filter((t) => t.targetType === 'team_revenue')}
          onClose={() => setShowBulkUpdate(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
