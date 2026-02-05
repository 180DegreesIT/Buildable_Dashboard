import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { PrismaClient } from './generated/prisma/client.js';

const prisma = new PrismaClient();

// Week ending 25 Jan 2025 (Saturday) — Week 30 from the Excel data
const WEEK_30 = new Date('2025-01-25');

async function main() {
  console.log('Seeding database...');

  // ─── Users ────────────────────────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@buildable.com.au' },
    update: {},
    create: {
      email: 'admin@buildable.com.au',
      displayName: 'Dev Admin',
      role: 'super_admin',
      isActive: true,
    },
  });

  const rodUser = await prisma.user.upsert({
    where: { email: 'rod@buildable.com.au' },
    update: {},
    create: {
      email: 'rod@buildable.com.au',
      displayName: 'Rod',
      role: 'executive',
      isActive: true,
    },
  });

  console.log('  Users seeded');

  // ─── User Permissions ─────────────────────────────────────────────────────
  const allPages = [
    'executive_summary', 'financial_deep_dive', 'pl_monthly_detail',
    'sales_pipeline', 'marketing_leads', 'operations_productivity',
    'regional_performance', 'cash_position', 'data_management',
    'target_management', 'staff_management', 'admin_settings',
    'user_permission_management',
  ] as const;

  for (const page of allPages) {
    await prisma.userPermission.upsert({
      where: { userId_page: { userId: adminUser.id, page } },
      update: {},
      create: { userId: adminUser.id, page, permissionLevel: 'write' },
    });
  }
  console.log('  User permissions seeded');

  // ─── Financial Weekly ─────────────────────────────────────────────────────
  await prisma.financialWeekly.upsert({
    where: { weekEnding: WEEK_30 },
    update: {},
    create: {
      weekEnding: WEEK_30,
      totalTradingIncome: 310523.45,
      totalCostOfSales: 48210.30,
      grossProfit: 262313.15,
      otherIncome: 1250.00,
      operatingExpenses: 24352.70,
      wagesAndSalaries: 177000.00,
      netProfit: 62210.45,
      dataSource: 'backfilled',
    },
  });
  console.log('  Financial weekly seeded');

  // ─── Revenue Weekly ───────────────────────────────────────────────────────
  const revenueCategories: Array<{ category: any; amount: number }> = [
    { category: 'class_1a', amount: 95420.00 },
    { category: 'class_10a_sheds', amount: 12340.00 },
    { category: 'class_10b_pools', amount: 8750.00 },
    { category: 'class_2_9_commercial', amount: 57003.00 },
    { category: 'inspections', amount: 18960.00 },
    { category: 'retrospective', amount: 3490.00 },
    { category: 'council_fees', amount: 42100.00 },
    { category: 'planning_1_10', amount: 15200.00 },
    { category: 'planning_2_9', amount: 8750.00 },
    { category: 'property_searches', amount: 4200.00 },
    { category: 'qleave', amount: 6800.00 },
    { category: 'sundry', amount: 2100.00 },
    { category: 'access_labour_hire', amount: 13711.00 },
    { category: 'insurance_levy', amount: 21699.45 },
  ];

  for (const { category, amount } of revenueCategories) {
    await prisma.revenueWeekly.upsert({
      where: { weekEnding_category: { weekEnding: WEEK_30, category } },
      update: {},
      create: { weekEnding: WEEK_30, category, amount, dataSource: 'backfilled' },
    });
  }
  console.log('  Revenue weekly seeded');

  // ─── Projects Weekly ──────────────────────────────────────────────────────
  const projects: Array<{ projectType: any; hyperfloCount: number; xeroInvoicedAmount: number; newBusinessPercentage?: number }> = [
    { projectType: 'residential', hyperfloCount: 142, xeroInvoicedAmount: 182348.00, newBusinessPercentage: 34.5 },
    { projectType: 'commercial', hyperfloCount: 23, xeroInvoicedAmount: 57003.00 },
    { projectType: 'retrospective', hyperfloCount: 8, xeroInvoicedAmount: 3490.00 },
  ];

  for (const p of projects) {
    await prisma.projectsWeekly.upsert({
      where: { weekEnding_projectType: { weekEnding: WEEK_30, projectType: p.projectType } },
      update: {},
      create: {
        weekEnding: WEEK_30,
        projectType: p.projectType,
        hyperfloCount: p.hyperfloCount,
        xeroInvoicedAmount: p.xeroInvoicedAmount,
        newBusinessPercentage: p.newBusinessPercentage ?? null,
        dataSource: 'backfilled',
      },
    });
  }
  console.log('  Projects weekly seeded');

  // ─── Sales Weekly ─────────────────────────────────────────────────────────
  const sales: Array<{ salesType: any; issuedCount: number; issuedValue: number; wonCount: number; wonValue: number }> = [
    { salesType: 'residential', issuedCount: 85, issuedValue: 245000.00, wonCount: 52, wonValue: 158000.00 },
    { salesType: 'commercial', issuedCount: 12, issuedValue: 180000.00, wonCount: 6, wonValue: 95000.00 },
    { salesType: 'retrospective', issuedCount: 5, issuedValue: 12000.00, wonCount: 4, wonValue: 9800.00 },
  ];

  for (const s of sales) {
    await prisma.salesWeekly.upsert({
      where: { weekEnding_salesType: { weekEnding: WEEK_30, salesType: s.salesType } },
      update: {},
      create: {
        weekEnding: WEEK_30,
        salesType: s.salesType,
        quotesIssuedCount: s.issuedCount,
        quotesIssuedValue: s.issuedValue,
        quotesWonCount: s.wonCount,
        quotesWonValue: s.wonValue,
        dataSource: 'backfilled',
      },
    });
  }
  console.log('  Sales weekly seeded');

  // ─── Sales Regional Weekly ────────────────────────────────────────────────
  await prisma.salesRegionalWeekly.upsert({
    where: { weekEnding_region_salesType: { weekEnding: WEEK_30, region: 'seq_residential', salesType: 'residential' } },
    update: {},
    create: {
      weekEnding: WEEK_30,
      region: 'seq_residential',
      salesType: 'residential',
      quotesIssuedCount: 32,
      quotesIssuedValue: 95000.00,
      quotesWonCount: 20,
      quotesWonValue: 62000.00,
      dataSource: 'backfilled',
    },
  });
  console.log('  Sales regional weekly seeded');

  // ─── Team Performance Weekly ──────────────────────────────────────────────
  const teams: Array<{ region: any; actualInvoiced: number }> = [
    { region: 'cairns', actualInvoiced: 24560.60 },
    { region: 'mackay', actualInvoiced: 11340.25 },
    { region: 'nq_commercial', actualInvoiced: 35820.60 },
    { region: 'seq_residential', actualInvoiced: 73838.32 },
    { region: 'seq_commercial', actualInvoiced: 21450.80 },
    { region: 'town_planning', actualInvoiced: 14320.50 },
    { region: 'townsville', actualInvoiced: 28975.40 },
    { region: 'wide_bay', actualInvoiced: 42150.75 },
    { region: 'all_in_access', actualInvoiced: 13711.00 },
  ];

  for (const t of teams) {
    await prisma.teamPerformanceWeekly.upsert({
      where: { weekEnding_region: { weekEnding: WEEK_30, region: t.region } },
      update: {},
      create: {
        weekEnding: WEEK_30,
        region: t.region,
        actualInvoiced: t.actualInvoiced,
        dataSource: 'backfilled',
      },
    });
  }
  console.log('  Team performance weekly seeded');

  // ─── Leads Weekly ─────────────────────────────────────────────────────────
  const leads: Array<{ source: any; leadCount: number; costPerLead?: number; totalCost?: number }> = [
    { source: 'google', leadCount: 70, costPerLead: 28.50, totalCost: 1995.00 },
    { source: 'seo', leadCount: 118, costPerLead: 0, totalCost: 0 },
    { source: 'meta', leadCount: 35, costPerLead: 22.80, totalCost: 798.00 },
    { source: 'bing', leadCount: 12, costPerLead: 31.20, totalCost: 374.40 },
    { source: 'tiktok', leadCount: 8, costPerLead: 18.50, totalCost: 148.00 },
    { source: 'other', leadCount: 14.03 },
  ];

  for (const l of leads) {
    await prisma.leadsWeekly.upsert({
      where: { weekEnding_source: { weekEnding: WEEK_30, source: l.source } },
      update: {},
      create: {
        weekEnding: WEEK_30,
        source: l.source,
        leadCount: l.leadCount,
        costPerLead: l.costPerLead ?? null,
        totalCost: l.totalCost ?? null,
        dataSource: 'backfilled',
      },
    });
  }
  console.log('  Leads weekly seeded');

  // ─── Marketing Performance Weekly ─────────────────────────────────────────
  await prisma.marketingPerformanceWeekly.upsert({
    where: { weekEnding_platform: { weekEnding: WEEK_30, platform: 'google_ads' } },
    update: {},
    create: {
      weekEnding: WEEK_30,
      platform: 'google_ads',
      impressions: 45200,
      clicks: 1820,
      cost: 1995.00,
      conversions: 70,
      ctr: 0.0403,
      cpc: 1.10,
      dataSource: 'backfilled',
    },
  });
  console.log('  Marketing performance weekly seeded');

  // ─── Website Analytics Weekly ─────────────────────────────────────────────
  await prisma.websiteAnalyticsWeekly.upsert({
    where: { weekEnding: WEEK_30 },
    update: {},
    create: {
      weekEnding: WEEK_30,
      sessions: 3250,
      users: 2180,
      pageViews: 8420,
      bounceRate: 42.5,
      avgSessionDuration: 185.30,
      newUsers: 1540,
      dataSource: 'backfilled',
    },
  });
  console.log('  Website analytics weekly seeded');

  // ─── Staff Productivity Weekly ────────────────────────────────────────────
  await prisma.staffProductivityWeekly.upsert({
    where: { weekEnding_staffName: { weekEnding: WEEK_30, staffName: 'John Smith' } },
    update: {},
    create: {
      weekEnding: WEEK_30,
      staffName: 'John Smith',
      role: 'certifier',
      region: 'seq_residential',
      jobsCompleted: 28,
      revenueGenerated: 18500.00,
      inspectionsCompleted: 35,
      dataSource: 'backfilled',
    },
  });
  console.log('  Staff productivity weekly seeded');

  // ─── Phone Weekly ─────────────────────────────────────────────────────────
  await prisma.phoneWeekly.upsert({
    where: { weekEnding_staffName: { weekEnding: WEEK_30, staffName: 'John Smith' } },
    update: {},
    create: {
      weekEnding: WEEK_30,
      staffName: 'John Smith',
      inboundCalls: 45,
      outboundCalls: 22,
      missedCalls: 3,
      avgCallDuration: 3.25,
      dataSource: 'backfilled',
    },
  });
  console.log('  Phone weekly seeded');

  // ─── Cash Position Weekly ─────────────────────────────────────────────────
  await prisma.cashPositionWeekly.upsert({
    where: { weekEnding: WEEK_30 },
    update: {},
    create: {
      weekEnding: WEEK_30,
      everydayAccount: 125430.50,
      overdraftLimit: 200000.00,
      taxSavings: 85000.00,
      capitalAccount: 42000.00,
      creditCards: -8500.00,
      totalCashAvailable: 443930.50,
      totalReceivables: 320000.00,
      currentReceivables: 180000.00,
      over30Days: 85000.00,
      over60Days: 35000.00,
      over90Days: 20000.00,
      totalPayables: 95000.00,
      dataSource: 'backfilled',
    },
  });
  console.log('  Cash position weekly seeded');

  // ─── Google Reviews Weekly ────────────────────────────────────────────────
  await prisma.googleReviewsWeekly.upsert({
    where: { weekEnding: WEEK_30 },
    update: {},
    create: {
      weekEnding: WEEK_30,
      reviewCount: 3,
      averageRating: 4.80,
      cumulativeCount: 287,
      cumulativeAverageRating: 4.72,
      dataSource: 'backfilled',
    },
  });
  console.log('  Google reviews weekly seeded');

  // ─── Upcoming Liabilities ─────────────────────────────────────────────────
  const existingLiability = await prisma.upcomingLiability.findFirst({
    where: { description: 'BAS Payment Q2 FY25' },
  });
  if (!existingLiability) {
    await prisma.upcomingLiability.create({
      data: {
        description: 'BAS Payment Q2 FY25',
        amount: 45000.00,
        dueDate: new Date('2025-02-28'),
        liabilityType: 'recurring',
        isActive: true,
      },
    });
  }
  console.log('  Upcoming liabilities seeded');

  // ─── Targets ──────────────────────────────────────────────────────────────
  const targetData: Array<{ targetType: any; entity?: any; amount: number }> = [
    { targetType: 'net_profit', amount: 40203.00 },
    { targetType: 'residential_revenue', amount: 182348.00 },
    { targetType: 'commercial_revenue', amount: 57003.00 },
    { targetType: 'retrospective_revenue', amount: 3490.00 },
    { targetType: 'team_revenue', entity: 'cairns', amount: 38580.00 },
    { targetType: 'team_revenue', entity: 'mackay', amount: 12620.00 },
    { targetType: 'team_revenue', entity: 'nq_commercial', amount: 16248.00 },
    { targetType: 'team_revenue', entity: 'seq_residential', amount: 51888.00 },
    { targetType: 'team_revenue', entity: 'seq_commercial', amount: 19669.00 },
    { targetType: 'team_revenue', entity: 'town_planning', amount: 12199.00 },
    { targetType: 'team_revenue', entity: 'townsville', amount: 30572.00 },
    { targetType: 'team_revenue', entity: 'wide_bay', amount: 47352.00 },
    { targetType: 'team_revenue', entity: 'all_in_access', amount: 13711.00 },
  ];

  for (const t of targetData) {
    const existing = await prisma.target.findFirst({
      where: { targetType: t.targetType, entity: t.entity ?? null, effectiveFrom: new Date('2024-07-06') },
    });
    if (!existing) {
      await prisma.target.create({
        data: {
          targetType: t.targetType,
          entity: t.entity ?? null,
          amount: t.amount,
          effectiveFrom: new Date('2024-07-06'),
          setBy: 'System (initial seed)',
          notes: 'Initial target from Excel workbook',
        },
      });
    }
  }
  console.log('  Targets seeded');

  // ─── Target History ───────────────────────────────────────────────────────
  const netProfitTarget = await prisma.target.findFirst({ where: { targetType: 'net_profit' } });
  if (netProfitTarget) {
    const existingHistory = await prisma.targetHistory.findFirst({
      where: { targetId: netProfitTarget.id },
    });
    if (!existingHistory) {
      await prisma.targetHistory.create({
        data: {
          targetId: netProfitTarget.id,
          previousAmount: 35000.00,
          newAmount: 40203.00,
          changedBy: 'Rod',
          notes: 'Updated budget for FY25 Q2',
        },
      });
    }
  }
  console.log('  Target history seeded');

  // ─── CSV Column Mappings ──────────────────────────────────────────────────
  const existingMapping = await prisma.csvColumnMapping.findFirst({
    where: { name: 'Financial P&L Standard' },
  });
  if (!existingMapping) {
    await prisma.csvColumnMapping.create({
      data: {
        name: 'Financial P&L Standard',
        dataType: 'financial_pl',
        mapping: {
          'Week Ending': 'weekEnding',
          'Total Trading Income': 'totalTradingIncome',
          'Cost of Sales': 'totalCostOfSales',
          'Gross Profit': 'grossProfit',
          'Other Income': 'otherIncome',
          'Operating Expenses': 'operatingExpenses',
          'Wages & Salaries': 'wagesAndSalaries',
          'Net Profit': 'netProfit',
        },
        createdBy: 'System',
      },
    });
  }
  console.log('  CSV column mappings seeded');

  // ─── CSV Uploads ──────────────────────────────────────────────────────────
  const existingUpload = await prisma.csvUpload.findFirst({
    where: { fileName: 'seed_financial_data.csv' },
  });
  if (!existingUpload) {
    await prisma.csvUpload.create({
      data: {
        fileName: 'seed_financial_data.csv',
        dataType: 'financial_pl',
        rowsProcessed: 1,
        rowsFailed: 0,
        rowsSkipped: 0,
        status: 'completed',
        uploadedBy: 'System (seed)',
      },
    });
  }
  console.log('  CSV uploads seeded');

  // ─── Settings ─────────────────────────────────────────────────────────────
  await prisma.setting.upsert({
    where: { key: 'branding' },
    update: {},
    create: {
      key: 'branding',
      value: {
        companyName: 'Buildable Approvals Pty Ltd',
        primaryColour: '#4573D2',
        accentColour: '#6AAF50',
      },
    },
  });

  await prisma.setting.upsert({
    where: { key: 'passthrough_items' },
    update: {},
    create: {
      key: 'passthrough_items',
      value: ['council_fees', 'insurance_levy'],
    },
  });

  await prisma.setting.upsert({
    where: { key: 'alert_thresholds' },
    update: {},
    create: {
      key: 'alert_thresholds',
      value: {
        netProfitBelowBudgetWeeks: 2,
        teamBelowTargetPercent: 50,
        cashNearOverdraftAmount: 50000,
      },
    },
  });
  console.log('  Settings seeded');

  console.log('\nSeed complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
