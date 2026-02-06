import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea,
} from 'recharts';
import {
  fetchFinancialDeepDive,
  type FinancialDeepDiveData,
  type PLWeekly,
  type PLMonthly,
} from '../../lib/dashboardApi';
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

function monthLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
}

function formatWeekLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

// ─── P&L Row Builder ────────────────────────────────────────────────────────

interface PLRow {
  label: string;
  value: number | null;
  bold?: boolean;
  indent?: boolean;
  divider?: boolean;
}

function buildPLRows(pl: PLWeekly | PLMonthly): PLRow[] {
  return [
    { label: 'Total Trading Income', value: pl.totalTradingIncome, bold: true },
    { label: 'Cost of Sales', value: pl.totalCostOfSales, indent: true },
    { label: 'Gross Profit', value: pl.grossProfit, bold: true, divider: true },
    { label: 'Other Income', value: pl.otherIncome, indent: true },
    { label: 'Operating Expenses', value: pl.operatingExpenses, indent: true },
    { label: 'Wages & Salaries', value: pl.wagesAndSalaries, indent: true },
    { label: 'Net Profit', value: pl.netProfit, bold: true, divider: true },
    { label: 'Budget', value: pl.budget },
    { label: '% Profit', value: pl.profitPercentage },
    { label: 'Revenue to Staff Ratio', value: pl.revenueToStaffRatio },
  ];
}

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

export default function PrintFinancial({ weekEnding }: { weekEnding: string }) {
  const [data, setData] = useState<FinancialDeepDiveData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFinancialDeepDive(weekEnding)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [weekEnding]);

  if (error) {
    return (
      <PrintLayout title="Financial Deep Dive" weekEnding={weekEnding} ready={true}>
        <p style={{ color: '#D94F4F' }}>Error: {error}</p>
      </PrintLayout>
    );
  }

  if (!data) return null;

  const { plWeekly, plMonthly, revenueBreakdown, revenueComparison, costAnalysisTrend, cashPosition, agedReceivables } = data;

  return (
    <PrintLayout title="Financial Deep Dive" weekEnding={weekEnding} ready={!!data}>
      {/* ── P&L Weekly Summary ── */}
      {plWeekly && (
        <div style={{ ...cardStyle, marginBottom: '16px' }}>
          <h3 style={{ ...sectionTitle, margin: '0 0 8px 0' }}>Profit & Loss - Weekly</h3>
          <table style={tableStyle}>
            <tbody>
              {buildPLRows(plWeekly).map((row, i) => (
                <tr key={i} style={{ borderTop: row.divider ? '2px solid #E5E7EB' : '1px solid #F3F4F6' }}>
                  <td style={{
                    ...tdStyle,
                    fontWeight: row.bold ? 600 : 400,
                    paddingLeft: row.indent ? '28px' : '10px',
                    color: row.bold ? '#1A1A2E' : '#6B7280',
                  }}>
                    {row.label}
                  </td>
                  <td style={{
                    ...tdRight,
                    fontWeight: row.bold ? 600 : 400,
                  }}>
                    {row.label === '% Profit' || row.label === 'Revenue to Staff Ratio'
                      ? fmtPct(row.value)
                      : fmtAUD2(row.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── P&L Monthly Summary ── */}
      {plMonthly.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: '16px' }}>
          <h3 style={{ ...sectionTitle, margin: '0 0 8px 0' }}>Profit & Loss - Monthly</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Month</th>
                <th style={thRight}>Income</th>
                <th style={thRight}>Cost of Sales</th>
                <th style={thRight}>Gross Profit</th>
                <th style={thRight}>Wages</th>
                <th style={thRight}>Net Profit</th>
                <th style={thRight}>Budget</th>
                <th style={thRight}>% Profit</th>
                <th style={thRight}>Staff %</th>
              </tr>
            </thead>
            <tbody>
              {plMonthly.map((m) => (
                <tr key={m.month}>
                  <td style={tdStyle}>{monthLabel(m.month)}</td>
                  <td style={tdRight}>{fmtAUD(m.totalTradingIncome)}</td>
                  <td style={tdRight}>{fmtAUD(m.totalCostOfSales)}</td>
                  <td style={tdRight}>{fmtAUD(m.grossProfit)}</td>
                  <td style={tdRight}>{fmtAUD(m.wagesAndSalaries)}</td>
                  <td style={{ ...tdRight, fontWeight: 600, color: m.netProfit >= 0 ? '#6AAF50' : '#D94F4F' }}>
                    {fmtAUD(m.netProfit)}
                  </td>
                  <td style={tdRight}>{fmtAUD(m.budget)}</td>
                  <td style={tdRight}>{fmtPct(m.profitPercentage)}</td>
                  <td style={{ ...tdRight, fontWeight: 500, color: m.revenueToStaffRatio <= 55 ? '#6AAF50' : m.revenueToStaffRatio <= 65 ? '#E8A442' : '#D94F4F' }}>
                    {fmtPct(m.revenueToStaffRatio)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Revenue Comparison ── */}
      <div style={{ ...cardStyle, marginBottom: '16px' }}>
        <h3 style={{ ...sectionTitle, margin: '0 0 8px 0' }}>Revenue Comparison</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', margin: 0 }}>Revenue (Invoiced)</p>
            <p style={{ fontSize: '18px', fontWeight: 700, color: '#1A1A2E', margin: '4px 0 0 0' }}>{fmtAUD(revenueComparison.invoiced)}</p>
          </div>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', margin: 0 }}>Revenue (P&L)</p>
            <p style={{ fontSize: '18px', fontWeight: 700, color: '#1A1A2E', margin: '4px 0 0 0' }}>{fmtAUD(revenueComparison.pl)}</p>
          </div>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', margin: 0 }}>Variance</p>
            <p style={{ fontSize: '18px', fontWeight: 700, color: (revenueComparison.variance ?? 0) >= 0 ? '#6AAF50' : '#D94F4F', margin: '4px 0 0 0' }}>
              {fmtAUD(revenueComparison.variance)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Revenue Category Breakdown ── */}
      <div style={{ ...cardStyle, marginBottom: '16px' }}>
        <h3 style={{ ...sectionTitle, margin: '0 0 8px 0' }}>Revenue by Income Category</h3>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Category</th>
              <th style={thRight}>Amount</th>
              <th style={thRight}>% of Total</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Type</th>
            </tr>
          </thead>
          <tbody>
            {revenueBreakdown.categories.map((cat) => {
              const pct = revenueBreakdown.grossTotal > 0 ? (cat.amount / revenueBreakdown.grossTotal) * 100 : 0;
              return (
                <tr key={cat.category} style={{ backgroundColor: cat.isPassThrough ? '#FAFAFA' : undefined }}>
                  <td style={tdStyle}>{cat.label}</td>
                  <td style={tdRight}>{fmtAUD2(cat.amount)}</td>
                  <td style={tdRight}>{fmtPct(pct)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontSize: '10px', color: '#6B7280' }}>
                    {cat.isPassThrough ? 'Pass-through' : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Cost Analysis Chart ── */}
      {costAnalysisTrend.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: '16px' }}>
          <h3 style={{ ...sectionTitle, margin: '0 0 8px 0' }}>Revenue to Staff Ratio Trend</h3>
          <LineChart width={1100} height={220} data={costAnalysisTrend} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <ReferenceArea y1={55} y2={65} fill="#6AAF50" fillOpacity={0.1} />
            <XAxis dataKey="weekEnding" tickFormatter={formatWeekLabel} tick={{ fontSize: 9, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
            <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 9, fill: '#6B7280' }} axisLine={false} tickLine={false} width={50} />
            <Tooltip formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Staff Ratio']} />
            <Line type="monotone" dataKey="revenueToStaffRatio" stroke="#4573D2" strokeWidth={2} dot={{ r: 2, fill: '#4573D2' }} isAnimationActive={false} />
          </LineChart>
        </div>
      )}

      {/* ── Cash Position + Aged Receivables ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={cardStyle}>
          <h3 style={{ ...sectionTitle, margin: '0 0 8px 0' }}>Cash Position</h3>
          {cashPosition ? (
            <table style={tableStyle}>
              <tbody>
                {[
                  { label: 'Everyday Account', value: cashPosition.everydayAccount },
                  { label: 'Overdraft Limit', value: cashPosition.overdraftLimit },
                  { label: 'Tax Savings', value: cashPosition.taxSavings },
                  { label: 'Capital Account', value: cashPosition.capitalAccount },
                  { label: 'Credit Cards', value: cashPosition.creditCards },
                ].map(({ label, value }) => (
                  <tr key={label}>
                    <td style={tdStyle}>{label}</td>
                    <td style={{ ...tdRight, color: value < 0 ? '#D94F4F' : '#1A1A2E' }}>{fmtAUD2(value)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #E5E7EB' }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Total Cash Available</td>
                  <td style={{ ...tdRight, fontWeight: 700, fontSize: '13px' }}>{fmtAUD(cashPosition.totalCashAvailable)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: '11px', color: '#6B7280' }}>No cash position data.</p>
          )}
        </div>

        <div style={cardStyle}>
          <h3 style={{ ...sectionTitle, margin: '0 0 8px 0' }}>Aged Receivables</h3>
          {agedReceivables ? (
            <table style={tableStyle}>
              <tbody>
                {[
                  { label: 'Current', value: agedReceivables.current },
                  { label: '30+ Days', value: agedReceivables.over30Days },
                  { label: '60+ Days', value: agedReceivables.over60Days },
                  { label: '90+ Days', value: agedReceivables.over90Days },
                ].map(({ label, value }) => (
                  <tr key={label}>
                    <td style={tdStyle}>{label}</td>
                    <td style={tdRight}>{fmtAUD(value)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #E5E7EB' }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Total Receivables</td>
                  <td style={{ ...tdRight, fontWeight: 700 }}>{fmtAUD(agedReceivables.totalReceivables)}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Total Payables</td>
                  <td style={{ ...tdRight, color: '#D94F4F' }}>{fmtAUD(agedReceivables.totalPayables)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: '11px', color: '#6B7280' }}>No receivables data.</p>
          )}
        </div>
      </div>
    </PrintLayout>
  );
}
