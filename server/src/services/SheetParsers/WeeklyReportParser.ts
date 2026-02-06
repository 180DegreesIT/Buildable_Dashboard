/**
 * WeeklyReportParser — Parser for Sheet 1 "Weekly Report" (transposed layout).
 *
 * Extracts data for 6 database tables from one sheet:
 * - financial_weekly (rows 4-10)
 * - projects_weekly (rows 18-31, 3 project types)
 * - sales_weekly (rows 35-50, 3 sales types)
 * - leads_weekly (rows 55-66, 6 lead sources)
 * - google_reviews_weekly (row 70)
 * - team_performance_weekly (rows 73-98, 9 regions)
 */
import type { Workbook } from 'exceljs';
import {
  parseTransposedSheet,
  extractCell,
  extractNumericValue,
  cellRef,
  type ParsedWeek,
} from '../ExcelParserService.js';
import { WeekService } from '../WeekService.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeeklyReportResult {
  financial: ParsedWeek[];
  projects: Array<{
    weekDate: Date;
    projectType: string;
    values: Record<string, number | null>;
    warnings: string[];
  }>;
  sales: Array<{
    weekDate: Date;
    salesType: string;
    values: Record<string, number | null>;
    warnings: string[];
  }>;
  leads: Array<{
    weekDate: Date;
    source: string;
    values: Record<string, number | null>;
    warnings: string[];
  }>;
  googleReviews: ParsedWeek[];
  teamPerformance: Array<{
    weekDate: Date;
    region: string;
    values: Record<string, number | null>;
    warnings: string[];
  }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHEET_NAME = 'Weekly Report';
const DATE_ROW = 3;
const START_COL = 3; // Column C (skip label col A/B and total col B)
const LABEL_COL = 1;

// ─── Parser ───────────────────────────────────────────────────────────────────

export class WeeklyReportParser {
  parse(workbook: Workbook): WeeklyReportResult {
    const ws = workbook.getWorksheet(SHEET_NAME);
    if (!ws) {
      return {
        financial: [],
        projects: [],
        sales: [],
        leads: [],
        googleReviews: [],
        teamPerformance: [],
      };
    }

    // Parse financial data using the generic transposed parser
    const financial = parseTransposedSheet(ws, {
      dateRow: DATE_ROW,
      startCol: START_COL,
      labelCol: LABEL_COL,
      rowMappings: [
        { row: 4, dbField: 'totalTradingIncome', type: 'currency' },
        { row: 5, dbField: 'totalCostOfSales', type: 'currency' },
        { row: 6, dbField: 'grossProfit', type: 'currency' },
        { row: 7, dbField: 'otherIncome', type: 'currency' },
        { row: 8, dbField: 'operatingExpenses', type: 'currency' },
        { row: 9, dbField: 'wagesAndSalaries', type: 'currency' },
        { row: 10, dbField: 'netProfit', type: 'currency' },
      ],
    });

    // Parse projects, sales, leads, reviews, teams using column iteration
    const projects = this.parseProjects(ws);
    const sales = this.parseSales(ws);
    const leads = this.parseLeads(ws);
    const googleReviews = this.parseGoogleReviews(ws);
    const teamPerformance = this.parseTeamPerformance(ws);

    return { financial, projects, sales, leads, googleReviews, teamPerformance };
  }

  private parseProjects(ws: any) {
    const result: WeeklyReportResult['projects'] = [];

    const projectTypes = [
      {
        type: 'residential',
        mappings: [
          { row: 18, dbField: 'hyperfloCount', type: 'integer' as const },
          { row: 19, dbField: 'xeroInvoicedAmount', type: 'currency' as const },
          { row: 21, dbField: 'newBusinessPercentage', type: 'percentage' as const },
        ],
      },
      {
        type: 'commercial',
        mappings: [
          { row: 26, dbField: 'hyperfloCount', type: 'integer' as const },
          { row: 27, dbField: 'xeroInvoicedAmount', type: 'currency' as const },
        ],
      },
      {
        type: 'retrospective',
        mappings: [
          { row: 30, dbField: 'hyperfloCount', type: 'integer' as const },
          { row: 31, dbField: 'xeroInvoicedAmount', type: 'currency' as const },
        ],
      },
    ];

    for (const pt of projectTypes) {
      const weeks = parseTransposedSheet(ws, {
        dateRow: DATE_ROW,
        startCol: START_COL,
        labelCol: LABEL_COL,
        rowMappings: pt.mappings,
      });

      for (const week of weeks) {
        result.push({
          weekDate: week.weekDate,
          projectType: pt.type,
          values: week.values,
          warnings: week.warnings,
        });
      }
    }

    return result;
  }

  private parseSales(ws: any) {
    const result: WeeklyReportResult['sales'] = [];

    const salesTypes = [
      {
        type: 'residential',
        mappings: [
          { row: 35, dbField: 'quotesIssuedCount', type: 'integer' as const },
          { row: 36, dbField: 'quotesIssuedValue', type: 'currency' as const },
          { row: 37, dbField: 'quotesWonCount', type: 'integer' as const },
          { row: 38, dbField: 'quotesWonValue', type: 'currency' as const },
        ],
      },
      {
        type: 'commercial',
        mappings: [
          { row: 41, dbField: 'quotesIssuedCount', type: 'integer' as const },
          { row: 42, dbField: 'quotesIssuedValue', type: 'currency' as const },
          { row: 43, dbField: 'quotesWonCount', type: 'integer' as const },
          { row: 44, dbField: 'quotesWonValue', type: 'currency' as const },
        ],
      },
      {
        type: 'retrospective',
        mappings: [
          { row: 47, dbField: 'quotesIssuedCount', type: 'integer' as const },
          { row: 48, dbField: 'quotesIssuedValue', type: 'currency' as const },
          { row: 49, dbField: 'quotesWonCount', type: 'integer' as const },
          { row: 50, dbField: 'quotesWonValue', type: 'currency' as const },
        ],
      },
    ];

    for (const st of salesTypes) {
      const weeks = parseTransposedSheet(ws, {
        dateRow: DATE_ROW,
        startCol: START_COL,
        labelCol: LABEL_COL,
        rowMappings: st.mappings,
      });

      for (const week of weeks) {
        result.push({
          weekDate: week.weekDate,
          salesType: st.type,
          values: week.values,
          warnings: week.warnings,
        });
      }
    }

    return result;
  }

  private parseLeads(ws: any) {
    const result: WeeklyReportResult['leads'] = [];

    const leadSources = [
      { source: 'google', countRow: 55, costRow: 56 },
      { source: 'seo', countRow: 57, costRow: 58 },
      { source: 'meta', countRow: 59, costRow: 60 },
      { source: 'bing', countRow: 61, costRow: 62 },
      { source: 'tiktok', countRow: 63, costRow: 64 },
      { source: 'other', countRow: 65, costRow: 66 },
    ];

    // Iterate week columns once for all lead sources
    const dateRowObj = ws.getRow(DATE_ROW);
    for (let c = START_COL; c <= ws.columnCount; c++) {
      const dateVal = dateRowObj.getCell(c).value;
      const dateExtraction = extractCell(dateVal, `${SHEET_NAME}!${cellRef(DATE_ROW, c)}`);
      if (!(dateExtraction.value instanceof Date)) continue;

      const weekDate = WeekService.toSaturday(dateExtraction.value);

      for (const ls of leadSources) {
        const warnings: string[] = [];

        const countRef = `${SHEET_NAME}!${cellRef(ls.countRow, c)}`;
        const costRef = `${SHEET_NAME}!${cellRef(ls.costRow, c)}`;

        const countExt = extractNumericValue(ws.getRow(ls.countRow).getCell(c).value, countRef);
        const costExt = extractNumericValue(ws.getRow(ls.costRow).getCell(c).value, costRef);

        if (countExt.warning) warnings.push(countExt.warning);
        if (costExt.warning) warnings.push(costExt.warning);

        const leadCount = countExt.value;
        const costPerLead = costExt.value;

        // Skip if both are null
        if (leadCount === null && costPerLead === null) continue;

        // Calculate totalCost = leadCount * costPerLead
        let totalCost: number | null = null;
        if (leadCount !== null && costPerLead !== null) {
          totalCost = leadCount * costPerLead;
        }

        result.push({
          weekDate,
          source: ls.source,
          values: { leadCount, costPerLead, totalCost },
          warnings,
        });
      }
    }

    return result;
  }

  private parseGoogleReviews(ws: any) {
    return parseTransposedSheet(ws, {
      dateRow: DATE_ROW,
      startCol: START_COL,
      labelCol: LABEL_COL,
      rowMappings: [
        { row: 70, dbField: 'reviewCount', type: 'integer' },
      ],
    });
  }

  private parseTeamPerformance(ws: any) {
    const result: WeeklyReportResult['teamPerformance'] = [];

    const regions = [
      { region: 'cairns', targetRow: 73, actualRow: 74 },
      { region: 'mackay', targetRow: 76, actualRow: 77 },
      { region: 'nq_commercial', targetRow: 79, actualRow: 80 },
      { region: 'seq_residential', targetRow: 82, actualRow: 83 },
      { region: 'seq_commercial', targetRow: 85, actualRow: 86 },
      { region: 'town_planning', targetRow: 88, actualRow: 89 },
      { region: 'townsville', targetRow: 91, actualRow: 92 },
      { region: 'wide_bay', targetRow: 94, actualRow: 95 },
      { region: 'all_in_access', targetRow: 97, actualRow: 98 },
    ];

    for (const reg of regions) {
      // Only parse actualInvoiced (targets are managed in the Target table)
      const weeks = parseTransposedSheet(ws, {
        dateRow: DATE_ROW,
        startCol: START_COL,
        labelCol: LABEL_COL,
        rowMappings: [
          { row: reg.actualRow, dbField: 'actualInvoiced', type: 'currency' },
        ],
      });

      for (const week of weeks) {
        result.push({
          weekDate: week.weekDate,
          region: reg.region,
          values: week.values,
          warnings: week.warnings,
        });
      }
    }

    return result;
  }
}
