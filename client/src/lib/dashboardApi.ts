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

// ─── API Call ─────────────────────────────────────────────────────────────────

export async function fetchExecutiveSummary(weekEnding: string): Promise<ExecutiveSummaryData> {
  return request(`${BASE}/executive-summary?weekEnding=${weekEnding}`);
}
