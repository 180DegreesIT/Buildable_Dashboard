import { useState, useEffect } from 'react';
import { useWeek } from '../../lib/WeekContext';
import { fetchExecutiveSummary, type ExecutiveSummaryData } from '../../lib/dashboardApi';
import KPICard from '../ui/KPICard';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import EmptyState from '../ui/EmptyState';
import NetProfitChart from './NetProfitChart';
import RevenueByCategoryChart from './RevenueByCategoryChart';
import RegionalPerformanceChart from './RegionalPerformanceChart';

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

function fmtNum(val: number | null | undefined): string {
  if (val == null) return '—';
  return val.toLocaleString('en-AU');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const LEAD_SOURCE_LABELS: Record<string, string> = {
  google: 'Google',
  seo: 'SEO',
  meta: 'Meta',
  bing: 'Bing',
  tiktok: 'TikTok',
  other: 'Other',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExecutiveSummary() {
  const { selectedWeek, loading: weekLoading } = useWeek();
  const [data, setData] = useState<ExecutiveSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedWeek) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchExecutiveSummary(selectedWeek)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedWeek]);

  if (weekLoading || loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="kpi" count={7} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LoadingSkeleton variant="chart" />
          <LoadingSkeleton variant="chart" />
        </div>
        <LoadingSkeleton variant="chart" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LoadingSkeleton variant="table" count={4} />
          <LoadingSkeleton variant="table" count={4} />
        </div>
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Error loading data" message={error} />;
  }

  if (!data || !data.hasData) {
    return (
      <EmptyState
        title="No data available"
        message="There is no data for the selected week. Try selecting a different week or uploading data."
      />
    );
  }

  const { kpis, projectSummary, salesSummary, leadBreakdown, reviews, teamPerformance, trends } = data;

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4">
        {/* 1. Net Profit */}
        <KPICard
          label="Net Profit"
          value={fmtAUD(kpis.netProfit.actual)}
          comparisonLabel="Budget"
          comparisonValue={fmtAUD(kpis.netProfit.budget)}
          variance={kpis.netProfit.variancePct ?? undefined}
          varianceLabel={
            kpis.netProfit.variance != null
              ? `${fmtAUD(kpis.netProfit.variance)} (${fmtPct(kpis.netProfit.variancePct)})`
              : undefined
          }
        />

        {/* 2. Revenue (Invoiced) */}
        <KPICard
          label="Revenue (Invoiced)"
          value={fmtAUD(kpis.revenueInvoiced.actual)}
          tooltip="Buildable Invoice Total = Residential + Commercial + Retrospective Xero Invoiced"
        />

        {/* 3. Revenue (P&L) */}
        <KPICard
          label="Revenue (P&L)"
          value={fmtAUD(kpis.revenuePL.actual)}
          comparisonLabel="vs Invoiced"
          comparisonValue={
            kpis.revenuePL.varianceToInvoiced != null
              ? fmtAUD(kpis.revenuePL.varianceToInvoiced)
              : undefined
          }
          variance={kpis.revenuePL.varianceToInvoiced ?? undefined}
          varianceLabel={
            kpis.revenuePL.varianceToInvoiced != null
              ? fmtAUD(kpis.revenuePL.varianceToInvoiced)
              : undefined
          }
          tooltip="Total Trading Income from P&L. Difference to Invoiced reflects timing, accruals, and non-invoice income."
        />

        {/* 4. Gross Profit Margin */}
        <KPICard
          label="Gross Profit Margin"
          value={fmtPct(kpis.grossProfitMargin.actual)}
        />

        {/* 5. Revenue to Staff Ratio */}
        <KPICard
          label="Revenue to Staff %"
          value={fmtPct(kpis.revenueToStaffRatio.actual)}
          invertColor
          benchmark={
            kpis.revenueToStaffRatio.actual != null
              ? {
                  low: 55,
                  high: 65,
                  value: kpis.revenueToStaffRatio.actual,
                  label: kpis.revenueToStaffRatio.actual < 55
                    ? 'Excellent (< 55%)'
                    : kpis.revenueToStaffRatio.actual <= 65
                      ? 'Healthy (55–65%)'
                      : 'High (> 65%)',
                }
              : undefined
          }
          tooltip="Wages & Salaries as % of Total Trading Income. Lower is better. 55-65% is the healthy range."
        />

        {/* 6. Total Leads */}
        <KPICard
          label="Total Leads"
          value={fmtNum(kpis.totalLeads.actual)}
          comparisonLabel="Avg cost/lead"
          comparisonValue={fmtAUD2(kpis.totalLeads.avgCostPerLead)}
        />

        {/* 7. Total Cash Available */}
        <KPICard
          label="Total Cash"
          value={fmtAUD(kpis.totalCashAvailable.actual)}
        />
      </div>

      {/* ── Charts Row 1: Net Profit + Revenue by Category ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NetProfitChart data={trends.netProfit} />
        <RevenueByCategoryChart data={trends.revenueByCategory} />
      </div>

      {/* ── Chart Row 2: Regional Performance ── */}
      <RegionalPerformanceChart data={teamPerformance} />

      {/* ── Tables Row 1: Project Summary + Sales Pipeline ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[#1A1A2E]">Project Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Type</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Projects</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Invoiced</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Target</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">% to Target</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">New Biz %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {projectSummary.map((row) => {
                  const pctColor = row.percentageToTarget >= 80
                    ? 'text-[#6AAF50]'
                    : row.percentageToTarget >= 50
                      ? 'text-[#E8A442]'
                      : 'text-[#D94F4F]';
                  return (
                    <tr key={row.type}>
                      <td className="px-4 py-2.5 text-[#1A1A2E] font-medium">{capitalize(row.type)}</td>
                      <td className="px-4 py-2.5 text-right text-[#1A1A2E]">{row.hyperfloCount}</td>
                      <td className="px-4 py-2.5 text-right text-[#1A1A2E]">{fmtAUD(row.xeroInvoiced)}</td>
                      <td className="px-4 py-2.5 text-right text-[#6B7280]">{fmtAUD(row.target)}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${pctColor}`}>{fmtPct(row.percentageToTarget)}</td>
                      <td className="px-4 py-2.5 text-right text-[#6B7280]">
                        {row.newBusinessPercentage != null ? fmtPct(row.newBusinessPercentage) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sales Pipeline Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[#1A1A2E]">Sales Pipeline</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Type</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Issued #</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Issued $</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Won #</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Won $</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {salesSummary.map((row) => (
                  <tr key={row.type}>
                    <td className="px-4 py-2.5 text-[#1A1A2E] font-medium">{capitalize(row.type)}</td>
                    <td className="px-4 py-2.5 text-right text-[#1A1A2E]">{row.issuedCount}</td>
                    <td className="px-4 py-2.5 text-right text-[#1A1A2E]">{fmtAUD(row.issuedValue)}</td>
                    <td className="px-4 py-2.5 text-right text-[#1A1A2E]">{row.wonCount}</td>
                    <td className="px-4 py-2.5 text-right text-[#1A1A2E]">{fmtAUD(row.wonValue)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[#4573D2]">{fmtPct(row.winRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Tables Row 2: Lead Sources + Google Reviews ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Source Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[#1A1A2E]">Lead Sources</h3>
          </div>
          {leadBreakdown.length === 0 ? (
            <div className="p-8 text-center text-[#6B7280] text-sm">No lead data for this week.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Source</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Leads</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Cost / Lead</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {leadBreakdown.map((row) => (
                    <tr key={row.source}>
                      <td className="px-4 py-2.5 text-[#1A1A2E] font-medium">
                        {LEAD_SOURCE_LABELS[row.source] ?? row.source}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[#1A1A2E]">{fmtNum(row.leadCount)}</td>
                      <td className="px-4 py-2.5 text-right text-[#6B7280]">{fmtAUD2(row.costPerLead)}</td>
                      <td className="px-4 py-2.5 text-right text-[#1A1A2E]">{fmtAUD2(row.totalCost)}</td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-2.5 text-[#1A1A2E]">Total</td>
                    <td className="px-4 py-2.5 text-right text-[#1A1A2E]">
                      {fmtNum(leadBreakdown.reduce((s, r) => s + r.leadCount, 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#6B7280]">
                      {fmtAUD2(
                        leadBreakdown.reduce((s, r) => s + r.leadCount, 0) > 0
                          ? leadBreakdown.reduce((s, r) => s + (r.totalCost ?? 0), 0) /
                            leadBreakdown.reduce((s, r) => s + r.leadCount, 0)
                          : 0
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#1A1A2E]">
                      {fmtAUD2(leadBreakdown.reduce((s, r) => s + (r.totalCost ?? 0), 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Google Reviews */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[#1A1A2E]">Google Reviews</h3>
          </div>
          {reviews ? (
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1">This Week</p>
                  <p className="text-2xl font-bold text-[#1A1A2E]">{reviews.reviewCount}</p>
                  <p className="text-xs text-[#6B7280]">
                    {reviews.averageRating != null
                      ? `${reviews.averageRating.toFixed(1)} avg rating`
                      : 'No rating data'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Cumulative</p>
                  <p className="text-2xl font-bold text-[#1A1A2E]">{reviews.cumulativeCount ?? '—'}</p>
                  <p className="text-xs text-[#6B7280]">
                    {reviews.cumulativeAverageRating != null
                      ? `${reviews.cumulativeAverageRating.toFixed(2)} avg rating`
                      : 'No cumulative data'}
                  </p>
                </div>
              </div>
              {reviews.cumulativeAverageRating != null && (
                <div className="mt-4 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.round(reviews.cumulativeAverageRating!)
                          ? 'text-[#E8A442]'
                          : 'text-gray-200'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="ml-1 text-sm font-semibold text-[#1A1A2E]">
                    {reviews.cumulativeAverageRating.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-[#6B7280] text-sm">No review data for this week.</div>
          )}
        </div>
      </div>

      {/* ── Active Alerts Panel (Placeholder) ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-[#1A1A2E] mb-3">Active Alerts</h3>
        <div className="flex items-center gap-3 py-4 text-[#6B7280]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm">No active alerts.</span>
        </div>
      </div>
    </div>
  );
}
