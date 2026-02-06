/**
 * ExcelMigrationService — Main migration orchestrator.
 *
 * Parses an Excel workbook using 6 sheet-specific parsers, aggregates results
 * into a dry-run preview, and performs idempotent Prisma upserts with
 * SSE progress streaming via EventEmitter.
 */
import { EventEmitter } from 'events';
import ExcelJS from 'exceljs';
import prisma from '../db.js';
import { WeeklyReportParser } from './SheetParsers/WeeklyReportParser.js';
import { RevenueReportParser } from './SheetParsers/RevenueReportParser.js';
import { FinanceThisWeekParser } from './SheetParsers/FinanceThisWeekParser.js';
import { ProductivityParser } from './SheetParsers/ProductivityParser.js';
import { PhoneParser } from './SheetParsers/PhoneParser.js';
import { MarketingParser } from './SheetParsers/MarketingParser.js';
import { WeekService } from './WeekService.js';

// ─── Progress Emitter ─────────────────────────────────────────────────────────

export const migrationEmitter = new EventEmitter();
migrationEmitter.setMaxListeners(20);

export interface ProgressEvent {
  phase: 'parsing' | 'importing' | 'complete' | 'error';
  sheet?: string;
  table?: string;
  current: number;
  total: number;
  warnings: number;
  message: string;
}

function emitProgress(jobId: string, event: ProgressEvent) {
  migrationEmitter.emit(jobId, event);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DryRunResult {
  tables: Array<{
    tableName: string;
    recordCount: number;
    sampleRecords: Array<Record<string, any>>;
    warnings: string[];
  }>;
  totalRecords: number;
  totalWarnings: number;
  allWarnings: string[];
}

export interface MigrationResult {
  success: boolean;
  tables: Array<{
    tableName: string;
    inserted: number;
    updated: number;
    warnings: string[];
  }>;
  totalInserted: number;
  totalUpdated: number;
  totalWarnings: number;
  allWarnings: string[];
}

interface ParsedData {
  financial: Array<{ weekDate: Date; values: Record<string, number | null>; warnings: string[] }>;
  projects: Array<{ weekDate: Date; projectType: string; values: Record<string, number | null>; warnings: string[] }>;
  sales: Array<{ weekDate: Date; salesType: string; values: Record<string, number | null>; warnings: string[] }>;
  leads: Array<{ weekDate: Date; source: string; values: Record<string, number | null>; warnings: string[] }>;
  googleReviews: Array<{ weekDate: Date; values: Record<string, number | null>; warnings: string[] }>;
  teamPerformance: Array<{ weekDate: Date; region: string; values: Record<string, number | null>; warnings: string[] }>;
  revenue: Array<{ weekDate: Date; category: string; amount: number | null; warnings: string[] }>;
  cashPosition: Array<{ weekDate: Date; values: Record<string, number | null>; warnings: string[] }>;
  productivity: Array<{ weekDate: Date; staffName: string; role: string; values: Record<string, any>; warnings: string[] }>;
  phone: Array<{ weekDate: Date; staffName: string; values: Record<string, any>; warnings: string[] }>;
  marketing: Array<{ weekDate: Date; platform: string; values: Record<string, any>; warnings: string[] }>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ExcelMigrationService {
  private weeklyReportParser = new WeeklyReportParser();
  private revenueReportParser = new RevenueReportParser();
  private financeThisWeekParser = new FinanceThisWeekParser();
  private productivityParser = new ProductivityParser();
  private phoneParser = new PhoneParser();
  private marketingParser = new MarketingParser();

  /**
   * Parse the workbook and return a dry-run preview with record counts and sample data.
   */
  async parseWorkbook(input: string | Buffer): Promise<DryRunResult> {
    const wb = new ExcelJS.Workbook();
    if (typeof input === 'string') {
      await wb.xlsx.readFile(input);
    } else {
      await wb.xlsx.load(input as any);
    }

    const parsed = this.runParsers(wb);
    return this.buildDryRunResult(parsed);
  }

  /**
   * Full import with progress streaming.
   */
  async importData(input: string | Buffer, jobId: string): Promise<MigrationResult> {
    try {
      emitProgress(jobId, {
        phase: 'parsing',
        message: 'Loading workbook...',
        current: 0,
        total: 0,
        warnings: 0,
      });

      const wb = new ExcelJS.Workbook();
      if (typeof input === 'string') {
        await wb.xlsx.readFile(input);
      } else {
        await wb.xlsx.load(input as any);
      }

      emitProgress(jobId, {
        phase: 'parsing',
        message: 'Parsing sheets...',
        current: 0,
        total: 6,
        warnings: 0,
      });

      const parsed = this.runParsers(wb);

      // Calculate total records
      const totalRecords =
        parsed.financial.length +
        parsed.projects.length +
        parsed.sales.length +
        parsed.leads.length +
        parsed.googleReviews.length +
        parsed.teamPerformance.length +
        parsed.revenue.length +
        parsed.cashPosition.length +
        parsed.productivity.length +
        parsed.phone.length +
        parsed.marketing.length;

      emitProgress(jobId, {
        phase: 'parsing',
        message: `Parsed ${totalRecords} records from workbook`,
        current: 6,
        total: 6,
        warnings: 0,
      });

      // Import each table group
      const results: MigrationResult['tables'] = [];
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalWarnings = 0;
      const allWarnings: string[] = [];
      let importedSoFar = 0;

      const tableImports: Array<{
        tableName: string;
        importFn: () => Promise<{ inserted: number; updated: number; warnings: string[] }>;
      }> = [
        { tableName: 'financial_weekly', importFn: () => this.upsertFinancial(parsed.financial) },
        { tableName: 'projects_weekly', importFn: () => this.upsertProjects(parsed.projects) },
        { tableName: 'sales_weekly', importFn: () => this.upsertSales(parsed.sales) },
        { tableName: 'leads_weekly', importFn: () => this.upsertLeads(parsed.leads) },
        { tableName: 'google_reviews_weekly', importFn: () => this.upsertGoogleReviews(parsed.googleReviews) },
        { tableName: 'team_performance_weekly', importFn: () => this.upsertTeamPerformance(parsed.teamPerformance) },
        { tableName: 'revenue_weekly', importFn: () => this.upsertRevenue(parsed.revenue) },
        { tableName: 'cash_position_weekly', importFn: () => this.upsertCashPosition(parsed.cashPosition) },
        { tableName: 'staff_productivity_weekly', importFn: () => this.upsertProductivity(parsed.productivity) },
        { tableName: 'phone_weekly', importFn: () => this.upsertPhone(parsed.phone) },
        { tableName: 'marketing_performance_weekly', importFn: () => this.upsertMarketing(parsed.marketing) },
      ];

      for (const ti of tableImports) {
        emitProgress(jobId, {
          phase: 'importing',
          table: ti.tableName,
          message: `Importing ${ti.tableName}...`,
          current: importedSoFar,
          total: totalRecords,
          warnings: totalWarnings,
        });

        try {
          const result = await ti.importFn();
          results.push({
            tableName: ti.tableName,
            inserted: result.inserted,
            updated: result.updated,
            warnings: result.warnings,
          });
          totalInserted += result.inserted;
          totalUpdated += result.updated;
          totalWarnings += result.warnings.length;
          allWarnings.push(...result.warnings);
          importedSoFar += result.inserted + result.updated;
        } catch (err: any) {
          const errMsg = `Error importing ${ti.tableName}: ${err.message}`;
          results.push({
            tableName: ti.tableName,
            inserted: 0,
            updated: 0,
            warnings: [errMsg],
          });
          totalWarnings++;
          allWarnings.push(errMsg);
        }
      }

      emitProgress(jobId, {
        phase: 'complete',
        message: `Import complete: ${totalInserted} inserted, ${totalUpdated} updated`,
        current: totalRecords,
        total: totalRecords,
        warnings: totalWarnings,
      });

      return {
        success: true,
        tables: results,
        totalInserted,
        totalUpdated,
        totalWarnings,
        allWarnings,
      };
    } catch (err: any) {
      emitProgress(jobId, {
        phase: 'error',
        message: `Import failed: ${err.message}`,
        current: 0,
        total: 0,
        warnings: 0,
      });

      return {
        success: false,
        tables: [],
        totalInserted: 0,
        totalUpdated: 0,
        totalWarnings: 1,
        allWarnings: [`Import failed: ${err.message}`],
      };
    }
  }

  // ─── Internal Parsers ─────────────────────────────────────────────────────────

  private runParsers(wb: ExcelJS.Workbook): ParsedData {
    // Parse Weekly Report (Sheet 1) — extracts 6 table groups
    let weeklyResult;
    try {
      weeklyResult = this.weeklyReportParser.parse(wb);
    } catch (err: any) {
      console.error(`[Migration] Error parsing Weekly Report: ${err.message}`);
      weeklyResult = {
        financial: [],
        projects: [],
        sales: [],
        leads: [],
        googleReviews: [],
        teamPerformance: [],
      };
    }

    // Parse Revenue Report (Sheet 7)
    let revenue: ParsedData['revenue'] = [];
    try {
      revenue = this.revenueReportParser.parse(wb);
    } catch (err: any) {
      console.error(`[Migration] Error parsing Revenue Report: ${err.message}`);
      revenue = [];
    }

    // Parse Finance This Week (Sheet 6) — single-week snapshot
    // Use most recent Saturday from financial data as the week date
    let cashPosition: ParsedData['cashPosition'] = [];
    try {
      const latestWeekDate = weeklyResult.financial.length > 0
        ? weeklyResult.financial[weeklyResult.financial.length - 1].weekDate
        : WeekService.getCurrentWeekEnding();

      const cashResult = this.financeThisWeekParser.parse(wb, latestWeekDate);
      if (cashResult) {
        cashPosition = [cashResult];
      }
    } catch (err: any) {
      console.error(`[Migration] Error parsing Finance This Week: ${err.message}`);
    }

    // Parse Productivity (Sheet 12)
    let productivity: ParsedData['productivity'] = [];
    try {
      productivity = this.productivityParser.parse(wb);
    } catch (err: any) {
      console.error(`[Migration] Error parsing Productivity: ${err.message}`);
      productivity = [];
    }

    // Parse Phone (Sheet 16)
    let phone: ParsedData['phone'] = [];
    try {
      phone = this.phoneParser.parse(wb);
    } catch (err: any) {
      console.error(`[Migration] Error parsing Phone: ${err.message}`);
      phone = [];
    }

    // Parse Marketing (Sheets 9+10)
    let marketing: ParsedData['marketing'] = [];
    try {
      marketing = this.marketingParser.parse(wb);
    } catch (err: any) {
      console.error(`[Migration] Error parsing Marketing: ${err.message}`);
      marketing = [];
    }

    return {
      financial: weeklyResult.financial,
      projects: weeklyResult.projects,
      sales: weeklyResult.sales,
      leads: weeklyResult.leads,
      googleReviews: weeklyResult.googleReviews,
      teamPerformance: weeklyResult.teamPerformance,
      revenue,
      cashPosition,
      productivity,
      phone,
      marketing,
    };
  }

  private buildDryRunResult(parsed: ParsedData): DryRunResult {
    const tables: DryRunResult['tables'] = [];
    const allWarnings: string[] = [];

    const addTable = (
      tableName: string,
      records: Array<{ weekDate: Date; values?: Record<string, any>; warnings: string[]; [key: string]: any }>,
    ) => {
      const warnings: string[] = [];
      for (const r of records) {
        warnings.push(...r.warnings);
      }
      allWarnings.push(...warnings);

      tables.push({
        tableName,
        recordCount: records.length,
        sampleRecords: records.slice(0, 3).map((r) => ({
          weekDate: r.weekDate,
          ...r.values,
          ...(r.projectType ? { projectType: r.projectType } : {}),
          ...(r.salesType ? { salesType: r.salesType } : {}),
          ...(r.source ? { source: r.source } : {}),
          ...(r.region ? { region: r.region } : {}),
          ...(r.category ? { category: r.category, amount: r.amount } : {}),
          ...(r.staffName ? { staffName: r.staffName } : {}),
          ...(r.role ? { role: r.role } : {}),
          ...(r.platform ? { platform: r.platform } : {}),
        })),
        warnings,
      });
    };

    addTable('financial_weekly', parsed.financial);
    addTable('projects_weekly', parsed.projects);
    addTable('sales_weekly', parsed.sales);
    addTable('leads_weekly', parsed.leads);
    addTable('google_reviews_weekly', parsed.googleReviews);
    addTable('team_performance_weekly', parsed.teamPerformance);
    addTable('revenue_weekly', parsed.revenue as any);
    addTable('cash_position_weekly', parsed.cashPosition);
    addTable('staff_productivity_weekly', parsed.productivity as any);
    addTable('phone_weekly', parsed.phone as any);
    addTable('marketing_performance_weekly', parsed.marketing as any);

    return {
      tables,
      totalRecords: tables.reduce((sum, t) => sum + t.recordCount, 0),
      totalWarnings: allWarnings.length,
      allWarnings,
    };
  }

  // ─── Upsert Methods ──────────────────────────────────────────────────────────

  private async upsertFinancial(
    records: ParsedData['financial'],
  ): Promise<{ inserted: number; updated: number; warnings: string[] }> {
    let inserted = 0;
    let updated = 0;
    const warnings: string[] = [];

    for (const rec of records) {
      warnings.push(...rec.warnings);
      const existing = await prisma.financialWeekly.findUnique({
        where: { weekEnding: rec.weekDate },
      });

      await prisma.financialWeekly.upsert({
        where: { weekEnding: rec.weekDate },
        update: {
          totalTradingIncome: rec.values.totalTradingIncome ?? 0,
          totalCostOfSales: rec.values.totalCostOfSales ?? 0,
          grossProfit: rec.values.grossProfit ?? 0,
          otherIncome: rec.values.otherIncome ?? 0,
          operatingExpenses: rec.values.operatingExpenses ?? 0,
          wagesAndSalaries: rec.values.wagesAndSalaries ?? 0,
          netProfit: rec.values.netProfit ?? 0,
          dataSource: 'backfilled',
        },
        create: {
          weekEnding: rec.weekDate,
          totalTradingIncome: rec.values.totalTradingIncome ?? 0,
          totalCostOfSales: rec.values.totalCostOfSales ?? 0,
          grossProfit: rec.values.grossProfit ?? 0,
          otherIncome: rec.values.otherIncome ?? 0,
          operatingExpenses: rec.values.operatingExpenses ?? 0,
          wagesAndSalaries: rec.values.wagesAndSalaries ?? 0,
          netProfit: rec.values.netProfit ?? 0,
          dataSource: 'backfilled',
        },
      });

      if (existing) updated++;
      else inserted++;
    }

    return { inserted, updated, warnings };
  }

  private async upsertProjects(
    records: ParsedData['projects'],
  ): Promise<{ inserted: number; updated: number; warnings: string[] }> {
    let inserted = 0;
    let updated = 0;
    const warnings: string[] = [];

    for (const rec of records) {
      warnings.push(...rec.warnings);
      const projectType = rec.projectType as any;

      const existing = await prisma.projectsWeekly.findUnique({
        where: {
          weekEnding_projectType: {
            weekEnding: rec.weekDate,
            projectType,
          },
        },
      });

      await prisma.projectsWeekly.upsert({
        where: {
          weekEnding_projectType: {
            weekEnding: rec.weekDate,
            projectType,
          },
        },
        update: {
          hyperfloCount: Math.round(rec.values.hyperfloCount ?? 0),
          xeroInvoicedAmount: rec.values.xeroInvoicedAmount ?? 0,
          newBusinessPercentage: rec.values.newBusinessPercentage ?? null,
          dataSource: 'backfilled',
        },
        create: {
          weekEnding: rec.weekDate,
          projectType,
          hyperfloCount: Math.round(rec.values.hyperfloCount ?? 0),
          xeroInvoicedAmount: rec.values.xeroInvoicedAmount ?? 0,
          newBusinessPercentage: rec.values.newBusinessPercentage ?? null,
          dataSource: 'backfilled',
        },
      });

      if (existing) updated++;
      else inserted++;
    }

    return { inserted, updated, warnings };
  }

  private async upsertSales(
    records: ParsedData['sales'],
  ): Promise<{ inserted: number; updated: number; warnings: string[] }> {
    let inserted = 0;
    let updated = 0;
    const warnings: string[] = [];

    for (const rec of records) {
      warnings.push(...rec.warnings);
      const salesType = rec.salesType as any;

      const existing = await prisma.salesWeekly.findUnique({
        where: {
          weekEnding_salesType: {
            weekEnding: rec.weekDate,
            salesType,
          },
        },
      });

      await prisma.salesWeekly.upsert({
        where: {
          weekEnding_salesType: {
            weekEnding: rec.weekDate,
            salesType,
          },
        },
        update: {
          quotesIssuedCount: Math.round(rec.values.quotesIssuedCount ?? 0),
          quotesIssuedValue: rec.values.quotesIssuedValue ?? 0,
          quotesWonCount: Math.round(rec.values.quotesWonCount ?? 0),
          quotesWonValue: rec.values.quotesWonValue ?? 0,
          dataSource: 'backfilled',
        },
        create: {
          weekEnding: rec.weekDate,
          salesType,
          quotesIssuedCount: Math.round(rec.values.quotesIssuedCount ?? 0),
          quotesIssuedValue: rec.values.quotesIssuedValue ?? 0,
          quotesWonCount: Math.round(rec.values.quotesWonCount ?? 0),
          quotesWonValue: rec.values.quotesWonValue ?? 0,
          dataSource: 'backfilled',
        },
      });

      if (existing) updated++;
      else inserted++;
    }

    return { inserted, updated, warnings };
  }

  private async upsertLeads(
    records: ParsedData['leads'],
  ): Promise<{ inserted: number; updated: number; warnings: string[] }> {
    let inserted = 0;
    let updated = 0;
    const warnings: string[] = [];

    for (const rec of records) {
      warnings.push(...rec.warnings);
      const source = rec.source as any;

      const existing = await prisma.leadsWeekly.findUnique({
        where: {
          weekEnding_source: {
            weekEnding: rec.weekDate,
            source,
          },
        },
      });

      await prisma.leadsWeekly.upsert({
        where: {
          weekEnding_source: {
            weekEnding: rec.weekDate,
            source,
          },
        },
        update: {
          leadCount: rec.values.leadCount ?? 0,
          costPerLead: rec.values.costPerLead ?? null,
          totalCost: rec.values.totalCost ?? null,
          dataSource: 'backfilled',
        },
        create: {
          weekEnding: rec.weekDate,
          source,
          leadCount: rec.values.leadCount ?? 0,
          costPerLead: rec.values.costPerLead ?? null,
          totalCost: rec.values.totalCost ?? null,
          dataSource: 'backfilled',
        },
      });

      if (existing) updated++;
      else inserted++;
    }

    return { inserted, updated, warnings };
  }

  private async upsertGoogleReviews(
    records: ParsedData['googleReviews'],
  ): Promise<{ inserted: number; updated: number; warnings: string[] }> {
    let inserted = 0;
    let updated = 0;
    const warnings: string[] = [];

    for (const rec of records) {
      warnings.push(...rec.warnings);

      const existing = await prisma.googleReviewsWeekly.findUnique({
        where: { weekEnding: rec.weekDate },
      });

      await prisma.googleReviewsWeekly.upsert({
        where: { weekEnding: rec.weekDate },
        update: {
          reviewCount: Math.round(rec.values.reviewCount ?? 0),
          dataSource: 'backfilled',
        },
        create: {
          weekEnding: rec.weekDate,
          reviewCount: Math.round(rec.values.reviewCount ?? 0),
          dataSource: 'backfilled',
        },
      });

      if (existing) updated++;
      else inserted++;
    }

    return { inserted, updated, warnings };
  }

  private async upsertTeamPerformance(
    records: ParsedData['teamPerformance'],
  ): Promise<{ inserted: number; updated: number; warnings: string[] }> {
    let inserted = 0;
    let updated = 0;
    const warnings: string[] = [];

    for (const rec of records) {
      warnings.push(...rec.warnings);
      const region = rec.region as any;

      const existing = await prisma.teamPerformanceWeekly.findUnique({
        where: {
          weekEnding_region: {
            weekEnding: rec.weekDate,
            region,
          },
        },
      });

      await prisma.teamPerformanceWeekly.upsert({
        where: {
          weekEnding_region: {
            weekEnding: rec.weekDate,
            region,
          },
        },
        update: {
          actualInvoiced: rec.values.actualInvoiced ?? 0,
          dataSource: 'backfilled',
        },
        create: {
          weekEnding: rec.weekDate,
          region,
          actualInvoiced: rec.values.actualInvoiced ?? 0,
          dataSource: 'backfilled',
        },
      });

      if (existing) updated++;
      else inserted++;
    }

    return { inserted, updated, warnings };
  }

  private async upsertRevenue(
    records: ParsedData['revenue'],
  ): Promise<{ inserted: number; updated: number; warnings: string[] }> {
    let inserted = 0;
    let updated = 0;
    const warnings: string[] = [];

    for (const rec of records) {
      warnings.push(...rec.warnings);
      const category = rec.category as any;

      const existing = await prisma.revenueWeekly.findUnique({
        where: {
          weekEnding_category: {
            weekEnding: rec.weekDate,
            category,
          },
        },
      });

      await prisma.revenueWeekly.upsert({
        where: {
          weekEnding_category: {
            weekEnding: rec.weekDate,
            category,
          },
        },
        update: {
          amount: rec.amount ?? 0,
          dataSource: 'backfilled',
        },
        create: {
          weekEnding: rec.weekDate,
          category,
          amount: rec.amount ?? 0,
          dataSource: 'backfilled',
        },
      });

      if (existing) updated++;
      else inserted++;
    }

    return { inserted, updated, warnings };
  }

  private async upsertCashPosition(
    records: ParsedData['cashPosition'],
  ): Promise<{ inserted: number; updated: number; warnings: string[] }> {
    let inserted = 0;
    let updated = 0;
    const warnings: string[] = [];

    for (const rec of records) {
      warnings.push(...rec.warnings);

      const existing = await prisma.cashPositionWeekly.findUnique({
        where: { weekEnding: rec.weekDate },
      });

      await prisma.cashPositionWeekly.upsert({
        where: { weekEnding: rec.weekDate },
        update: {
          everydayAccount: rec.values.everydayAccount ?? null,
          taxSavings: rec.values.taxSavings ?? null,
          capitalAccount: rec.values.capitalAccount ?? null,
          creditCards: rec.values.creditCards ?? null,
          totalCashAvailable: rec.values.totalCashAvailable ?? null,
          totalReceivables: rec.values.totalReceivables ?? null,
          currentReceivables: rec.values.currentReceivables ?? null,
          over30Days: rec.values.over30Days ?? null,
          over60Days: rec.values.over60Days ?? null,
          over90Days: rec.values.over90Days ?? null,
          totalPayables: rec.values.totalPayables ?? null,
          dataSource: 'backfilled',
        },
        create: {
          weekEnding: rec.weekDate,
          everydayAccount: rec.values.everydayAccount ?? null,
          taxSavings: rec.values.taxSavings ?? null,
          capitalAccount: rec.values.capitalAccount ?? null,
          creditCards: rec.values.creditCards ?? null,
          totalCashAvailable: rec.values.totalCashAvailable ?? null,
          totalReceivables: rec.values.totalReceivables ?? null,
          currentReceivables: rec.values.currentReceivables ?? null,
          over30Days: rec.values.over30Days ?? null,
          over60Days: rec.values.over60Days ?? null,
          over90Days: rec.values.over90Days ?? null,
          totalPayables: rec.values.totalPayables ?? null,
          dataSource: 'backfilled',
        },
      });

      if (existing) updated++;
      else inserted++;
    }

    return { inserted, updated, warnings };
  }

  private async upsertProductivity(
    records: ParsedData['productivity'],
  ): Promise<{ inserted: number; updated: number; warnings: string[] }> {
    let inserted = 0;
    let updated = 0;
    const warnings: string[] = [];

    for (const rec of records) {
      warnings.push(...rec.warnings);
      const role = rec.role as any;

      const existing = await prisma.staffProductivityWeekly.findUnique({
        where: {
          weekEnding_staffName: {
            weekEnding: rec.weekDate,
            staffName: rec.staffName,
          },
        },
      });

      await prisma.staffProductivityWeekly.upsert({
        where: {
          weekEnding_staffName: {
            weekEnding: rec.weekDate,
            staffName: rec.staffName,
          },
        },
        update: {
          role,
          jobsCompleted: rec.values.jobsCompleted ?? null,
          revenueGenerated: rec.values.revenueGenerated ?? null,
          inspectionsCompleted: rec.values.inspectionsCompleted ?? null,
          dataSource: 'backfilled',
        },
        create: {
          weekEnding: rec.weekDate,
          staffName: rec.staffName,
          role,
          jobsCompleted: rec.values.jobsCompleted ?? null,
          revenueGenerated: rec.values.revenueGenerated ?? null,
          inspectionsCompleted: rec.values.inspectionsCompleted ?? null,
          dataSource: 'backfilled',
        },
      });

      if (existing) updated++;
      else inserted++;
    }

    return { inserted, updated, warnings };
  }

  private async upsertPhone(
    records: ParsedData['phone'],
  ): Promise<{ inserted: number; updated: number; warnings: string[] }> {
    let inserted = 0;
    let updated = 0;
    const warnings: string[] = [];

    for (const rec of records) {
      warnings.push(...rec.warnings);

      const existing = await prisma.phoneWeekly.findUnique({
        where: {
          weekEnding_staffName: {
            weekEnding: rec.weekDate,
            staffName: rec.staffName,
          },
        },
      });

      await prisma.phoneWeekly.upsert({
        where: {
          weekEnding_staffName: {
            weekEnding: rec.weekDate,
            staffName: rec.staffName,
          },
        },
        update: {
          inboundCalls: rec.values.inboundCalls ?? null,
          outboundCalls: rec.values.outboundCalls ?? null,
          missedCalls: rec.values.missedCalls ?? null,
          dataSource: 'backfilled',
        },
        create: {
          weekEnding: rec.weekDate,
          staffName: rec.staffName,
          inboundCalls: rec.values.inboundCalls ?? null,
          outboundCalls: rec.values.outboundCalls ?? null,
          missedCalls: rec.values.missedCalls ?? null,
          dataSource: 'backfilled',
        },
      });

      if (existing) updated++;
      else inserted++;
    }

    return { inserted, updated, warnings };
  }

  private async upsertMarketing(
    records: ParsedData['marketing'],
  ): Promise<{ inserted: number; updated: number; warnings: string[] }> {
    let inserted = 0;
    let updated = 0;
    const warnings: string[] = [];

    for (const rec of records) {
      warnings.push(...rec.warnings);
      const platform = rec.platform as any;

      const existing = await prisma.marketingPerformanceWeekly.findUnique({
        where: {
          weekEnding_platform: {
            weekEnding: rec.weekDate,
            platform,
          },
        },
      });

      await prisma.marketingPerformanceWeekly.upsert({
        where: {
          weekEnding_platform: {
            weekEnding: rec.weekDate,
            platform,
          },
        },
        update: {
          impressions: rec.values.impressions ?? null,
          clicks: rec.values.clicks ?? null,
          cost: rec.values.cost ?? null,
          conversions: rec.values.conversions ?? null,
          ctr: rec.values.ctr ?? null,
          cpc: rec.values.cpc ?? null,
          dataSource: 'backfilled',
        },
        create: {
          weekEnding: rec.weekDate,
          platform,
          impressions: rec.values.impressions ?? null,
          clicks: rec.values.clicks ?? null,
          cost: rec.values.cost ?? null,
          conversions: rec.values.conversions ?? null,
          ctr: rec.values.ctr ?? null,
          cpc: rec.values.cpc ?? null,
          dataSource: 'backfilled',
        },
      });

      if (existing) updated++;
      else inserted++;
    }

    return { inserted, updated, warnings };
  }
}
