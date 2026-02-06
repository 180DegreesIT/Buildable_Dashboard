/**
 * MarketingParser — Parser for Sheets 9 "Marketing Weekly APP" + 10 "Marketing Weekly BA".
 *
 * Both sheets are transposed. Parse both and combine metrics per platform per week
 * (sum APP + BA values). Maps platform rows to MarketingPlatform enum.
 *
 * Fields per platform: impressions, clicks, cost, conversions.
 * Calculated: CTR = clicks / impressions, CPC = cost / clicks.
 */
import type { Workbook, Worksheet } from 'exceljs';
import { extractCell, extractNumericValue, cellRef } from '../ExcelParserService.js';
import { WeekService } from '../WeekService.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketingRecord {
  weekDate: Date;
  platform: string;
  values: {
    impressions: number | null;
    clicks: number | null;
    cost: number | null;
    conversions: number | null;
    ctr: number | null;
    cpc: number | null;
  };
  warnings: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHEET_NAMES = ['Marketing Weekly APP', 'Marketing Weekly BA'];
const DATE_ROW = 3;
const START_COL = 3;
const LABEL_COL = 1;

// ─── Parser ───────────────────────────────────────────────────────────────────

export class MarketingParser {
  parse(workbook: Workbook): MarketingRecord[] {
    // Parse both sheets and combine
    const allRecords = new Map<string, MarketingRecord>(); // key: weekDate_platform

    for (const sheetName of SHEET_NAMES) {
      const ws = workbook.getWorksheet(sheetName);
      if (!ws) continue;

      const platformGroups = this.identifyPlatformGroups(ws);
      const sheetRecords = this.parseSheet(ws, sheetName, platformGroups);

      // Merge into allRecords
      for (const record of sheetRecords) {
        const key = `${record.weekDate.toISOString()}_${record.platform}`;
        const existing = allRecords.get(key);

        if (existing) {
          // Combine: sum numeric values
          existing.values.impressions = this.sumNullable(existing.values.impressions, record.values.impressions);
          existing.values.clicks = this.sumNullable(existing.values.clicks, record.values.clicks);
          existing.values.cost = this.sumNullable(existing.values.cost, record.values.cost);
          existing.values.conversions = this.sumNullable(existing.values.conversions, record.values.conversions);
          existing.warnings.push(...record.warnings);
        } else {
          allRecords.set(key, { ...record });
        }
      }
    }

    // Calculate CTR and CPC for combined records
    const results: MarketingRecord[] = [];
    for (const record of allRecords.values()) {
      const { impressions, clicks, cost } = record.values;

      // CTR = clicks / impressions
      record.values.ctr =
        clicks !== null && impressions !== null && impressions > 0
          ? clicks / impressions
          : null;

      // CPC = cost / clicks
      record.values.cpc =
        cost !== null && clicks !== null && clicks > 0
          ? cost / clicks
          : null;

      results.push(record);
    }

    return results;
  }

  private parseSheet(
    ws: Worksheet,
    sheetName: string,
    platformGroups: Array<{
      platform: string;
      impressionsRow: number;
      clicksRow: number;
      costRow: number;
      conversionsRow: number;
    }>,
  ): MarketingRecord[] {
    const results: MarketingRecord[] = [];
    const dateRowObj = ws.getRow(DATE_ROW);

    for (let c = START_COL; c <= ws.columnCount; c++) {
      const dateExtraction = extractCell(
        dateRowObj.getCell(c).value,
        `${sheetName}!${cellRef(DATE_ROW, c)}`,
      );
      if (!(dateExtraction.value instanceof Date)) continue;

      const weekDate = WeekService.toSaturday(dateExtraction.value);

      for (const group of platformGroups) {
        const warnings: string[] = [];

        const impRef = `${sheetName}!${cellRef(group.impressionsRow, c)}`;
        const clkRef = `${sheetName}!${cellRef(group.clicksRow, c)}`;
        const costRef = `${sheetName}!${cellRef(group.costRow, c)}`;
        const convRef = `${sheetName}!${cellRef(group.conversionsRow, c)}`;

        const impExt = extractNumericValue(ws.getRow(group.impressionsRow).getCell(c).value, impRef);
        const clkExt = extractNumericValue(ws.getRow(group.clicksRow).getCell(c).value, clkRef);
        const costExt = extractNumericValue(ws.getRow(group.costRow).getCell(c).value, costRef);
        const convExt = extractNumericValue(ws.getRow(group.conversionsRow).getCell(c).value, convRef);

        if (impExt.warning) warnings.push(impExt.warning);
        if (clkExt.warning) warnings.push(clkExt.warning);
        if (costExt.warning) warnings.push(costExt.warning);
        if (convExt.warning) warnings.push(convExt.warning);

        // Skip if all values are null
        if (
          impExt.value === null &&
          clkExt.value === null &&
          costExt.value === null &&
          convExt.value === null
        ) {
          continue;
        }

        results.push({
          weekDate,
          platform: group.platform,
          values: {
            impressions: impExt.value !== null ? Math.round(impExt.value) : null,
            clicks: clkExt.value !== null ? Math.round(clkExt.value) : null,
            cost: costExt.value,
            conversions: convExt.value !== null ? Math.round(convExt.value) : null,
            ctr: null, // Calculated after combining
            cpc: null, // Calculated after combining
          },
          warnings,
        });
      }
    }

    return results;
  }

  /**
   * Scan rows to identify platform groups by looking for platform header labels.
   * Each platform typically has rows for: impressions, clicks, cost, conversions.
   */
  private identifyPlatformGroups(
    ws: Worksheet,
  ): Array<{
    platform: string;
    impressionsRow: number;
    clicksRow: number;
    costRow: number;
    conversionsRow: number;
  }> {
    const groups: Array<{
      platform: string;
      impressionsRow: number;
      clicksRow: number;
      costRow: number;
      conversionsRow: number;
    }> = [];

    // Known platform name patterns mapped to enum values
    const platformMap: Record<string, string> = {
      google: 'google_ads',
      'google ads': 'google_ads',
      meta: 'meta_ads',
      facebook: 'meta_ads',
      'meta/facebook': 'meta_ads',
      bing: 'bing_ads',
      'bing ads': 'bing_ads',
      tiktok: 'tiktok_ads',
      seo: 'seo',
    };

    // Scan for platform section headers
    for (let r = 4; r <= ws.rowCount - 3; r++) {
      const labelExt = extractCell(
        ws.getRow(r).getCell(LABEL_COL).value,
        `${ws.name}!${cellRef(r, LABEL_COL)}`,
      );
      const label = typeof labelExt.value === 'string' ? labelExt.value.trim() : '';
      if (!label) continue;

      const labelLower = label.toLowerCase();

      // Check if this label matches a known platform
      let platform: string | undefined;
      for (const [pattern, enumVal] of Object.entries(platformMap)) {
        if (labelLower.includes(pattern)) {
          platform = enumVal;
          break;
        }
      }

      if (!platform) continue;

      // Check if the next rows look like metrics (impressions, clicks, cost, conversions)
      // The platform header row is the first metric row (impressions)
      const nextLabels: string[] = [];
      for (let offset = 0; offset <= 3; offset++) {
        const nextExt = extractCell(
          ws.getRow(r + offset).getCell(LABEL_COL).value,
          `${ws.name}!${cellRef(r + offset, LABEL_COL)}`,
        );
        nextLabels.push(typeof nextExt.value === 'string' ? nextExt.value.trim().toLowerCase() : '');
      }

      // Try to match the 4-row pattern: impressions, clicks, cost/spend, conversions/leads
      let impressionsRow = -1;
      let clicksRow = -1;
      let costRow = -1;
      let conversionsRow = -1;

      for (let offset = 0; offset <= 3; offset++) {
        const lbl = nextLabels[offset];
        if (lbl.includes('impression')) impressionsRow = r + offset;
        else if (lbl.includes('click')) clicksRow = r + offset;
        else if (lbl.includes('cost') || lbl.includes('spend')) costRow = r + offset;
        else if (lbl.includes('conversion') || lbl.includes('lead') || lbl.includes('enquir')) conversionsRow = r + offset;
      }

      // If we found at least impressions or clicks, add the group
      // Use r+offset as fallback for missing rows
      if (impressionsRow >= 0 || clicksRow >= 0) {
        groups.push({
          platform,
          impressionsRow: impressionsRow >= 0 ? impressionsRow : r,
          clicksRow: clicksRow >= 0 ? clicksRow : r + 1,
          costRow: costRow >= 0 ? costRow : r + 2,
          conversionsRow: conversionsRow >= 0 ? conversionsRow : r + 3,
        });
        r += 3; // Skip past this platform's metric rows
      }
    }

    // Deduplicate: if the same platform appears twice (from scanning), keep the first
    const seen = new Set<string>();
    return groups.filter((g) => {
      if (seen.has(g.platform)) return false;
      seen.add(g.platform);
      return true;
    });
  }

  private sumNullable(a: number | null, b: number | null): number | null {
    if (a === null && b === null) return null;
    return (a ?? 0) + (b ?? 0);
  }
}
