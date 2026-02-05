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

// Default pass-through categories (stripped when Net Revenue toggle is on)
const DEFAULT_PASS_THROUGH: string[] = ['council_fees'];

const REVENUE_CATEGORY_LABELS: Record<string, string> = {
  class_1a: 'Class 1A',
  class_10a_sheds: 'Class 10a Sheds',
  class_10b_pools: 'Class 10b Pools',
  class_2_9_commercial: 'Class 2-9 Commercial',
  inspections: 'Inspections',
  retrospective: 'Retrospective',
  council_fees: 'Council Fees',
  planning_1_10: 'Planning 1&10',
  planning_2_9: 'Planning 2-9',
  property_searches: 'Property Searches',
  qleave: 'Qleave',
  sundry: 'Sundry',
  access_labour_hire: 'Access Labour Hire',
  insurance_levy: 'Insurance Levy',
};

/**
 * GET /financial-deep-dive?weekEnding=YYYY-MM-DD
 * Returns all data for the Financial Deep Dive page.
 */
router.get('/financial-deep-dive', validateQuery(schemas.weekEndingQuery), async (req, res, next) => {
  try {
    const { weekEnding } = (req as any).validated;
    const weekDate = new Date(weekEnding);

    // 13-week window
    const trendStart = new Date(weekDate);
    trendStart.setDate(trendStart.getDate() - 12 * 7);

    // 6-month window for monthly aggregation (roughly 26 weeks)
    const monthlyStart = new Date(weekDate);
    monthlyStart.setMonth(monthlyStart.getMonth() - 5);
    monthlyStart.setDate(1); // Start of month

    // Resolve pass-through categories from settings
    let passThroughCategories = DEFAULT_PASS_THROUGH;
    try {
      const setting = await prisma.setting.findUnique({ where: { key: 'pass_through_categories' } });
      if (setting && Array.isArray(setting.value)) {
        passThroughCategories = setting.value as string[];
      }
    } catch { /* use default */ }

    const [
      financial,
      financialTrend,
      revenueBreakdown,
      revenueTrend,
      cashPosition,
      liabilities,
      netProfitBudget,
      projectsWeek,
    ] = await Promise.all([
      // Current week P&L
      FinancialService.getWeeklySummary(weekDate),
      // Financial trend for cost analysis + monthly aggregation
      FinancialService.getWeeklyRange(monthlyStart, weekDate),
      // Revenue breakdown for current week
      prisma.revenueWeekly.findMany({
        where: { weekEnding: weekDate },
        orderBy: { category: 'asc' },
      }),
      // Revenue breakdown trend (13 weeks for stacked area chart)
      prisma.revenueWeekly.findMany({
        where: { weekEnding: { gte: trendStart, lte: weekDate } },
        orderBy: [{ weekEnding: 'asc' }, { category: 'asc' }],
      }),
      // Cash position
      FinancialService.getCashPosition(weekDate),
      // Upcoming liabilities (active only)
      prisma.upcomingLiability.findMany({
        where: { isActive: true },
        orderBy: { dueDate: 'asc' },
      }),
      // Net profit budget target
      TargetService.getTargetForWeek('net_profit', weekDate),
      // Projects for Revenue (Invoiced) calculation
      prisma.projectsWeekly.findMany({
        where: { weekEnding: weekDate },
      }),
    ]);

    const budgetAmount = netProfitBudget ? Number(netProfitBudget.amount) : null;

    // --- P&L Summary (weekly) ---
    const plWeekly = financial ? {
      totalTradingIncome: Number(financial.totalTradingIncome),
      totalCostOfSales: Number(financial.totalCostOfSales),
      grossProfit: Number(financial.grossProfit),
      otherIncome: Number(financial.otherIncome),
      operatingExpenses: Number(financial.operatingExpenses),
      wagesAndSalaries: Number(financial.wagesAndSalaries),
      netProfit: Number(financial.netProfit),
      budget: budgetAmount,
      profitPercentage: financial.profitPercentage,
      revenueToStaffRatio: financial.revenueToStaffRatio,
      grossProfitMargin: financial.grossProfitMargin,
    } : null;

    // --- P&L Monthly aggregation ---
    // Group financial trend by YYYY-MM and sum
    const monthlyMap = new Map<string, {
      totalTradingIncome: number; totalCostOfSales: number; grossProfit: number;
      otherIncome: number; operatingExpenses: number; wagesAndSalaries: number;
      netProfit: number; weekCount: number;
    }>();

    for (const w of financialTrend) {
      const d = new Date(w.weekEnding);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthlyMap.get(monthKey) ?? {
        totalTradingIncome: 0, totalCostOfSales: 0, grossProfit: 0,
        otherIncome: 0, operatingExpenses: 0, wagesAndSalaries: 0,
        netProfit: 0, weekCount: 0,
      };
      existing.totalTradingIncome += Number(w.totalTradingIncome);
      existing.totalCostOfSales += Number(w.totalCostOfSales);
      existing.grossProfit += Number(w.grossProfit);
      existing.otherIncome += Number(w.otherIncome);
      existing.operatingExpenses += Number(w.operatingExpenses);
      existing.wagesAndSalaries += Number(w.wagesAndSalaries);
      existing.netProfit += Number(w.netProfit);
      existing.weekCount += 1;
      monthlyMap.set(monthKey, existing);
    }

    const plMonthly = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => {
        const income = data.totalTradingIncome;
        return {
          month,
          ...data,
          budget: budgetAmount != null ? budgetAmount * data.weekCount : null,
          profitPercentage: income > 0 ? Number(((data.netProfit / income) * 100).toFixed(2)) : 0,
          revenueToStaffRatio: income > 0 ? Number(((data.wagesAndSalaries / income) * 100).toFixed(2)) : 0,
          grossProfitMargin: income > 0 ? Number(((data.grossProfit / income) * 100).toFixed(2)) : 0,
        };
      });

    // --- Revenue breakdown (current week) ---
    const grossRevenue = revenueBreakdown.map(r => ({
      category: r.category,
      label: REVENUE_CATEGORY_LABELS[r.category] ?? r.category,
      amount: Number(r.amount),
      isPassThrough: passThroughCategories.includes(r.category),
    }));

    const grossTotal = grossRevenue.reduce((s, r) => s + r.amount, 0);
    const passThroughTotal = grossRevenue.filter(r => r.isPassThrough).reduce((s, r) => s + r.amount, 0);
    const netTotal = grossTotal - passThroughTotal;

    // --- Revenue Invoiced vs P&L comparison ---
    const revenueInvoiced = projectsWeek.reduce((sum, p) => sum + Number(p.xeroInvoicedAmount), 0);
    const revenuePL = financial ? Number(financial.totalTradingIncome) : null;

    // --- Revenue trend (13 weeks, grouped by week with all categories) ---
    const revTrendMap = new Map<string, Record<string, number>>();
    for (const r of revenueTrend) {
      const wk = (r.weekEnding as Date).toISOString().split('T')[0];
      if (!revTrendMap.has(wk)) revTrendMap.set(wk, {});
      const entry = revTrendMap.get(wk)!;
      entry[r.category] = Number(r.amount);
    }
    const revenueTrendData = Array.from(revTrendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekEnding, categories]) => ({ weekEnding, ...categories }));

    // --- Cost analysis trend (13 weeks) ---
    const last13 = financialTrend.filter(w => {
      const d = new Date(w.weekEnding);
      return d >= trendStart && d <= weekDate;
    });
    const costAnalysisTrend = last13.map(w => ({
      weekEnding: (w.weekEnding as Date).toISOString().split('T')[0],
      revenueToStaffRatio: w.revenueToStaffRatio,
      wagesAndSalaries: Number(w.wagesAndSalaries),
      totalTradingIncome: Number(w.totalTradingIncome),
    }));

    // --- Cash position ---
    const cashData = cashPosition ? {
      everydayAccount: Number(cashPosition.everydayAccount ?? 0),
      overdraftLimit: Number(cashPosition.overdraftLimit ?? 0),
      taxSavings: Number(cashPosition.taxSavings ?? 0),
      capitalAccount: Number(cashPosition.capitalAccount ?? 0),
      creditCards: Number(cashPosition.creditCards ?? 0),
      totalCashAvailable: Number(cashPosition.totalCashAvailable ?? 0),
    } : null;

    // --- Aged receivables ---
    const receivables = cashPosition ? {
      totalReceivables: Number(cashPosition.totalReceivables ?? 0),
      current: Number(cashPosition.currentReceivables ?? 0),
      over30Days: Number(cashPosition.over30Days ?? 0),
      over60Days: Number(cashPosition.over60Days ?? 0),
      over90Days: Number(cashPosition.over90Days ?? 0),
      totalPayables: Number(cashPosition.totalPayables ?? 0),
    } : null;

    // --- Upcoming liabilities ---
    const liabilityData = liabilities.map(l => ({
      id: l.id,
      description: l.description,
      amount: Number(l.amount),
      dueDate: l.dueDate.toISOString().split('T')[0],
      type: l.liabilityType,
    }));

    res.json({
      weekEnding: weekDate.toISOString().split('T')[0],
      hasData: !!financial,
      plWeekly,
      plMonthly,
      revenueBreakdown: {
        categories: grossRevenue,
        grossTotal: Number(grossTotal.toFixed(2)),
        passThroughTotal: Number(passThroughTotal.toFixed(2)),
        netTotal: Number(netTotal.toFixed(2)),
        passThroughCategories,
      },
      revenueComparison: {
        invoiced: Number(revenueInvoiced.toFixed(2)),
        pl: revenuePL,
        variance: revenuePL != null ? Number((revenuePL - revenueInvoiced).toFixed(2)) : null,
      },
      costAnalysisTrend,
      revenueTrend: revenueTrendData,
      cashPosition: cashData,
      agedReceivables: receivables,
      upcomingLiabilities: liabilityData,
    });
  } catch (err) { next(err); }
});

/**
 * GET /regional-performance?weekEnding=YYYY-MM-DD
 * Returns all data for the Regional Performance page.
 */
router.get('/regional-performance', validateQuery(schemas.weekEndingQuery), async (req, res, next) => {
  try {
    const { weekEnding } = (req as any).validated;
    const weekDate = new Date(weekEnding);

    // 13-week window
    const trendStart = new Date(weekDate);
    trendStart.setDate(trendStart.getDate() - 12 * 7);

    const [teamActuals, teamTrend] = await Promise.all([
      // Current week: all teams
      prisma.teamPerformanceWeekly.findMany({
        where: { weekEnding: weekDate },
        orderBy: { region: 'asc' },
      }),
      // 13-week trend: all teams
      prisma.teamPerformanceWeekly.findMany({
        where: { weekEnding: { gte: trendStart, lte: weekDate } },
        orderBy: [{ weekEnding: 'asc' }, { region: 'asc' }],
      }),
    ]);

    // Resolve targets for each team
    const teams = await Promise.all(
      ALL_REGIONS.map(async (region) => {
        const actual = teamActuals.find(t => t.region === region);
        const target = await TargetService.getTargetForWeek('team_revenue', weekDate, region);
        const actualAmount = actual ? Number(actual.actualInvoiced) : 0;
        const targetAmount = target ? Number(target.amount) : 0;
        const pct = targetAmount > 0 ? Number(((actualAmount / targetAmount) * 100).toFixed(1)) : 0;

        return {
          region,
          label: REGION_LABELS[region],
          actual: actualAmount,
          target: targetAmount,
          percentageToTarget: pct,
          variance: Number((actualAmount - targetAmount).toFixed(2)),
          color: pct >= 80 ? 'green' : pct >= 50 ? 'amber' : 'red',
        };
      })
    );

    // Build trend data: { weekEnding, [region]: actualInvoiced }
    // Also collect targets per region for dashed lines
    const trendMap = new Map<string, Record<string, number>>();
    for (const row of teamTrend) {
      const wk = (row.weekEnding as Date).toISOString().split('T')[0];
      if (!trendMap.has(wk)) trendMap.set(wk, {});
      const entry = trendMap.get(wk)!;
      entry[row.region] = Number(row.actualInvoiced);
    }

    const trendData = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekEnding, values]) => ({ weekEnding, ...values }));

    // Targets per region (for chart reference lines)
    const targetMap: Record<string, number> = {};
    for (const t of teams) {
      targetMap[t.region] = t.target;
    }

    // Drill-down: weekly detail per team (13-week window)
    const drillDown: Record<string, Array<{ weekEnding: string; actual: number; target: number; pct: number }>> = {};
    for (const region of ALL_REGIONS) {
      const regionRows = teamTrend.filter(r => r.region === region);
      const target = await TargetService.getTargetForWeek('team_revenue', weekDate, region);
      const targetAmt = target ? Number(target.amount) : 0;

      drillDown[region] = regionRows.map(r => {
        const actual = Number(r.actualInvoiced);
        return {
          weekEnding: (r.weekEnding as Date).toISOString().split('T')[0],
          actual,
          target: targetAmt,
          pct: targetAmt > 0 ? Number(((actual / targetAmt) * 100).toFixed(1)) : 0,
        };
      });
    }

    res.json({
      weekEnding: weekDate.toISOString().split('T')[0],
      hasData: teamActuals.length > 0,
      teams,
      trend: trendData,
      targets: targetMap,
      drillDown,
      regionLabels: REGION_LABELS,
    });
  } catch (err) { next(err); }
});

export default router;
