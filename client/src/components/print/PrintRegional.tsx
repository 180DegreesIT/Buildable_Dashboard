import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import {
  fetchRegionalPerformance,
  type RegionalPerformanceData,
} from '../../lib/dashboardApi';
import PrintLayout from './PrintLayout';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtAUD(val: number | null | undefined): string {
  if (val == null) return '\u2014';
  return val.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(val: number | null | undefined): string {
  if (val == null) return '\u2014';
  return `${val.toFixed(1)}%`;
}

function formatWeekLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function formatCurrency(val: number) {
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${val.toFixed(0)}`;
}

function getStatusColor(pct: number): string {
  if (pct >= 80) return '#6AAF50';
  if (pct >= 50) return '#E8A442';
  return '#D94F4F';
}

const TEAM_COLORS: Record<string, string> = {
  cairns: '#4573D2', mackay: '#6AAF50', nq_commercial: '#E8A442',
  seq_residential: '#D94F4F', seq_commercial: '#8B5CF6', town_planning: '#EC4899',
  townsville: '#06B6D4', wide_bay: '#F97316', all_in_access: '#10B981',
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '11px' };
const thStyle: React.CSSProperties = {
  padding: '6px 10px', textAlign: 'left', fontSize: '10px',
  fontWeight: 600, color: '#6B7280', textTransform: 'uppercase',
  letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB',
};
const thRight: React.CSSProperties = { ...thStyle, textAlign: 'right' };
const tdStyle: React.CSSProperties = {
  padding: '5px 10px', borderBottom: '1px solid #F3F4F6', color: '#1A1A2E',
};
const tdRight: React.CSSProperties = { ...tdStyle, textAlign: 'right' };
const sectionTitle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: '#1A1A2E', margin: '20px 0 8px 0',
};
const cardStyle: React.CSSProperties = {
  border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px',
  backgroundColor: '#ffffff',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function PrintRegional({ weekEnding }: { weekEnding: string }) {
  const [data, setData] = useState<RegionalPerformanceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRegionalPerformance(weekEnding)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [weekEnding]);

  if (error) {
    return (
      <PrintLayout title="Regional Performance" weekEnding={weekEnding} ready={true}>
        <p style={{ color: '#D94F4F' }}>Error: {error}</p>
      </PrintLayout>
    );
  }

  if (!data) return null;

  const { teams, trend, regionLabels } = data;
  const regions = teams.map(t => t.region);

  // Totals
  const totalTarget = teams.reduce((s, t) => s + t.target, 0);
  const totalActual = teams.reduce((s, t) => s + t.actual, 0);
  const totalVariance = totalActual - totalTarget;
  const totalPct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;

  return (
    <PrintLayout title="Regional Performance" weekEnding={weekEnding} ready={!!data}>
      {/* ── Regional Comparison Table ── */}
      <div style={{ ...cardStyle, marginBottom: '16px' }}>
        <h3 style={{ ...sectionTitle, margin: '0 0 8px 0' }}>Regional Comparison</h3>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Team</th>
              <th style={thRight}>Target</th>
              <th style={thRight}>Actual</th>
              <th style={thRight}>% to Target</th>
              <th style={thRight}>Variance</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.region}>
                <td style={{ ...tdStyle, fontWeight: 500 }}>{team.label}</td>
                <td style={tdRight}>{fmtAUD(team.target)}</td>
                <td style={{ ...tdRight, fontWeight: 500 }}>{fmtAUD(team.actual)}</td>
                <td style={{ ...tdRight, fontWeight: 600, color: getStatusColor(team.percentageToTarget) }}>
                  {fmtPct(team.percentageToTarget)}
                </td>
                <td style={{ ...tdRight, fontWeight: 500, color: team.variance >= 0 ? '#6AAF50' : '#D94F4F' }}>
                  {team.variance >= 0 ? '+' : ''}{fmtAUD(team.variance)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%',
                    backgroundColor: getStatusColor(team.percentageToTarget),
                  }} />
                </td>
              </tr>
            ))}
            {/* Totals row */}
            <tr style={{ borderTop: '2px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
              <td style={{ ...tdStyle, fontWeight: 700 }}>Total</td>
              <td style={{ ...tdRight, fontWeight: 600 }}>{fmtAUD(totalTarget)}</td>
              <td style={{ ...tdRight, fontWeight: 700 }}>{fmtAUD(totalActual)}</td>
              <td style={{ ...tdRight, fontWeight: 700, color: getStatusColor(totalPct) }}>
                {fmtPct(totalPct)}
              </td>
              <td style={{ ...tdRight, fontWeight: 700, color: totalVariance >= 0 ? '#6AAF50' : '#D94F4F' }}>
                {totalVariance >= 0 ? '+' : ''}{fmtAUD(totalVariance)}
              </td>
              <td style={tdStyle} />
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── 13-Week Trend Chart ── */}
      {trend.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: '16px' }}>
          <h3 style={{ ...sectionTitle, margin: '0 0 8px 0' }}>All Teams - 13-Week Trend</h3>
          <LineChart width={1100} height={340} data={trend} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="weekEnding" tickFormatter={formatWeekLabel} tick={{ fontSize: 9, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
            <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 9, fill: '#6B7280' }} axisLine={false} tickLine={false} width={50} />
            <Tooltip
              formatter={(value: any, name: any) => [
                `$${Number(value).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
                regionLabels[String(name)] ?? name,
              ]}
              labelFormatter={(label: any) => formatWeekLabel(String(label))}
            />
            <Legend formatter={(value: string) => regionLabels[value] ?? value} wrapperStyle={{ fontSize: 10 }} />
            {regions.map((region) => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={TEAM_COLORS[region] ?? '#6B7280'}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </div>
      )}
    </PrintLayout>
  );
}
