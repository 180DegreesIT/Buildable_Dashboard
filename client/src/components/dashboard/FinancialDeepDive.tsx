import { useState, useEffect, useCallback } from 'react';
import { useWeek } from '../../lib/WeekContext';
import {
  fetchFinancialDeepDive,
  type FinancialDeepDiveData,
  type PLWeekly,
  type PLMonthly,
} from '../../lib/dashboardApi';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import EmptyState from '../ui/EmptyState';
import ExportButtons from '../ui/ExportButtons';
import NetRevenueToggle from '../ui/NetRevenueToggle';
import CostAnalysisChart from './CostAnalysisChart';
import RevenueBreakdownChart from './RevenueBreakdownChart';
import { downloadCsv, type CsvColumn, AUD_FORMATTER, PCT_FORMATTER } from '../../lib/csvExport';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtAUD(val: number | null | undefined): string {
  if (val == null) return '—';
  return val.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtAUD2(val: number | null | undefined): string {
  if (val == null) return '—';
  return val.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(val: number | null | undefined): string {
  if (val == null) return '—';
  return `${val.toFixed(1)}%`;
}

function monthLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
}

// ─── P&L Table Row ────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function FinancialDeepDive() {
  const { selectedWeek, loading: weekLoading } = useWeek();
  const [data, setData] = useState<FinancialDeepDiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plView, setPlView] = useState<'weekly' | 'monthly'>('weekly');
  const [netRevenue, setNetRevenue] = useState(false);

  useEffect(() => {
    if (!selectedWeek) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchFinancialDeepDive(selectedWeek)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [selectedWeek]);

  const handleCsvExport = useCallback(() => {
    if (!data?.plWeekly) return;
    const plRows = buildPLRows(data.plWeekly);
    const columns: CsvColumn<PLRow>[] = [
      { key: 'label', label: 'Line Item' },
      {
        key: 'value',
        label: 'Amount',
        format: (v, row) =>
          row.label === '% Profit' || row.label === 'Revenue to Staff Ratio'
            ? PCT_FORMATTER(v)
            : AUD_FORMATTER(v),
      },
    ];
    downloadCsv(`financial-pl-${selectedWeek}`, columns, plRows);
  }, [data, selectedWeek]);

  if (weekLoading || loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="table" count={6} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LoadingSkeleton variant="chart" />
          <LoadingSkeleton variant="chart" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LoadingSkeleton variant="card" count={2} />
          <LoadingSkeleton variant="table" count={3} />
        </div>
      </div>
    );
  }

  if (error) return <EmptyState title="Error loading data" message={error} />;
  if (!data || !data.hasData) {
    return <EmptyState title="No data available" message="There is no financial data for the selected week." />;
  }

  const { plWeekly, plMonthly, revenueBreakdown, revenueComparison, costAnalysisTrend, revenueTrend, cashPosition, agedReceivables, upcomingLiabilities } = data;

  return (
    <div data-loaded="true" className="space-y-6">
      {/* ── Page Header with Export ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1A1A2E]">Financial Deep Dive</h1>
        <ExportButtons
          disabled={!data}
          onCsvExport={handleCsvExport}
          pageSlug="financial"
          weekEnding={selectedWeek}
        />
      </div>

      {/* ── P&L Summary ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1A1A2E]">Profit & Loss Summary</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPlView('weekly')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                plView === 'weekly'
                  ? 'bg-[#4573D2]/10 text-[#4573D2]'
                  : 'text-[#6B7280] hover:bg-gray-100'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setPlView('monthly')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                plView === 'monthly'
                  ? 'bg-[#4573D2]/10 text-[#4573D2]'
                  : 'text-[#6B7280] hover:bg-gray-100'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>

        {plView === 'weekly' && plWeekly && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {buildPLRows(plWeekly).map((row, i) => (
                  <tr
                    key={i}
                    className={`${row.divider ? 'border-t border-gray-200' : 'border-t border-gray-50'}`}
                  >
                    <td className={`px-6 py-2.5 ${row.bold ? 'font-semibold text-[#1A1A2E]' : 'text-[#6B7280]'} ${row.indent ? 'pl-10' : ''}`}>
                      {row.label}
                    </td>
                    <td className={`px-6 py-2.5 text-right ${row.bold ? 'font-semibold text-[#1A1A2E]' : 'text-[#1A1A2E]'}`}>
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

        {plView === 'monthly' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Month</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Income</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Cost of Sales</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Gross Profit</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Wages</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Net Profit</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Budget</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">% Profit</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Staff %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {plMonthly.map((m) => (
                  <tr key={m.month}>
                    <td className="px-4 py-2.5 font-medium text-[#1A1A2E]">{monthLabel(m.month)}</td>
                    <td className="px-4 py-2.5 text-right text-[#1A1A2E]">{fmtAUD(m.totalTradingIncome)}</td>
                    <td className="px-4 py-2.5 text-right text-[#6B7280]">{fmtAUD(m.totalCostOfSales)}</td>
                    <td className="px-4 py-2.5 text-right text-[#1A1A2E]">{fmtAUD(m.grossProfit)}</td>
                    <td className="px-4 py-2.5 text-right text-[#6B7280]">{fmtAUD(m.wagesAndSalaries)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${m.netProfit >= 0 ? 'text-[#6AAF50]' : 'text-[#D94F4F]'}`}>
                      {fmtAUD(m.netProfit)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#6B7280]">{fmtAUD(m.budget)}</td>
                    <td className="px-4 py-2.5 text-right text-[#1A1A2E]">{fmtPct(m.profitPercentage)}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${
                      m.revenueToStaffRatio <= 55 ? 'text-[#6AAF50]'
                        : m.revenueToStaffRatio <= 65 ? 'text-[#E8A442]'
                          : 'text-[#D94F4F]'
                    }`}>
                      {fmtPct(m.revenueToStaffRatio)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Revenue Comparison: Invoiced vs P&L ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#1A1A2E]">Revenue Comparison</h3>
          <NetRevenueToggle enabled={netRevenue} onChange={setNetRevenue} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Revenue (Invoiced)</p>
            <p className="text-2xl font-bold text-[#1A1A2E]">{fmtAUD(revenueComparison.invoiced)}</p>
            <p className="text-xs text-[#6B7280] mt-1">Resi + Commercial + Retro (Xero)</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
              Revenue (P&L){netRevenue ? ' — Net' : ''}
            </p>
            <p className="text-2xl font-bold text-[#1A1A2E]">
              {netRevenue
                ? fmtAUD(revenueBreakdown.netTotal)
                : fmtAUD(revenueComparison.pl)}
            </p>
            <p className="text-xs text-[#6B7280] mt-1">
              {netRevenue
                ? `Gross ${fmtAUD(revenueBreakdown.grossTotal)} minus ${fmtAUD(revenueBreakdown.passThroughTotal)} pass-through`
                : 'Total Trading Income from P&L'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Variance</p>
            <p className={`text-2xl font-bold ${
              (revenueComparison.variance ?? 0) >= 0 ? 'text-[#6AAF50]' : 'text-[#D94F4F]'
            }`}>
              {fmtAUD(revenueComparison.variance)}
            </p>
            <p className="text-xs text-[#6B7280] mt-1" title="Timing differences, accruals, and non-invoice income explain the gap between Invoiced and P&L revenue.">
              Timing &amp; accrual differences
            </p>
          </div>
        </div>
      </div>

      {/* ── Revenue Breakdown + Cost Analysis Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueBreakdownChart
          data={revenueTrend}
          netRevenue={netRevenue}
          passThroughCategories={revenueBreakdown.passThroughCategories}
        />
        <CostAnalysisChart data={costAnalysisTrend} />
      </div>

      {/* ── Revenue Category Breakdown Table ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1A1A2E]">Revenue by Income Category</h3>
          <span className="text-xs text-[#6B7280]">
            {netRevenue ? `Net: ${fmtAUD(revenueBreakdown.netTotal)}` : `Gross: ${fmtAUD(revenueBreakdown.grossTotal)}`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Category</th>
                <th className="px-6 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Amount</th>
                <th className="px-6 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">% of Total</th>
                <th className="px-6 py-2.5 text-center text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {revenueBreakdown.categories
                .filter(c => !netRevenue || !c.isPassThrough)
                .map((cat) => {
                  const total = netRevenue ? revenueBreakdown.netTotal : revenueBreakdown.grossTotal;
                  const pct = total > 0 ? (cat.amount / total) * 100 : 0;
                  return (
                    <tr key={cat.category} className={cat.isPassThrough ? 'bg-gray-50/50' : ''}>
                      <td className="px-6 py-2.5 text-[#1A1A2E]">{cat.label}</td>
                      <td className="px-6 py-2.5 text-right text-[#1A1A2E]">{fmtAUD2(cat.amount)}</td>
                      <td className="px-6 py-2.5 text-right text-[#6B7280]">{fmtPct(pct)}</td>
                      <td className="px-6 py-2.5 text-center">
                        {cat.isPassThrough && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-[#6B7280]">
                            Pass-through
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cash Position + Aged Receivables ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Position Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">Cash Position</h3>
          {cashPosition ? (
            <div className="space-y-3">
              {[
                { label: 'Everyday Account', value: cashPosition.everydayAccount },
                { label: 'Overdraft Limit', value: cashPosition.overdraftLimit },
                { label: 'Tax Savings', value: cashPosition.taxSavings },
                { label: 'Capital Account', value: cashPosition.capitalAccount },
                { label: 'Credit Cards', value: cashPosition.creditCards },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-1">
                  <span className="text-sm text-[#6B7280]">{label}</span>
                  <span className={`text-sm font-medium ${value < 0 ? 'text-[#D94F4F]' : 'text-[#1A1A2E]'}`}>
                    {fmtAUD2(value)}
                  </span>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-[#1A1A2E]">Total Cash Available</span>
                <span className="text-lg font-bold text-[#1A1A2E]">{fmtAUD(cashPosition.totalCashAvailable)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#6B7280]">No cash position data for this week.</p>
          )}
        </div>

        {/* Aged Receivables */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">Aged Receivables</h3>
          {agedReceivables ? (
            <div className="space-y-3">
              {/* Visual bar */}
              <div className="flex rounded-lg overflow-hidden h-8">
                {[
                  { label: 'Current', value: agedReceivables.current, color: 'bg-[#6AAF50]' },
                  { label: '30+', value: agedReceivables.over30Days, color: 'bg-[#E8A442]' },
                  { label: '60+', value: agedReceivables.over60Days, color: 'bg-[#D94F4F]/70' },
                  { label: '90+', value: agedReceivables.over90Days, color: 'bg-[#D94F4F]' },
                ].map(({ label, value, color }) => {
                  const pct = agedReceivables.totalReceivables > 0
                    ? (value / agedReceivables.totalReceivables) * 100
                    : 0;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={label}
                      className={`${color} flex items-center justify-center text-white text-xs font-medium`}
                      style={{ width: `${pct}%` }}
                      title={`${label}: ${fmtAUD(value)} (${pct.toFixed(0)}%)`}
                    >
                      {pct >= 12 && label}
                    </div>
                  );
                })}
              </div>

              {/* Detail rows */}
              {[
                { label: 'Current', value: agedReceivables.current, color: '#6AAF50' },
                { label: '30+ Days', value: agedReceivables.over30Days, color: '#E8A442' },
                { label: '60+ Days', value: agedReceivables.over60Days, color: '#D94F4F' },
                { label: '90+ Days', value: agedReceivables.over90Days, color: '#D94F4F' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-2 text-sm text-[#6B7280]">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                  <span className="text-sm font-medium text-[#1A1A2E]">{fmtAUD(value)}</span>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-[#1A1A2E]">Total Receivables</span>
                <span className="text-lg font-bold text-[#1A1A2E]">{fmtAUD(agedReceivables.totalReceivables)}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-[#6B7280]">Total Payables</span>
                <span className="text-sm font-medium text-[#D94F4F]">{fmtAUD(agedReceivables.totalPayables)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#6B7280]">No receivables data for this week.</p>
          )}
        </div>
      </div>

      {/* ── Upcoming Liabilities ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-[#1A1A2E]">Upcoming Liabilities</h3>
        </div>
        {upcomingLiabilities.length === 0 ? (
          <div className="p-8 text-center text-[#6B7280] text-sm">No upcoming liabilities.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Description</th>
                  <th className="px-6 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Due Date</th>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {upcomingLiabilities.map((l) => {
                  const dueDate = new Date(l.dueDate + 'T00:00:00');
                  const isOverdue = dueDate < new Date();
                  return (
                    <tr key={l.id}>
                      <td className="px-6 py-2.5 text-[#1A1A2E]">{l.description}</td>
                      <td className="px-6 py-2.5 text-right font-medium text-[#1A1A2E]">{fmtAUD2(l.amount)}</td>
                      <td className={`px-6 py-2.5 ${isOverdue ? 'text-[#D94F4F] font-medium' : 'text-[#6B7280]'}`}>
                        {dueDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {isOverdue && <span className="ml-1 text-xs">(overdue)</span>}
                      </td>
                      <td className="px-6 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          l.type === 'recurring'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-gray-100 text-[#6B7280]'
                        }`}>
                          {l.type === 'recurring' ? 'Recurring' : 'One-off'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
