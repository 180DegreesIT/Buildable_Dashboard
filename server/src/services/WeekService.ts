import prisma from '../db.js';

const SATURDAY = 6; // JavaScript Date.getDay(): 0=Sun, 6=Sat

export class WeekService {
  /**
   * Returns the nearest Saturday to the given date.
   * If the date is already a Saturday, returns it unchanged.
   */
  static toSaturday(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    if (day === SATURDAY) return d;

    // Calculate days until next Saturday and days since last Saturday
    const daysUntilSat = (SATURDAY - day + 7) % 7;
    const daysSinceSat = (day - SATURDAY + 7) % 7;

    if (daysSinceSat <= 3) {
      // Snap back to previous Saturday
      d.setUTCDate(d.getUTCDate() - daysSinceSat);
    } else {
      // Snap forward to next Saturday
      d.setUTCDate(d.getUTCDate() + daysUntilSat);
    }
    return d;
  }

  /**
   * Validates that a date string resolves to a Saturday.
   * Returns { valid, date, corrected } where corrected is true if auto-snapped.
   */
  static validateWeekEnding(dateStr: string): { valid: boolean; date: Date | null; corrected: boolean; error?: string } {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
      return { valid: false, date: null, corrected: false, error: 'Invalid date format' };
    }

    if (parsed.getUTCDay() === SATURDAY) {
      return { valid: true, date: parsed, corrected: false };
    }

    const daysSinceSat = (parsed.getUTCDay() - SATURDAY + 7) % 7;
    const daysUntilSat = (SATURDAY - parsed.getUTCDay() + 7) % 7;
    const minDistance = Math.min(daysSinceSat, daysUntilSat);

    if (minDistance <= 3) {
      return { valid: true, date: this.toSaturday(parsed), corrected: true };
    }

    return { valid: false, date: null, corrected: false, error: 'Date is not a Saturday and is too far from the nearest Saturday to auto-correct' };
  }

  /**
   * Returns the most recent Saturday (current week ending).
   */
  static getCurrentWeekEnding(): Date {
    return this.toSaturday(new Date());
  }

  /**
   * Returns a list of Saturdays between from and to (inclusive).
   */
  static getWeekRange(from: Date, to: Date): Date[] {
    const weeks: Date[] = [];
    const start = this.toSaturday(from);
    const end = this.toSaturday(to);

    const current = new Date(start);
    while (current <= end) {
      weeks.push(new Date(current));
      current.setUTCDate(current.getUTCDate() + 7);
    }
    return weeks;
  }

  /**
   * Returns weeks that have data in the financial_weekly table within the given range.
   */
  static async getAvailableWeeks(from?: Date, to?: Date): Promise<Date[]> {
    const where: any = {};
    if (from || to) {
      where.weekEnding = {};
      if (from) where.weekEnding.gte = from;
      if (to) where.weekEnding.lte = to;
    }

    const rows = await prisma.financialWeekly.findMany({
      where,
      select: { weekEnding: true },
      orderBy: { weekEnding: 'desc' },
    });

    return rows.map((r) => r.weekEnding);
  }

  /**
   * Returns the most recent Saturday that has data in the database.
   */
  static async getMostRecentWeekWithData(): Promise<Date | null> {
    const row = await prisma.financialWeekly.findFirst({
      orderBy: { weekEnding: 'desc' },
      select: { weekEnding: true },
    });
    return row?.weekEnding ?? null;
  }
}
