import { Router } from 'express';
import prisma from '../db.js';
import { FinancialService } from '../services/FinancialService.js';
import { TargetService } from '../services/TargetService.js';
import { validateQuery, schemas } from '../middleware/validation.js';
import type { Region } from '../generated/prisma/index.js';

const router = Router();

const ALL_REGIONS: Region[] = [
  'cairns', 'mackay', 'nq_commercial', 'seq_residential', 'seq_commercial',
  'town_planning', 'townsville', 'wide_bay', 'all_in_access',
];

const REGION_LABELS: Record<Region, string> = {
  cairns: 'Cairns',
  mackay: 'Mackay',
  nq_commercial: 'NQ Commercial',
  seq_residential: 'SEQ Residential',
  seq_commercial: 'SEQ Commercial',
  town_planning: 'Town Planning',
  townsville: 'Townsville',
  wide_bay: 'Wide Bay',
  all_in_access: 'All In Access',
};

/**
 * GET /executive-summary?weekEnding=YYYY-MM-DD
 * Returns all data needed for the Executive Summary dashboard in a single call.
 */
router.get('/executive-summary', validateQuery(schemas.weekEndingQuery), async (req, res, next) => {
  try {
    const { weekEnding } = (req as any).validated;
    const weekDate = new Date(weekEnding);

    // Calculate 13-week window (12 weeks before + current week)
    const trendStart = new Date(weekDate);
    trendStart.setDate(trendStart.getDate() - 12 * 7);

    // Fire all queries in parallel
    const [
      financial,
      financialTrend,
      projects,
      projectsTrend,
      sales,
      leads,
      cashPosition,
      googleReviews,
      teamPerformance,
      targets,
    ] = await Promise.all([
      // Current week financial
      FinancialService.getWeeklySummary(weekDate),
      // 13-week financial trend
      FinancialService.getWeeklyRange(trendStart, weekDate),
      // Current week projects
      prisma.projectsWeekly.findMany({
        where: { weekEnding: weekDate },
        orderBy: { projectType: 'asc' },
      }),
      // 13-week projects trend (for revenue by category chart)
      prisma.projectsWeekly.findMany({
        where: { weekEnding: { gte: trendStart, lte: weekDate } },
        orderBy: [{ weekEnding: 'asc' }, { projectType: 'asc' }],
      }),
      // Current week sales
      prisma.salesWeekly.findMany({
        where: { weekEnding: weekDate },
        orderBy: { salesType: 'asc' },
      }),
      // Current week leads
      prisma.leadsWeekly.findMany({
        where: { weekEnding: weekDate },
        orderBy: { source: 'asc' },
      }),
      // Cash position
      FinancialService.getCashPosition(weekDate),
      // Google reviews
      prisma.googleReviewsWeekly.findUnique({
        where: { weekEnding: weekDate },
      }),
      // Team performance
      prisma.teamPerformanceWeekly.findMany({
        where: { weekEnding: weekDate },
        orderBy: { region: 'asc' },
      }),
      // All active targets
      TargetService.getAllTargetsForWeek(weekDate),
    ]);

    // --- Compute KPI values ---

    // Net Profit
    const netProfit = financial ? Number(financial.netProfit) : null;
    const netProfitBudget = targets.find(t => t.targetType === 'net_profit');
    const netProfitBudgetAmount = netProfitBudget ? Number(netProfitBudget.amount) : null;

    // Revenue (Invoiced) = sum of Resi + Commercial + Retro xeroInvoicedAmount
    const revenueInvoiced = projects.reduce((sum, p) => sum + Number(p.xeroInvoicedAmount), 0);

    // Revenue (P&L) = totalTradingIncome
    const revenuePL = financial ? Number(financial.totalTradingIncome) : null;

    // Gross Profit Margin
    const grossProfitMargin = financial ? financial.grossProfitMargin : null;

    // Revenue to Staff Ratio
    const revenueToStaffRatio = financial ? financial.revenueToStaffRatio : null;

    // Total Leads
    const totalLeads = leads.reduce((sum, l) => sum + Number(l.leadCount), 0);
    const totalLeadCost = leads.reduce((sum, l) => sum + Number(l.totalCost ?? 0), 0);
    const avgCostPerLead = totalLeads > 0 ? totalLeadCost / totalLeads : 0;

    // Total Cash Available
    const totalCashAvailable = cashPosition ? Number(cashPosition.totalCashAvailable ?? 0) : null;

    // --- Team performance with targets ---
    const teamResults = await Promise.all(
      ALL_REGIONS.map(async (region) => {
        const actual = teamPerformance.find(tp => tp.region === region);
        const target = await TargetService.getTargetForWeek('team_revenue', weekDate, region);
        const actualAmount = actual ? Number(actual.actualInvoiced) : 0;
        const targetAmount = target ? Number(target.amount) : 0;
        const pctToTarget = targetAmount > 0 ? Number(((actualAmount / targetAmount) * 100).toFixed(1)) : 0;

        return {
          region,
          label: REGION_LABELS[region],
          actual: actualAmount,
          target: targetAmount,
          percentageToTarget: pctToTarget,
          variance: Number((actualAmount - targetAmount).toFixed(2)),
        };
      })
    );

    // --- Project targets ---
    const resiTarget = targets.find(t => t.targetType === 'residential_revenue');
    const commTarget = targets.find(t => t.targetType === 'commercial_revenue');
    const retroTarget = targets.find(t => t.targetType === 'retrospective_revenue');

    const projectSummary = ['residential', 'commercial', 'retrospective'].map(type => {
      const row = projects.find(p => p.projectType === type);
      const target = type === 'residential' ? resiTarget
        : type === 'commercial' ? commTarget : retroTarget;
      const invoiced = row ? Number(row.xeroInvoicedAmount) : 0;
      const targetAmt = target ? Number(target.amount) : 0;
      const pct = targetAmt > 0 ? Number(((invoiced / targetAmt) * 100).toFixed(1)) : 0;

      return {
        type,
        hyperfloCount: row ? row.hyperfloCount : 0,
        xeroInvoiced: invoiced,
        target: targetAmt,
        percentageToTarget: pct,
        newBusinessPercentage: row?.newBusinessPercentage != null ? Number(row.newBusinessPercentage) : null,
      };
    });

    // --- Sales pipeline summary ---
    const salesSummary = ['residential', 'commercial', 'retrospective'].map(type => {
      const row = sales.find(s => s.salesType === type);
      const issuedCount = row ? row.quotesIssuedCount : 0;
      const issuedValue = row ? Number(row.quotesIssuedValue) : 0;
      const wonCount = row ? row.quotesWonCount : 0;
      const wonValue = row ? Number(row.quotesWonValue) : 0;
      const winRate = issuedCount > 0 ? Number(((wonCount / issuedCount) * 100).toFixed(1)) : 0;

      return { type, issuedCount, issuedValue, wonCount, wonValue, winRate };
    });

    // --- Lead source breakdown ---
    const leadBreakdown = leads.map(l => ({
      source: l.source,
      leadCount: Number(l.leadCount),
      costPerLead: l.costPerLead ? Number(l.costPerLead) : null,
      totalCost: l.totalCost ? Number(l.totalCost) : null,
    }));

    // --- Google Reviews ---
    const reviews = googleReviews ? {
      reviewCount: googleReviews.reviewCount,
      averageRating: googleReviews.averageRating ? Number(googleReviews.averageRating) : null,
      cumulativeCount: googleReviews.cumulativeCount,
      cumulativeAverageRating: googleReviews.cumulativeAverageRating
        ? Number(googleReviews.cumulativeAverageRating) : null,
    } : null;

    // --- Trend data for charts ---

    // Net profit trend (13 weeks) with budget
    const netProfitTrend = financialTrend.map(w => ({
      weekEnding: (w.weekEnding as Date).toISOString().split('T')[0],
      netProfit: Number(w.netProfit),
      totalTradingIncome: Number(w.totalTradingIncome),
      budget: netProfitBudgetAmount,
    }));

    // Revenue by category trend (13 weeks): group by week, sum per project type
    const revByCategoryMap = new Map<string, { residential: number; commercial: number; retrospective: number }>();
    for (const p of projectsTrend) {
      const wk = (p.weekEnding as Date).toISOString().split('T')[0];
      if (!revByCategoryMap.has(wk)) {
        revByCategoryMap.set(wk, { residential: 0, commercial: 0, retrospective: 0 });
      }
      const entry = revByCategoryMap.get(wk)!;
      entry[p.projectType as keyof typeof entry] = Number(p.xeroInvoicedAmount);
    }
    const revenueByCategoryTrend = Array.from(revByCategoryMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekEnding, values]) => ({ weekEnding, ...values }));

    res.json({
      weekEnding: weekDate.toISOString().split('T')[0],
      hasData: !!financial,
      kpis: {
        netProfit: {
          actual: netProfit,
          budget: netProfitBudgetAmount,
          variance: netProfit != null && netProfitBudgetAmount != null
            ? Number((netProfit - netProfitBudgetAmount).toFixed(2)) : null,
          variancePct: netProfit != null && netProfitBudgetAmount != null && netProfitBudgetAmount !== 0
            ? Number((((netProfit - netProfitBudgetAmount) / Math.abs(netProfitBudgetAmount)) * 100).toFixed(1)) : null,
        },
        revenueInvoiced: {
          actual: Number(revenueInvoiced.toFixed(2)),
        },
        revenuePL: {
          actual: revenuePL,
          varianceToInvoiced: revenuePL != null
            ? Number((revenuePL - revenueInvoiced).toFixed(2)) : null,
        },
        grossProfitMargin: {
          actual: grossProfitMargin,
        },
        revenueToStaffRatio: {
          actual: revenueToStaffRatio,
        },
        totalLeads: {
          actual: totalLeads,
          avgCostPerLead: Number(avgCostPerLead.toFixed(2)),
        },
        totalCashAvailable: {
          actual: totalCashAvailable,
        },
      },
      projectSummary,
      salesSummary,
      leadBreakdown,
      reviews,
      teamPerformance: teamResults,
      trends: {
        netProfit: netProfitTrend,
        revenueByCategory: revenueByCategoryTrend,
      },
    });
  } catch (err) { next(err); }
});

export default router;
