import type { InferredType } from './CsvParserService.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FieldDefinition {
  dbField: string;
  label: string;
  type: InferredType;
  required: boolean;
}

export interface DataTypeDefinition {
  id: string;
  name: string;
  description: string;
  category: 'Financial' | 'Projects' | 'Sales' | 'Marketing' | 'Operations';
  targetTable: string;
  /** Fixed field values applied to every row (e.g., projectType: 'residential') */
  fixedFields: Record<string, string>;
  /** Fields that can be mapped from CSV columns */
  fields: FieldDefinition[];
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const DATA_TYPES: DataTypeDefinition[] = [
  // ── Financial ───────────────────────────────────────────────────────────────
  {
    id: 'financial_pl',
    name: 'Financial - P&L',
    description: 'Weekly profit & loss summary from Xero: income, costs, expenses, wages, and net profit.',
    category: 'Financial',
    targetTable: 'financial_weekly',
    fixedFields: {},
    fields: [
      { dbField: 'weekEnding', label: 'Week Ending', type: 'date', required: true },
      { dbField: 'totalTradingIncome', label: 'Total Trading Income', type: 'currency', required: true },
      { dbField: 'totalCostOfSales', label: 'Total Cost of Sales', type: 'currency', required: true },
      { dbField: 'grossProfit', label: 'Gross Profit', type: 'currency', required: true },
      { dbField: 'otherIncome', label: 'Other Income', type: 'currency', required: true },
      { dbField: 'operatingExpenses', label: 'Operating Expenses', type: 'currency', required: true },
      { dbField: 'wagesAndSalaries', label: 'Wages & Salaries', type: 'currency', required: true },
      { dbField: 'netProfit', label: 'Net Profit', type: 'currency', required: true },
    ],
  },

  {
    id: 'revenue_breakdown',
    name: 'Revenue Breakdown',
    description: 'Weekly revenue by category (Class 1A, Commercial, Inspections, etc.).',
    category: 'Financial',
    targetTable: 'revenue_weekly',
    fixedFields: {},
    fields: [
      { dbField: 'weekEnding', label: 'Week Ending', type: 'date', required: true },
      { dbField: 'category', label: 'Revenue Category', type: 'text', required: true },
      { dbField: 'amount', label: 'Amount', type: 'currency', required: true },
    ],
  },

  {
    id: 'cash_position',
    name: 'Cash Position',
    description: 'Weekly bank balances, receivables, and payables snapshot.',
    category: 'Financial',
    targetTable: 'cash_position_weekly',
    fixedFields: {},
    fields: [
      { dbField: 'weekEnding', label: 'Week Ending', type: 'date', required: true },
      { dbField: 'everydayAccount', label: 'Everyday Account', type: 'currency', required: false },
      { dbField: 'overdraftLimit', label: 'Overdraft Limit', type: 'currency', required: false },
      { dbField: 'taxSavings', label: 'Tax Savings', type: 'currency', required: false },
      { dbField: 'capitalAccount', label: 'Capital Account', type: 'currency', required: false },
      { dbField: 'creditCards', label: 'Credit Cards', type: 'currency', required: false },
      { dbField: 'totalCashAvailable', label: 'Total Cash Available', type: 'currency', required: false },
      { dbField: 'totalReceivables', label: 'Total Receivables', type: 'currency', required: false },
      { dbField: 'currentReceivables', label: 'Current Receivables', type: 'currency', required: false },
      { dbField: 'over30Days', label: 'Over 30 Days', type: 'currency', required: false },
      { dbField: 'over60Days', label: 'Over 60 Days', type: 'currency', required: false },
      { dbField: 'over90Days', label: 'Over 90 Days', type: 'currency', required: false },
      { dbField: 'totalPayables', label: 'Total Payables', type: 'currency', required: false },
    ],
  },

  // ── Projects ────────────────────────────────────────────────────────────────
  {
    id: 'projects_residential',
    name: 'Projects - Residential',
    description: 'Weekly residential project counts and invoiced amounts from Hyperflo/Xero.',
    category: 'Projects',
    targetTable: 'projects_weekly',
    fixedFields: { projectType: 'residential' },
    fields: [
      { dbField: 'weekEnding', label: 'Week Ending', type: 'date', required: true },
      { dbField: 'hyperfloCount', label: 'Hyperflo Count', type: 'integer', required: true },
      { dbField: 'xeroInvoicedAmount', label: 'Xero Invoiced Amount', type: 'currency', required: true },
      { dbField: 'newBusinessPercentage', label: 'New Business %', type: 'percentage', required: false },
    ],
  },
  {
    id: 'projects_commercial',
    name: 'Projects - Commercial',
    description: 'Weekly commercial project counts and invoiced amounts from Hyperflo/Xero.',
    category: 'Projects',
    targetTable: 'projects_weekly',
    fixedFields: { projectType: 'commercial' },
    fields: [
      { dbField: 'weekEnding', label: 'Week Ending', type: 'date', required: true },
      { dbField: 'hyperfloCount', label: 'Hyperflo Count', type: 'integer', required: true },
      { dbField: 'xeroInvoicedAmount', label: 'Xero Invoiced Amount', type: 'currency', required: true },
      { dbField: 'newBusinessPercentage', label: 'New Business %', type: 'percentage', required: false },
    ],
  },
  {
    id: 'projects_retrospective',
    name: 'Projects - Retrospective',
    description: 'Weekly retrospective project counts and invoiced amounts from Hyperflo/Xero.',
    category: 'Projects',
    targetTable: 'projects_weekly',
    fixedFields: { projectType: 'retrospective' },
    fields: [
      { dbField: 'weekEnding', label: 'Week Ending', type: 'date', required: true },
      { dbField: 'hyperfloCount', label: 'Hyperflo Count', type: 'integer', required: true },
      { dbField: 'xeroInvoicedAmount', label: 'Xero Invoiced Amount', type: 'currency', required: true },
      { dbField: 'newBusinessPercentage', label: 'New Business %', type: 'percentage', required: false },
    ],
  },

  // ── Sales ───────────────────────────────────────────────────────────────────
  {
    id: 'sales_residential',
    name: 'Sales - Residential',
    description: 'Weekly residential quotes issued and won (counts and values).',
    category: 'Sales',
    targetTable: 'sales_weekly',
    fixedFields: { salesType: 'residential' },
    fields: [
      { dbField: 'weekEnding', label: 'Week Ending', type: 'date', required: true },
      { dbField: 'quotesIssuedCount', label: 'Quotes Issued (Count)', type: 'integer', required: true },
      { dbField: 'quotesIssuedValue', label: 'Quotes Issued (Value)', type: 'currency', required: true },
      { dbField: 'quotesWonCount', label: 'Quotes Won (Count)', type: 'integer', required: true },
      { dbField: 'quotesWonValue', label: 'Quotes Won (Value)', type: 'currency', required: true },
    ],
  },
  {
    id: 'sales_commercial',
    name: 'Sales - Commercial',
    description: 'Weekly commercial quotes issued and won (counts and values).',
    category: 'Sales',
    targetTable: 'sales_weekly',
    fixedFields: { salesType: 'commercial' },
    fields: [
      { dbField: 'weekEnding', label: 'Week Ending', type: 'date', required: true },
      { dbField: 'quotesIssuedCount', label: 'Quotes Issued (Count)', type: 'integer', required: true },
      { dbField: 'quotesIssuedValue', label: 'Quotes Issued (Value)', type: 'currency', required: true },
      { dbField: 'quotesWonCount', label: 'Quotes Won (Count)', type: 'integer', required: true },
      { dbField: 'quotesWonValue', label: 'Quotes Won (Value)', type: 'currency', required: true },
    ],
  },
  {
    id: 'sales_retrospective',
    name: 'Sales - Retrospective',
    description: 'Weekly retrospective quotes issued and won (counts and values).',
    category: 'Sales',
    targetTable: 'sales_weekly',
    fixedFields: { salesType: 'retrospective' },
    fields: [
      { dbField: 'weekEnding', label: 'Week Ending', type: 'date', required: true },
      { dbField: 'quotesIssuedCount', label: 'Quotes Issued (Count)', type: 'integer', required: true },
      { dbField: 'quotesIssuedValue', label: 'Quotes Issued (Value)', type: 'currency', required: true },
      { dbField: 'quotesWonCount', label: 'Quotes Won (Count)', type: 'integer', required: true },
      { dbField: 'quotesWonValue', label: 'Quotes Won (Value)', type: 'currency', required: true },
    ],
  },
  {
    id: 'sales_regional',
    name: 'Sales - Regional',
    description: 'Weekly sales breakdown by region and type.',
    category: 'Sales',
    targetTable: 'sales_regional_weekly',
    fixedFields: {},
    fields: [
      { dbField: 'weekEnding', label: 'Week Ending', type: 'date', required: true },
      { dbField: 'region', label: 'Region', type: 'text', required: true },
      { dbField: 'salesType', label: 'Sales Type', type: 'text', required: true },
      { dbField: 'quotesIssuedCount', label: 'Quotes Issued (Count)', type: 'integer', required: true },
      { dbField: 'quotesIssuedValue', label: 'Quotes Issued (Value)', type: 'currency', required: true },
      { dbField: 'quotesWonCount', label: 'Quotes Won (Count)', type: 'integer', required: true },
      { dbField: 'quotesWonValue', label: 'Quotes Won (Value)', type: 'currency', required: true },
    ],
  },

  // ── Marketing ───────────────────────────────────────────────────────────────
  {
    id: 'team_performance',
    name: 'Team Performance',
    description: 'Weekly actual invoiced amounts by region/team.',
    category: 'Sales',
    targetTable: 'team_performance_weekly',
    fixedFields: {},
    fields: [
      { dbField: 'weekEnding', label: 'Week Ending', type: 'date', required: true },
      { dbField: 'region', label: 'Region / Team', type: 'text', required: true },
      { dbField: 'actualInvoiced', label: 'Actual Invoiced', type: 'currency', required: true },
    ],
  },
  {
    id: 'lead_sources',
    name: 'Lead Sources',
    description: 'Weekly lead counts and costs by source (Google, SEO, Meta, etc.).',
    category: 'Marketing',
    targetTable: 'leads_weekly',
    fixedFields: {},
    fields: [
      { dbField: 'weekEnding', label: 'Week Ending', type: 'date', required: true },
      { dbField: 'source', label: 'Lead Source', type: 'text', required: true },
      { dbField: 'leadCount', label: 'Lead Count', type: 'decimal', required: true },
      { dbField: 'costPerLead', label: 'Cost per Lead', type: 'currency', required: false },
      { dbField: 'totalCost', label: 'Total Cost', type: 'currency', required: false },
    ],
  },
  {
    id: 'marketing_platform',
    name: 'Marketing Platform Performance',
    description: 'Weekly ad platform metrics: impressions, clicks, cost, conversions.',
    category: 'Marketing',
    targetTable: 'marketing_performance_weekly',
    fixedFields: {},
    fields: [
      { dbField: 'weekEnding', label: 'Week Ending', type: 'date', required: true },
      { dbField: 'platform', label: 'Platform', type: 'text', required: true },
      { dbField: 'impressions', label: 'Impressions', type: 'integer', required: false },
      { dbField: 'clicks', label: 'Clicks', type: 'integer', required: false },
      { dbField: 'cost', label: 'Ad Spend', type: 'currency', required: false },
      { dbField: 'conversions', label: 'Conversions', type: 'integer', required: false },
      { dbField: 'ctr', label: 'CTR', type: 'percentage', required: false },
      { dbField: 'cpc', label: 'CPC', type: 'currency', required: false },
    ],
  },

  // ── Operations ──────────────────────────────────────────────────────────────
  {
    id: 'website_analytics',
    name: 'Website Analytics',
    description: 'Weekly website traffic: sessions, users, page views, bounce rate.',
    category: 'Operations',
    targetTable: 'website_analytics_weekly',
    fixedFields: {},
    fields: [
      { dbField: 'weekEnding', label: 'Week Ending', type: 'date', required: true },
      { dbField: 'sessions', label: 'Sessions', type: 'integer', required: false },
      { dbField: 'users', label: 'Users', type: 'integer', required: false },
      { dbField: 'pageViews', label: 'Page Views', type: 'integer', required: false },
      { dbField: 'bounceRate', label: 'Bounce Rate', type: 'percentage', required: false },
      { dbField: 'avgSessionDuration', label: 'Avg Session Duration (s)', type: 'decimal', required: false },
      { dbField: 'newUsers', label: 'New Users', type: 'integer', required: false },
    ],
  },
  {
    id: 'staff_productivity',
    name: 'Staff Productivity',
    description: 'Weekly staff output: jobs completed, revenue generated, inspections.',
    category: 'Operations',
    targetTable: 'staff_productivity_weekly',
    fixedFields: {},
    fields: [
      { dbField: 'weekEnding', label: 'Week Ending', type: 'date', required: true },
      { dbField: 'staffName', label: 'Staff Name', type: 'text', required: true },
      { dbField: 'role', label: 'Role', type: 'text', required: true },
      { dbField: 'region', label: 'Region', type: 'text', required: false },
      { dbField: 'jobsCompleted', label: 'Jobs Completed', type: 'integer', required: false },
      { dbField: 'revenueGenerated', label: 'Revenue Generated', type: 'currency', required: false },
      { dbField: 'inspectionsCompleted', label: 'Inspections Completed', type: 'integer', required: false },
    ],
  },
  {
    id: 'phone_metrics',
    name: 'Phone Metrics',
    description: 'Weekly phone call statistics by staff member.',
    category: 'Operations',
    targetTable: 'phone_weekly',
    fixedFields: {},
    fields: [
      { dbField: 'weekEnding', label: 'Week Ending', type: 'date', required: true },
      { dbField: 'staffName', label: 'Staff Name', type: 'text', required: true },
      { dbField: 'inboundCalls', label: 'Inbound Calls', type: 'integer', required: false },
      { dbField: 'outboundCalls', label: 'Outbound Calls', type: 'integer', required: false },
      { dbField: 'missedCalls', label: 'Missed Calls', type: 'integer', required: false },
      { dbField: 'avgCallDuration', label: 'Avg Call Duration (s)', type: 'decimal', required: false },
    ],
  },
  {
    id: 'google_reviews',
    name: 'Google Reviews',
    description: 'Weekly Google review counts and average ratings.',
    category: 'Operations',
    targetTable: 'google_reviews_weekly',
    fixedFields: {},
    fields: [
      { dbField: 'weekEnding', label: 'Week Ending', type: 'date', required: true },
      { dbField: 'reviewCount', label: 'Review Count', type: 'integer', required: true },
      { dbField: 'averageRating', label: 'Average Rating', type: 'decimal', required: false },
      { dbField: 'cumulativeCount', label: 'Cumulative Count', type: 'integer', required: false },
      { dbField: 'cumulativeAverageRating', label: 'Cumulative Average Rating', type: 'decimal', required: false },
    ],
  },
];

// ─── Lookup maps ──────────────────────────────────────────────────────────────

const byId = new Map<string, DataTypeDefinition>();
const byTable = new Map<string, DataTypeDefinition[]>();

for (const dt of DATA_TYPES) {
  byId.set(dt.id, dt);
  const list = byTable.get(dt.targetTable) ?? [];
  list.push(dt);
  byTable.set(dt.targetTable, list);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const DataTypeRegistry = {
  /** Get all registered data types. */
  getAll(): DataTypeDefinition[] {
    return DATA_TYPES;
  },

  /** Get all data types grouped by category. */
  getGrouped(): Record<string, DataTypeDefinition[]> {
    const grouped: Record<string, DataTypeDefinition[]> = {};
    for (const dt of DATA_TYPES) {
      (grouped[dt.category] ??= []).push(dt);
    }
    return grouped;
  },

  /** Lookup a data type by its ID. */
  getById(id: string): DataTypeDefinition | undefined {
    return byId.get(id);
  },

  /** Lookup data types by target table. */
  getByTable(table: string): DataTypeDefinition[] {
    return byTable.get(table) ?? [];
  },

  /** Get the required field names for a data type. */
  getRequiredFields(id: string): string[] {
    const dt = byId.get(id);
    if (!dt) return [];
    return dt.fields.filter((f) => f.required).map((f) => f.dbField);
  },

  /** Get all field dbField names for a data type (for mapping targets). */
  getMappableFields(id: string): FieldDefinition[] {
    const dt = byId.get(id);
    if (!dt) return [];
    return dt.fields;
  },

  /**
   * Build FieldMapping[] from a csvHeader→dbField mapping and data type definition.
   * This bridges saved mappings to the validateRows() function in CsvParserService.
   */
  buildFieldMappings(
    dataTypeId: string,
    headerToDbField: Record<string, string>,
  ): import('./CsvParserService.js').FieldMapping[] {
    const dt = byId.get(dataTypeId);
    if (!dt) return [];

    const fieldMap = new Map(dt.fields.map((f) => [f.dbField, f]));
    const mappings: import('./CsvParserService.js').FieldMapping[] = [];

    for (const [csvHeader, dbField] of Object.entries(headerToDbField)) {
      const field = fieldMap.get(dbField);
      if (!field) continue; // Ignore unmapped/unknown fields

      mappings.push({
        csvHeader,
        dbField: field.dbField,
        expectedType: field.type,
        required: field.required,
      });
    }

    return mappings;
  },

  /**
   * Score how well a set of CSV headers matches a saved mapping.
   * Returns a number between 0 and 1 (percentage of saved mapping headers found in CSV).
   */
  scoreMappingMatch(
    savedMappingHeaders: string[],
    csvHeaders: string[],
  ): number {
    if (savedMappingHeaders.length === 0) return 0;

    const csvSet = new Set(csvHeaders.map((h) => h.trim().toLowerCase()));
    let matched = 0;

    for (const header of savedMappingHeaders) {
      if (csvSet.has(header.trim().toLowerCase())) {
        matched++;
      }
    }

    return matched / savedMappingHeaders.length;
  },
};
