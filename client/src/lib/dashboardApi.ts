const BASE = '/api/v1/dashboard';

async function request<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KPINetProfit {
  actual: number | null;
  budget: number | null;
  variance: number | null;
  variancePct: number | null;
}

export interface KPIRevenueInvoiced {
  actual: number;
}

export interface KPIRevenuePL {
  actual: number | null;
  varianceToInvoiced: number | null;
}

export interface KPISimple {
  actual: number | null;
}

export interface KPILeads {
  actual: number;
  avgCostPerLead: number;
}

export interface ProjectSummaryRow {
  type: string;
  hyperfloCount: number;
  xeroInvoiced: number;
  target: number;
  percentageToTarget: number;
  newBusinessPercentage: number | null;
}

export interface SalesSummaryRow {
  type: string;
  issuedCount: number;
  issuedValue: number;
  wonCount: number;
  wonValue: number;
  winRate: number;
}

export interface LeadBreakdownRow {
  source: string;
  leadCount: number;
  costPerLead: number | null;
  totalCost: number | null;
}

export interface GoogleReviewsSummary {
  reviewCount: number;
  averageRating: number | null;
  cumulativeCount: number | null;
  cumulativeAverageRating: number | null;
}

export interface TeamPerformanceRow {
  region: string;
  label: string;
  actual: number;
  target: number;
  percentageToTarget: number;
  variance: number;
}

export interface NetProfitTrendPoint {
  weekEnding: string;
  netProfit: number;
  totalTradingIncome: number;
  budget: number | null;
}

export interface RevenueByCategoryPoint {
  weekEnding: string;
  residential: number;
  commercial: number;
  retrospective: number;
}

export interface ExecutiveSummaryData {
  weekEnding: string;
  hasData: boolean;
  kpis: {
    netProfit: KPINetProfit;
    revenueInvoiced: KPIRevenueInvoiced;
    revenuePL: KPIRevenuePL;
    grossProfitMargin: KPISimple;
    revenueToStaffRatio: KPISimple;
    totalLeads: KPILeads;
    totalCashAvailable: KPISimple;
  };
  projectSummary: ProjectSummaryRow[];
  salesSummary: SalesSummaryRow[];
  leadBreakdown: LeadBreakdownRow[];
  reviews: GoogleReviewsSummary | null;
  teamPerformance: TeamPerformanceRow[];
  trends: {
    netProfit: NetProfitTrendPoint[];
    revenueByCategory: RevenueByCategoryPoint[];
  };
}

// ─── Financial Deep Dive Types ────────────────────────────────────────────────

export interface PLWeekly {
  totalTradingIncome: number;
  totalCostOfSales: number;
  grossProfit: number;
  otherIncome: number;
  operatingExpenses: number;
  wagesAndSalaries: number;
  netProfit: number;
  budget: number | null;
  profitPercentage: number;
  revenueToStaffRatio: number;
  grossProfitMargin: number;
}

export interface PLMonthly extends PLWeekly {
  month: string;
  weekCount: number;
}

export interface RevenueCategoryRow {
  category: string;
  label: string;
  amount: number;
  isPassThrough: boolean;
}

export interface RevenueBreakdownData {
  categories: RevenueCategoryRow[];
  grossTotal: number;
  passThroughTotal: number;
  netTotal: number;
  passThroughCategories: string[];
}

export interface RevenueComparison {
  invoiced: number;
  pl: number | null;
  variance: number | null;
}

export interface CostAnalysisPoint {
  weekEnding: string;
  revenueToStaffRatio: number;
  wagesAndSalaries: number;
  totalTradingIncome: number;
}

export interface CashPositionData {
  everydayAccount: number;
  overdraftLimit: number;
  taxSavings: number;
  capitalAccount: number;
  creditCards: number;
  totalCashAvailable: number;
}

export interface AgedReceivablesData {
  totalReceivables: number;
  current: number;
  over30Days: number;
  over60Days: number;
  over90Days: number;
  totalPayables: number;
}

export interface LiabilityRow {
  id: number;
  description: string;
  amount: number;
  dueDate: string;
  type: string;
}

export interface FinancialDeepDiveData {
  weekEnding: string;
  hasData: boolean;
  plWeekly: PLWeekly | null;
  plMonthly: PLMonthly[];
  revenueBreakdown: RevenueBreakdownData;
  revenueComparison: RevenueComparison;
  costAnalysisTrend: CostAnalysisPoint[];
  revenueTrend: Record<string, any>[];
  cashPosition: CashPositionData | null;
  agedReceivables: AgedReceivablesData | null;
  upcomingLiabilities: LiabilityRow[];
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export async function fetchExecutiveSummary(weekEnding: string): Promise<ExecutiveSummaryData> {
  return request(`${BASE}/executive-summary?weekEnding=${weekEnding}`);
}

export async function fetchFinancialDeepDive(weekEnding: string): Promise<FinancialDeepDiveData> {
  return request(`${BASE}/financial-deep-dive?weekEnding=${weekEnding}`);
}
