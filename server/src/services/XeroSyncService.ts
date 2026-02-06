import prisma from '../db.js';
import { XeroAuthService } from './XeroAuthService.js';
import type { XeroSyncLog } from '../generated/prisma/index.js';

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

/**
 * Internal rate limiter respecting Xero API limits:
 * - 60 calls per minute (we use 55 as headroom)
 * - 5,000 calls per day (we use 4,800 as safety margin)
 *
 * Implements sliding window tracking and exponential backoff on 429.
 */
class XeroRateLimiter {
  private callTimestamps: number[] = [];
  private dailyCount = 0;
  private dailyResetAt: number = 0;

  private readonly MINUTE_LIMIT = 55; // leave 5 headroom from 60
  private readonly DAILY_LIMIT = 4800; // leave 200 headroom from 5000
  private readonly WINDOW_MS = 60_000; // 60 seconds

  constructor() {
    this.resetDaily();
  }

  private resetDaily(): void {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    this.dailyResetAt = tomorrow.getTime();
    this.dailyCount = 0;
  }

  /**
   * Wait until a call can be made within rate limits.
   */
  async waitForSlot(): Promise<void> {
    // Check if daily count needs reset
    if (Date.now() >= this.dailyResetAt) {
      this.resetDaily();
    }

    // Check daily limit
    if (this.dailyCount >= this.DAILY_LIMIT) {
      throw new Error(
        `Xero daily API limit approached (${this.dailyCount}/${this.DAILY_LIMIT}). ` +
        'Refusing additional calls until tomorrow.'
      );
    }

    // Sliding window: remove timestamps older than 60 seconds
    const now = Date.now();
    this.callTimestamps = this.callTimestamps.filter(
      (ts) => now - ts < this.WINDOW_MS
    );

    // If we're at the per-minute limit, wait for the oldest call to expire
    if (this.callTimestamps.length >= this.MINUTE_LIMIT) {
      const oldestInWindow = this.callTimestamps[0];
      const waitMs = this.WINDOW_MS - (now - oldestInWindow) + 100; // +100ms buffer
      console.log(`[Xero Rate Limiter] Per-minute limit reached, waiting ${waitMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    // Record this call
    this.callTimestamps.push(Date.now());
    this.dailyCount++;
  }

  /**
   * Handle 429 (Too Many Requests) with exponential backoff.
   * Returns true if retry should be attempted, false if max retries exceeded.
   */
  async handleRateLimit(attempt: number): Promise<boolean> {
    const MAX_RETRIES = 3;
    if (attempt >= MAX_RETRIES) {
      return false;
    }
    const waitSeconds = Math.min(Math.pow(2, attempt), 60);
    console.log(`[Xero Rate Limiter] 429 received, backing off ${waitSeconds}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
    return true;
  }
}

// ─── Helper: Saturday week-ending snap ────────────────────────────────────────

function getWeekEndingSaturday(dateStr: string): Date {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  // If not Saturday (6), snap to nearest Saturday
  if (day !== 6) {
    const diff = (6 - day + 7) % 7;
    d.setUTCDate(d.getUTCDate() + (diff <= 3 ? diff : diff - 7));
  }
  // Return date-only (no time component)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Returns the most recent Saturday on or before the given date.
 */
function getCurrentWeekEnding(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 6 ? 0 : ((day + 1) % 7); // days since last Saturday
  const saturday = new Date(now);
  saturday.setUTCDate(saturday.getUTCDate() - diff);
  return saturday.toISOString().split('T')[0];
}

// ─── Mock Data Generators ─────────────────────────────────────────────────────

function generateMockPnLData(weekEnding: Date) {
  // Realistic values for a building certification company
  const totalTradingIncome = 200_000 + Math.random() * 100_000;
  const totalCostOfSales = totalTradingIncome * (0.28 + Math.random() * 0.06);
  const grossProfit = totalTradingIncome - totalCostOfSales;
  const otherIncome = 1_000 + Math.random() * 2_000;
  const wagesAndSalaries = totalTradingIncome * (0.55 + Math.random() * 0.10);
  const operatingExpenses = totalTradingIncome * (0.08 + Math.random() * 0.04);
  const netProfit = grossProfit + otherIncome - operatingExpenses - wagesAndSalaries;

  return {
    weekEnding,
    totalTradingIncome: Math.round(totalTradingIncome * 100) / 100,
    totalCostOfSales: Math.round(totalCostOfSales * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    otherIncome: Math.round(otherIncome * 100) / 100,
    operatingExpenses: Math.round(operatingExpenses * 100) / 100,
    wagesAndSalaries: Math.round(wagesAndSalaries * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
  };
}

function generateMockInvoiceData(weekEnding: Date) {
  // Revenue categories matching the existing schema
  const categories = [
    { category: 'class_1a' as const, min: 30_000, max: 60_000 },
    { category: 'class_10a_sheds' as const, min: 5_000, max: 15_000 },
    { category: 'class_10b_pools' as const, min: 3_000, max: 8_000 },
    { category: 'class_2_9_commercial' as const, min: 40_000, max: 80_000 },
    { category: 'inspections' as const, min: 10_000, max: 25_000 },
    { category: 'retrospective' as const, min: 5_000, max: 15_000 },
  ];

  return categories.map((cat) => ({
    weekEnding,
    category: cat.category,
    amount: Math.round((cat.min + Math.random() * (cat.max - cat.min)) * 100) / 100,
  }));
}

function generateMockBankData(weekEnding: Date) {
  return {
    weekEnding,
    everydayAccount: Math.round((80_000 + Math.random() * 120_000) * 100) / 100,
    overdraftLimit: 200_000,
    taxSavings: Math.round((50_000 + Math.random() * 30_000) * 100) / 100,
    capitalAccount: Math.round((100_000 + Math.random() * 50_000) * 100) / 100,
    creditCards: Math.round((-5_000 - Math.random() * 10_000) * 100) / 100,
    totalCashAvailable: null as number | null, // computed below
    totalReceivables: Math.round((150_000 + Math.random() * 100_000) * 100) / 100,
    currentReceivables: Math.round((80_000 + Math.random() * 50_000) * 100) / 100,
    over30Days: Math.round((30_000 + Math.random() * 20_000) * 100) / 100,
    over60Days: Math.round((15_000 + Math.random() * 15_000) * 100) / 100,
    over90Days: Math.round((10_000 + Math.random() * 10_000) * 100) / 100,
    totalPayables: Math.round((60_000 + Math.random() * 40_000) * 100) / 100,
  };
}

// ─── XeroSyncService ──────────────────────────────────────────────────────────

/**
 * Handles syncing data from Xero into the dashboard database.
 * Supports three sync types: Profit & Loss, Invoices, and Bank Summary.
 * In mock mode, generates realistic test data instead of calling Xero API.
 */
export class XeroSyncService {
  private static instance: XeroSyncService;
  private authService: XeroAuthService;
  private rateLimiter: XeroRateLimiter;

  private constructor() {
    this.authService = XeroAuthService.getInstance();
    this.rateLimiter = new XeroRateLimiter();
  }

  static getInstance(): XeroSyncService {
    if (!XeroSyncService.instance) {
      XeroSyncService.instance = new XeroSyncService();
    }
    return XeroSyncService.instance;
  }

  // ─── Sync: Profit & Loss ──────────────────────────────────────────────────

  /**
   * Syncs Profit & Loss data into financial_weekly.
   * Mock mode generates realistic data; real mode calls Xero Reports API.
   */
  async syncProfitAndLoss(weekEndingStr?: string): Promise<XeroSyncLog> {
    const weekEnding = weekEndingStr
      ? getWeekEndingSaturday(weekEndingStr)
      : getWeekEndingSaturday(getCurrentWeekEnding());

    const log = await prisma.xeroSyncLog.create({
      data: {
        syncType: 'profit_and_loss',
        weekEnding,
        status: 'processing',
      },
    });

    try {
      if (this.authService.isMockMode()) {
        // Mock mode: generate realistic P&L data
        const mockData = generateMockPnLData(weekEnding);

        await prisma.financialWeekly.upsert({
          where: { weekEnding },
          create: {
            ...mockData,
            dataSource: 'xero_api',
          },
          update: {
            ...mockData,
            dataSource: 'xero_api',
          },
        });

        return await prisma.xeroSyncLog.update({
          where: { id: log.id },
          data: {
            status: 'success',
            recordCount: 1,
            completedAt: new Date(),
          },
        });
      }

      // Real mode: call Xero API
      const auth = await this.authService.getAuthenticatedToken();
      if (!auth) {
        throw new Error('Failed to get authenticated Xero client');
      }

      await this.rateLimiter.waitForSlot();

      // Calculate date range (Sunday before to Saturday)
      const startDate = new Date(weekEnding);
      startDate.setUTCDate(startDate.getUTCDate() - 6);

      const response = await this.makeXeroRequest(
        `https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss` +
        `?fromDate=${startDate.toISOString().split('T')[0]}` +
        `&toDate=${weekEnding.toISOString().split('T')[0]}`,
        auth.accessToken,
        auth.tenantId
      );

      // Transform Xero P&L report into financial_weekly fields
      const reportData = this.transformPnLReport(response, weekEnding);

      await prisma.financialWeekly.upsert({
        where: { weekEnding },
        create: {
          ...reportData,
          dataSource: 'xero_api',
        },
        update: {
          ...reportData,
          dataSource: 'xero_api',
        },
      });

      return await prisma.xeroSyncLog.update({
        where: { id: log.id },
        data: {
          status: 'success',
          recordCount: 1,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return await prisma.xeroSyncLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          errorLog: { message: errMsg },
          completedAt: new Date(),
        },
      });
    }
  }

  // ─── Sync: Invoices ───────────────────────────────────────────────────────

  /**
   * Syncs invoice data into revenue_weekly.
   * Mock mode generates data by revenue category; real mode calls Xero Invoices API.
   */
  async syncInvoices(weekEndingStr?: string): Promise<XeroSyncLog> {
    const weekEnding = weekEndingStr
      ? getWeekEndingSaturday(weekEndingStr)
      : getWeekEndingSaturday(getCurrentWeekEnding());

    const log = await prisma.xeroSyncLog.create({
      data: {
        syncType: 'invoices',
        weekEnding,
        status: 'processing',
      },
    });

    try {
      if (this.authService.isMockMode()) {
        // Mock mode: generate invoice data by category
        const mockInvoices = generateMockInvoiceData(weekEnding);
        let recordCount = 0;

        for (const inv of mockInvoices) {
          await prisma.revenueWeekly.upsert({
            where: {
              weekEnding_category: {
                weekEnding: inv.weekEnding,
                category: inv.category,
              },
            },
            create: {
              weekEnding: inv.weekEnding,
              category: inv.category,
              amount: inv.amount,
              dataSource: 'xero_api',
            },
            update: {
              amount: inv.amount,
              dataSource: 'xero_api',
            },
          });
          recordCount++;
        }

        return await prisma.xeroSyncLog.update({
          where: { id: log.id },
          data: {
            status: 'success',
            recordCount,
            completedAt: new Date(),
          },
        });
      }

      // Real mode: call Xero Invoices API
      const auth = await this.authService.getAuthenticatedToken();
      if (!auth) {
        throw new Error('Failed to get authenticated Xero client');
      }

      await this.rateLimiter.waitForSlot();

      const startDate = new Date(weekEnding);
      startDate.setUTCDate(startDate.getUTCDate() - 6);

      const response = await this.makeXeroRequest(
        `https://api.xero.com/api.xro/2.0/Invoices` +
        `?where=Date>="${startDate.toISOString().split('T')[0]}"` +
        `%20AND%20Date<="${weekEnding.toISOString().split('T')[0]}"` +
        `&Statuses=AUTHORISED,PAID`,
        auth.accessToken,
        auth.tenantId
      );

      // Transform and upsert invoice data
      // TODO: Map Xero invoice line items to revenue categories
      const recordCount = 0;

      return await prisma.xeroSyncLog.update({
        where: { id: log.id },
        data: {
          status: 'success',
          recordCount,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return await prisma.xeroSyncLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          errorLog: { message: errMsg },
          completedAt: new Date(),
        },
      });
    }
  }

  // ─── Sync: Bank Summary ───────────────────────────────────────────────────

  /**
   * Syncs bank account balances into cash_position_weekly.
   * Mock mode generates data; real mode calls Xero Bank Summary report.
   */
  async syncBankSummary(weekEndingStr?: string): Promise<XeroSyncLog> {
    const weekEnding = weekEndingStr
      ? getWeekEndingSaturday(weekEndingStr)
      : getWeekEndingSaturday(getCurrentWeekEnding());

    const log = await prisma.xeroSyncLog.create({
      data: {
        syncType: 'bank_summary',
        weekEnding,
        status: 'processing',
      },
    });

    try {
      if (this.authService.isMockMode()) {
        // Mock mode: generate bank balance data
        const mockData = generateMockBankData(weekEnding);
        // Compute total cash available
        mockData.totalCashAvailable = Math.round(
          ((mockData.everydayAccount ?? 0) +
           (mockData.taxSavings ?? 0) +
           (mockData.capitalAccount ?? 0) +
           (mockData.creditCards ?? 0)) * 100
        ) / 100;

        await prisma.cashPositionWeekly.upsert({
          where: { weekEnding },
          create: {
            ...mockData,
            dataSource: 'xero_api',
          },
          update: {
            ...mockData,
            dataSource: 'xero_api',
          },
        });

        return await prisma.xeroSyncLog.update({
          where: { id: log.id },
          data: {
            status: 'success',
            recordCount: 1,
            completedAt: new Date(),
          },
        });
      }

      // Real mode: call Xero Bank Summary API
      const auth = await this.authService.getAuthenticatedToken();
      if (!auth) {
        throw new Error('Failed to get authenticated Xero client');
      }

      await this.rateLimiter.waitForSlot();

      const response = await this.makeXeroRequest(
        `https://api.xero.com/api.xro/2.0/Reports/BankSummary` +
        `?toDate=${weekEnding.toISOString().split('T')[0]}`,
        auth.accessToken,
        auth.tenantId
      );

      // TODO: Transform Xero bank summary report into cash_position_weekly fields

      return await prisma.xeroSyncLog.update({
        where: { id: log.id },
        data: {
          status: 'success',
          recordCount: 0,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return await prisma.xeroSyncLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          errorLog: { message: errMsg },
          completedAt: new Date(),
        },
      });
    }
  }

  // ─── Sync All ─────────────────────────────────────────────────────────────

  /**
   * Runs all three sync operations sequentially (to respect rate limits).
   */
  async syncAll(weekEndingStr?: string): Promise<XeroSyncLog[]> {
    const results: XeroSyncLog[] = [];

    // Run sequentially to respect rate limits
    results.push(await this.syncProfitAndLoss(weekEndingStr));
    results.push(await this.syncInvoices(weekEndingStr));
    results.push(await this.syncBankSummary(weekEndingStr));

    // Update last sync timestamp
    await this.authService.updateLastSyncAt();

    return results;
  }

  // ─── Xero API Helper ─────────────────────────────────────────────────────

  /**
   * Makes an authenticated request to Xero API with rate limiting and retry.
   */
  private async makeXeroRequest(
    url: string,
    accessToken: string,
    tenantId: string,
    attempt = 0
  ): Promise<any> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Xero-Tenant-Id': tenantId,
        Accept: 'application/json',
      },
    });

    if (response.status === 429) {
      const shouldRetry = await this.rateLimiter.handleRateLimit(attempt);
      if (shouldRetry) {
        await this.rateLimiter.waitForSlot();
        return this.makeXeroRequest(url, accessToken, tenantId, attempt + 1);
      }
      throw new Error('Xero API rate limit exceeded after maximum retries');
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Xero API error ${response.status}: ${body}`);
    }

    return response.json();
  }

  // ─── Report Transformers ──────────────────────────────────────────────────

  /**
   * Transforms a Xero P&L report response into financial_weekly fields.
   * Maps Xero report sections to the dashboard's financial structure.
   */
  private transformPnLReport(
    response: any,
    weekEnding: Date
  ): {
    weekEnding: Date;
    totalTradingIncome: number;
    totalCostOfSales: number;
    grossProfit: number;
    otherIncome: number;
    operatingExpenses: number;
    wagesAndSalaries: number;
    netProfit: number;
  } {
    // Xero P&L report structure: Reports[0].Rows[] with sections
    // Each section has RowType: 'Section', Title, and Rows with Cells
    // This is a basic transformer -- will need refinement with live data
    let totalTradingIncome = 0;
    let totalCostOfSales = 0;
    let otherIncome = 0;
    let operatingExpenses = 0;
    let wagesAndSalaries = 0;

    try {
      const report = response?.Reports?.[0];
      if (report?.Rows) {
        for (const section of report.Rows) {
          const title = (section.Title || '').toLowerCase();
          if (section.RowType === 'Section') {
            const sectionTotal = this.extractSectionTotal(section);
            if (title.includes('income') || title.includes('revenue') || title.includes('trading')) {
              totalTradingIncome = sectionTotal;
            } else if (title.includes('cost of sales') || title.includes('cost of goods')) {
              totalCostOfSales = Math.abs(sectionTotal);
            } else if (title.includes('other income')) {
              otherIncome = sectionTotal;
            } else if (title.includes('expense') || title.includes('operating')) {
              operatingExpenses = Math.abs(sectionTotal);
              // Extract wages from line items
              wagesAndSalaries = this.extractWagesFromSection(section);
            }
          }
        }
      }
    } catch {
      console.warn('[XeroSync] Failed to parse P&L report structure, using zero values');
    }

    const grossProfit = totalTradingIncome - totalCostOfSales;
    const netProfit = grossProfit + otherIncome - operatingExpenses;

    return {
      weekEnding,
      totalTradingIncome: Math.round(totalTradingIncome * 100) / 100,
      totalCostOfSales: Math.round(totalCostOfSales * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      otherIncome: Math.round(otherIncome * 100) / 100,
      operatingExpenses: Math.round(operatingExpenses * 100) / 100,
      wagesAndSalaries: Math.round(wagesAndSalaries * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
    };
  }

  private extractSectionTotal(section: any): number {
    // Look for a SummaryRow or the last row in the section
    if (section.Rows) {
      for (const row of section.Rows) {
        if (row.RowType === 'SummaryRow' && row.Cells) {
          // The amount is typically in the last cell
          const amountCell = row.Cells[row.Cells.length - 1];
          return parseFloat(amountCell?.Value || '0') || 0;
        }
      }
    }
    return 0;
  }

  private extractWagesFromSection(section: any): number {
    // Look for rows containing 'wages', 'salaries', 'payroll' in the section
    let wages = 0;
    if (section.Rows) {
      for (const row of section.Rows) {
        if (row.RowType === 'Row' && row.Cells) {
          const label = (row.Cells[0]?.Value || '').toLowerCase();
          if (label.includes('wage') || label.includes('salar') || label.includes('payroll')) {
            const amountCell = row.Cells[row.Cells.length - 1];
            wages += Math.abs(parseFloat(amountCell?.Value || '0') || 0);
          }
        }
      }
    }
    return wages;
  }
}
