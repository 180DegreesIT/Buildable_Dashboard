import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import { fetchExecutiveSummary, type ExecutiveSummaryData } from '../../lib/dashboardApi';
import PrintLayout from './PrintLayout';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtAUD(val: number | null | undefined): string {
  if (val == null) return '\u2014';
  return val.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtAUD2(val: number | null | undefined): string {
  if (val == null) return '\u2014';
  return val.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(val: number | null | undefined): string {
  if (val == null) return '\u2014';
  return `${val.toFixed(1)}%`;
}

function fmtNum(val: number | null | undefined): string {
  if (val == null) return '\u2014';
  return val.toLocaleString('en-AU');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatWeekLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function formatCurrency(val: number) {
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${val.toFixed(0)}`;
}

function getBarColor(pct: number): string {
  if (pct >= 80) return '#6AAF50';
  if (pct >= 50) return '#E8A442';
  return '#D94F4F';
}

const LEAD_SOURCE_LABELS: Record<string, string> = {
  google: 'Google', seo: 'SEO', meta: 'Meta',
  bing: 'Bing', tiktok: 'TikTok', other: 'Other',
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: '11px',
};
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

export default function PrintExecutiveSummary({ weekEnding }: { weekEnding: string }) {
  const [data, setData] = useState<ExecutiveSummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExecutiveSummary(weekEnding)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [weekEnding]);

  if (error) {
    return (
      <PrintLayout title="Executive Summary" weekEnding={weekEnding} ready={true}>
        <p style={{ color: '#D94F4F' }}>Error: {error}</p>
      </PrintLayout>
    );
  }

  if (!data) return null;

  const { kpis, projectSummary, salesSummary, leadBreakdown, reviews, teamPerformance, trends } = data;
  const sorted = [...teamPerformance].sort((a, b) => b.percentageToTarget - a.percentageToTarget);

  return (
    <PrintLayout title="Executive Summary" weekEnding={weekEnding} ready={!!data}>
      {/* ── KPI Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
        <KPIBox label="Net Profit" value={fmtAUD(kpis.netProfit.actual)} sub={`Budget: ${fmtAUD(kpis.netProfit.budget)}`} />
        <KPIBox label="Revenue (Invoiced)" value={fmtAUD(kpis.revenueInvoiced.actual)} />
        <KPIBox label="Revenue (P&L)" value={fmtAUD(kpis.revenuePL.actual)} />
        <KPIBox label="Gross Profit Margin" value={fmtPct(kpis.grossProfitMargin.actual)} />
        <KPIBox label="Revenue to Staff %" value={fmtPct(kpis.revenueToStaffRatio.actual)} />
        <KPIBox label="Total Leads" value={fmtNum(kpis.totalLeads.actual)} sub={`Avg cost: ${fmtAUD2(kpis.totalLeads.avgCostPerLead)}`} />
        <KPIBox label="Total Cash" value={fmtAUD(kpis.totalCashAvailable.actual)} />
        {reviews && (
          <KPIBox label="Google Reviews" value={String(reviews.reviewCount)} sub={reviews.averageRating != null ? `${reviews.averageRating.toFixed(1)} avg` : undefined} />
        )}
      </div>

      {/* ── Charts Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {/* Net Profit Trend */}
        <div style={cardStyle}>
          <h3 style={{ ...sectionTitle, margin: '0 0 8px 0' }}>Net Profit Trend (13 Weeks)</h3>
          <LineChart width={480} height={220} data={trends.netProfit} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="weekEnding" tickFormatter={formatWeekLabel} tick={{ fontSize: 9, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
            <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 9, fill: '#6B7280' }} axisLine={false} tickLine={false} width={50} />
            <Tooltip formatter={(value: any, name: any) => [`$${Number(value).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, name === 'netProfit' ? 'Net Profit' : 'Budget']} />
            <Line type="monotone" dataKey="netProfit" stroke="#4573D2" strokeWidth={2} dot={{ r: 2, fill: '#4573D2' }} isAnimationActive={false} />
            <Line type="monotone" dataKey="budget" stroke="#6B7280" strokeWidth={1.5} strokeDasharray="6 3" dot={false} isAnimationActive={false} />
          </LineChart>
        </div>

        {/* Revenue by Category */}
        <div style={cardStyle}>
          <h3 style={{ ...sectionTitle, margin: '0 0 8px 0' }}>Revenue by Category (13 Weeks)</h3>
          <BarChart width={480} height={220} data={trends.revenueByCategory} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="weekEnding" tickFormatter={formatWeekLabel} tick={{ fontSize: 9, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
            <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 9, fill: '#6B7280' }} axisLine={false} tickLine={false} width={50} />
            <Tooltip formatter={(value: any, name: any) => [`$${Number(value).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, capitalize(String(name))]} />
            <Legend formatter={(v: string) => capitalize(v)} wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="residential" stackId="rev" fill="#4573D2" isAnimationActive={false} />
            <Bar dataKey="commercial" stackId="rev" fill="#6AAF50" isAnimationActive={false} />
            <Bar dataKey="retrospective" stackId="rev" fill="#E8A442" isAnimationActive={false} />
          </BarChart>
        </div>
      </div>

      {/* ── Regional Performance Chart ── */}
      <div style={{ ...cardStyle, marginBottom: '20px' }}>
        <h3 style={{ ...sectionTitle, margin: '0 0 8px 0' }}>Regional Team Performance vs Target</h3>
        <BarChart width={960} height={280} data={sorted} layout="vertical" margin={{ top: 5, right: 50, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
          <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 9, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 9, fill: '#6B7280' }} axisLine={false} tickLine={false} width={100} />
          <Tooltip formatter={(value: any) => [`$${Number(value).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`]} />
          <Bar dataKey="target" fill="#E5E7EB" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false} />
          <Bar dataKey="actual" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
            {sorted.map((entry, idx) => (
              <Cell key={idx} fill={getBarColor(entry.percentageToTarget)} />
            ))}
          </Bar>
        </BarChart>
      </div>

      {/* ── Tables Row: Project Summary + Sales Pipeline ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div style={cardStyle}>
          <h3 style={{ ...sectionTitle, margin: '0 0 8px 0' }}>Project Summary</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Type</th>
                <th style={thRight}>Projects</th>
                <th style={thRight}>Invoiced</th>
                <th style={thRight}>Target</th>
                <th style={thRight}>% to Target</th>
                <th style={thRight}>New Biz %</th>
              </tr>
            </thead>
            <tbody>
              {projectSummary.map((row) => (
                <tr key={row.type}>
                  <td style={tdStyle}>{capitalize(row.type)}</td>
                  <td style={tdRight}>{row.hyperfloCount}</td>
                  <td style={tdRight}>{fmtAUD(row.xeroInvoiced)}</td>
                  <td style={tdRight}>{fmtAUD(row.target)}</td>
                  <td style={{ ...tdRight, color: getBarColor(row.percentageToTarget), fontWeight: 600 }}>{fmtPct(row.percentageToTarget)}</td>
                  <td style={tdRight}>{row.newBusinessPercentage != null ? fmtPct(row.newBusinessPercentage) : '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={cardStyle}>
          <h3 style={{ ...sectionTitle, margin: '0 0 8px 0' }}>Sales Pipeline</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Type</th>
                <th style={thRight}>Issued #</th>
                <th style={thRight}>Issued $</th>
                <th style={thRight}>Won #</th>
                <th style={thRight}>Won $</th>
                <th style={thRight}>Win Rate</th>
              </tr>
            </thead>
            <tbody>
              {salesSummary.map((row) => (
                <tr key={row.type}>
                  <td style={tdStyle}>{capitalize(row.type)}</td>
                  <td style={tdRight}>{row.issuedCount}</td>
                  <td style={tdRight}>{fmtAUD(row.issuedValue)}</td>
                  <td style={tdRight}>{row.wonCount}</td>
                  <td style={tdRight}>{fmtAUD(row.wonValue)}</td>
                  <td style={{ ...tdRight, color: '#4573D2', fontWeight: 600 }}>{fmtPct(row.winRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Lead Sources ── */}
      {leadBreakdown.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h3 style={{ ...sectionTitle, margin: '0 0 8px 0' }}>Lead Sources</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Source</th>
                <th style={thRight}>Leads</th>
                <th style={thRight}>Cost / Lead</th>
                <th style={thRight}>Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {leadBreakdown.map((row) => (
                <tr key={row.source}>
                  <td style={tdStyle}>{LEAD_SOURCE_LABELS[row.source] ?? row.source}</td>
                  <td style={tdRight}>{fmtNum(row.leadCount)}</td>
                  <td style={tdRight}>{fmtAUD2(row.costPerLead)}</td>
                  <td style={tdRight}>{fmtAUD2(row.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PrintLayout>
  );
}

// ─── KPI Box ────────────────────────────────────────────────────────────────

function KPIBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      border: '1px solid #E5E7EB', borderRadius: '8px',
      padding: '10px 12px', backgroundColor: '#ffffff',
    }}>
      <p style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: '18px', fontWeight: 700, color: '#1A1A2E', margin: '4px 0 0 0' }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: '10px', color: '#6B7280', margin: '2px 0 0 0' }}>{sub}</p>
      )}
    </div>
  );
}
