import prisma from '../db.js';
import { Decimal } from '../generated/prisma/runtime/library.js';

export class FinancialService {
  /**
   * Returns the financial summary for a single week with computed metrics.
   */
  static async getWeeklySummary(weekEnding: Date) {
    const data = await prisma.financialWeekly.findUnique({
      where: { weekEnding },
    });
    if (!data) return null;

    return {
      ...data,
      ...this.computeDerivedMetrics(data),
    };
  }

  /**
   * Returns financial data for a range of weeks with computed metrics.
   */
  static async getWeeklyRange(from: Date, to: Date) {
    const rows = await prisma.financialWeekly.findMany({
      where: {
        weekEnding: { gte: from, lte: to },
      },
      orderBy: { weekEnding: 'asc' },
    });

    return rows.map((row) => ({
      ...row,
      ...this.computeDerivedMetrics(row),
    }));
  }

  /**
   * Returns revenue breakdown by category for a given week.
   */
  static async getRevenueBreakdown(weekEnding: Date) {
    return prisma.revenueWeekly.findMany({
      where: { weekEnding },
      orderBy: { category: 'asc' },
    });
  }

  /**
   * Returns cash position for a given week.
   */
  static async getCashPosition(weekEnding: Date) {
    return prisma.cashPositionWeekly.findUnique({
      where: { weekEnding },
    });
  }

  /**
   * Computes derived financial metrics from raw data.
   */
  static computeDerivedMetrics(data: {
    totalTradingIncome: Decimal;
    totalCostOfSales: Decimal;
    grossProfit: Decimal;
    netProfit: Decimal;
    wagesAndSalaries: Decimal;
  }) {
    const income = Number(data.totalTradingIncome);
    const netProfit = Number(data.netProfit);
    const wages = Number(data.wagesAndSalaries);
    const grossProfit = Number(data.grossProfit);

    return {
      // Gross profit margin: (gross_profit / total_trading_income) * 100
      grossProfitMargin: income > 0 ? Number(((grossProfit / income) * 100).toFixed(2)) : 0,
      // Profit percentage: (net_profit / total_trading_income) * 100
      profitPercentage: income > 0 ? Number(((netProfit / income) * 100).toFixed(2)) : 0,
      // Revenue to staff ratio: (wages_and_salaries / total_trading_income) * 100
      // Lower is better. 55-65% is healthy benchmark.
      revenueToStaffRatio: income > 0 ? Number(((wages / income) * 100).toFixed(2)) : 0,
    };
  }
}
