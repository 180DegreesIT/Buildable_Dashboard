import { useState, useEffect, useCallback } from 'react';
import { useWeek } from '../../lib/WeekContext';
import {
  fetchRegionalPerformance,
  type RegionalPerformanceData,
  type RegionalTeam,
} from '../../lib/dashboardApi';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import EmptyState from '../ui/EmptyState';
import ExportButtons from '../ui/ExportButtons';
import RegionalTrendChart from './RegionalTrendChart';
import { downloadCsv, type CsvColumn, AUD_FORMATTER, PCT_FORMATTER } from '../../lib/csvExport';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtAUD(val: number | null | undefined): string {
  if (val == null) return '—';
  return val.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(val: number | null | undefined): string {
  if (val == null) return '—';
  return `${val.toFixed(1)}%`;
}

function formatWeekDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function colorClass(color: string): string {
  if (color === 'green') return 'text-[#6AAF50]';
  if (color === 'amber') return 'text-[#E8A442]';
  return 'text-[#D94F4F]';
}

function bgColorClass(color: string): string {
  if (color === 'green') return 'bg-[#6AAF50]/10 border-[#6AAF50]/20';
  if (color === 'amber') return 'bg-[#E8A442]/10 border-[#E8A442]/20';
  return 'bg-[#D94F4F]/10 border-[#D94F4F]/20';
}

function dotColor(color: string): string {
  if (color === 'green') return 'bg-[#6AAF50]';
  if (color === 'amber') return 'bg-[#E8A442]';
  return 'bg-[#D94F4F]';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RegionalPerformance() {
  const { selectedWeek, loading: weekLoading } = useWeek();
  const [data, setData] = useState<RegionalPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedWeek) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setSelectedRegion(null);

    fetchRegionalPerformance(selectedWeek)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [selectedWeek]);

  const handleCsvExport = useCallback(() => {
    if (!data) return;
    const columns: CsvColumn<RegionalTeam>[] = [
      { key: 'label', label: 'Team' },
      { key: 'target', label: 'Target ($)', format: (v) => AUD_FORMATTER(v) },
      { key: 'actual', label: 'Actual ($)', format: (v) => AUD_FORMATTER(v) },
      { key: 'percentageToTarget', label: '% to Target', format: (v) => PCT_FORMATTER(v) },
      { key: 'variance', label: 'Variance ($)', format: (v) => AUD_FORMATTER(v) },
    ];
    downloadCsv(`regional-performance-${selectedWeek}`, columns, data.teams);
  }, [data, selectedWeek]);

  if (weekLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
              <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
              <div className="h-6 w-24 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-16 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
        <LoadingSkeleton variant="chart" />
        <LoadingSkeleton variant="table" count={5} />
      </div>
    );
  }

  if (error) return <EmptyState title="Error loading data" message={error} />;
  if (!data || !data.hasData) {
    return <EmptyState title="No data available" message="There is no regional performance data for the selected week." />;
  }

  const { teams, trend, regionLabels, drillDown } = data;
  const regions = teams.map(t => t.region);
  const selected = selectedRegion ? teams.find(t => t.region === selectedRegion) : null;

  return (
    <div data-loaded="true" className="space-y-6">
      {/* ── Page Header with Export ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1A1A2E]">Regional Performance</h1>
        <ExportButtons
          disabled={!data}
          onCsvExport={handleCsvExport}
          pageSlug="regional"
          weekEnding={selectedWeek}
        />
      </div>

      {/* ── Region Card Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {teams.map((team) => (
          <button
            key={team.region}
            onClick={() => setSelectedRegion(
              selectedRegion === team.region ? null : team.region
            )}
            className={`text-left rounded-xl border p-5 transition-all ${
              selectedRegion === team.region
                ? 'ring-2 ring-[#4573D2] border-[#4573D2]/30 bg-white shadow-md'
                : `${bgColorClass(team.color)} hover:shadow-sm`
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2.5 h-2.5 rounded-full ${dotColor(team.color)}`} />
              <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider truncate">
                {team.label}
              </span>
            </div>
            <p className="text-xl font-bold text-[#1A1A2E]">{fmtAUD(team.actual)}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-[#6B7280]">Target: {fmtAUD(team.target)}</span>
              <span className={`text-xs font-semibold ${colorClass(team.color)}`}>
                {fmtPct(team.percentageToTarget)}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* ── Trend Chart ── */}
      <RegionalTrendChart
        data={trend}
        regions={regions}
        regionLabels={regionLabels}
        selectedRegion={selectedRegion}
      />

      {/* ── Comparison Table ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1A1A2E]">Regional Comparison</h3>
          {selectedRegion && (
            <button
              onClick={() => setSelectedRegion(null)}
              className="text-xs text-[#4573D2] hover:underline"
            >
              Show all teams
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Team</th>
                <th className="px-6 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Target</th>
                <th className="px-6 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Actual</th>
                <th className="px-6 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">% to Target</th>
                <th className="px-6 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(selectedRegion ? teams.filter(t => t.region === selectedRegion) : teams).map((team) => (
                <tr
                  key={team.region}
                  className={`cursor-pointer hover:bg-gray-50 ${
                    selectedRegion === team.region ? 'bg-[#4573D2]/5' : ''
                  }`}
                  onClick={() => setSelectedRegion(
                    selectedRegion === team.region ? null : team.region
                  )}
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${dotColor(team.color)}`} />
                      <span className="font-medium text-[#1A1A2E]">{team.label}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right text-[#6B7280]">{fmtAUD(team.target)}</td>
                  <td className="px-6 py-3 text-right font-medium text-[#1A1A2E]">{fmtAUD(team.actual)}</td>
                  <td className={`px-6 py-3 text-right font-semibold ${colorClass(team.color)}`}>
                    {fmtPct(team.percentageToTarget)}
                  </td>
                  <td className={`px-6 py-3 text-right font-medium ${
                    team.variance >= 0 ? 'text-[#6AAF50]' : 'text-[#D94F4F]'
                  }`}>
                    {team.variance >= 0 ? '+' : ''}{fmtAUD(team.variance)}
                  </td>
                </tr>
              ))}
              {/* Totals row (only when showing all) */}
              {!selectedRegion && (
                <TotalsRow teams={teams} />
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Drill-Down: Weekly Detail ── */}
      {selectedRegion && selected && drillDown[selectedRegion] && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[#1A1A2E]">
              {selected.label} — Weekly Detail
            </h3>
          </div>
          {drillDown[selectedRegion].length === 0 ? (
            <div className="p-8 text-center text-[#6B7280] text-sm">No weekly data available.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Week Ending</th>
                    <th className="px-6 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Target</th>
                    <th className="px-6 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Actual</th>
                    <th className="px-6 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">% to Target</th>
                    <th className="px-6 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {drillDown[selectedRegion].map((row) => {
                    const variance = row.actual - row.target;
                    const rowColor = row.pct >= 80 ? 'green' : row.pct >= 50 ? 'amber' : 'red';
                    return (
                      <tr key={row.weekEnding}>
                        <td className="px-6 py-2.5 text-[#1A1A2E]">{formatWeekDate(row.weekEnding)}</td>
                        <td className="px-6 py-2.5 text-right text-[#6B7280]">{fmtAUD(row.target)}</td>
                        <td className="px-6 py-2.5 text-right font-medium text-[#1A1A2E]">{fmtAUD(row.actual)}</td>
                        <td className={`px-6 py-2.5 text-right font-semibold ${colorClass(rowColor)}`}>
                          {fmtPct(row.pct)}
                        </td>
                        <td className={`px-6 py-2.5 text-right font-medium ${
                          variance >= 0 ? 'text-[#6AAF50]' : 'text-[#D94F4F]'
                        }`}>
                          {variance >= 0 ? '+' : ''}{fmtAUD(variance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Totals Row ───────────────────────────────────────────────────────────────

function TotalsRow({ teams }: { teams: RegionalTeam[] }) {
  const totalTarget = teams.reduce((s, t) => s + t.target, 0);
  const totalActual = teams.reduce((s, t) => s + t.actual, 0);
  const totalVariance = totalActual - totalTarget;
  const totalPct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
  const totalColor = totalPct >= 80 ? 'green' : totalPct >= 50 ? 'amber' : 'red';

  return (
    <tr className="bg-gray-50 font-semibold">
      <td className="px-6 py-3 text-[#1A1A2E]">Total</td>
      <td className="px-6 py-3 text-right text-[#6B7280]">{fmtAUD(totalTarget)}</td>
      <td className="px-6 py-3 text-right text-[#1A1A2E]">{fmtAUD(totalActual)}</td>
      <td className={`px-6 py-3 text-right ${colorClass(totalColor)}`}>{fmtPct(totalPct)}</td>
      <td className={`px-6 py-3 text-right ${totalVariance >= 0 ? 'text-[#6AAF50]' : 'text-[#D94F4F]'}`}>
        {totalVariance >= 0 ? '+' : ''}{fmtAUD(totalVariance)}
      </td>
    </tr>
  );
}
