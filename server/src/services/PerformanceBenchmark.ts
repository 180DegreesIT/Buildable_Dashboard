/**
 * PerformanceBenchmark -- Measures warm page load times using Puppeteer.
 *
 * Navigates to each dashboard print route twice (warm load methodology):
 * first load warms caches, second load is measured.
 * Waits for data-print-ready="true" signal from PrintLayout component.
 *
 * Reports pass/fail against the 2-second target per page.
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// ---- Types ------------------------------------------------------------------

export interface PageBenchmark {
  page: string;
  url: string;
  loadTimeMs: number;
  passed: boolean;   // loadTimeMs < 2000
  target: number;    // 2000
}

export interface BenchmarkResult {
  runAt: string;
  allPassed: boolean;
  pages: PageBenchmark[];
}

// ---- ANSI Colours -----------------------------------------------------------

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

// ---- Configuration ----------------------------------------------------------

const LOAD_TARGET_MS = 2000;
const SELECTOR_TIMEOUT = 15_000;

interface PageConfig {
  name: string;
  slug: string;
}

const PAGES: PageConfig[] = [
  { name: 'Executive Summary', slug: 'executive-summary' },
  { name: 'Financial Deep Dive', slug: 'financial' },
  { name: 'Regional Performance', slug: 'regional' },
  { name: 'Target Management', slug: 'targets' },
];

// ---- Reference Week Resolution ----------------------------------------------

function getCheckpointWeek(): string {
  try {
    const refPath = path.resolve(__dirname, '..', 'data', 'reference-values.json');
    if (fs.existsSync(refPath)) {
      const raw = fs.readFileSync(refPath, 'utf-8');
      const data = JSON.parse(raw);
      if (data.checkpointWeeks && data.checkpointWeeks.length > 0) {
        return data.checkpointWeeks[data.checkpointWeeks.length - 1].weekEnding;
      }
    }
  } catch {
    // Fall through to default
  }
  return '2025-01-25';
}

// ---- Benchmark Runner -------------------------------------------------------

export class PerformanceBenchmark {
  /**
   * Run performance benchmark against all dashboard pages.
   * Uses print routes as proxy (same data-fetching and rendering pipeline).
   */
  static async runBenchmark(): Promise<BenchmarkResult> {
    const clientPort = process.env.CLIENT_PORT || '4200';
    const weekEnding = getCheckpointWeek();
    const results: PageBenchmark[] = [];

    const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

    try {
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });

      for (const pageConfig of PAGES) {
        const url = `http://localhost:${clientPort}/#/print/${pageConfig.slug}?week=${weekEnding}`;
        let loadTimeMs = 0;
        let passed = false;

        try {
          // Warm load: navigate first time to warm caches
          await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });
          await page.waitForSelector('[data-print-ready="true"]', { timeout: SELECTOR_TIMEOUT });

          // Measured load: navigate again and measure
          const startTime = Date.now();
          await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });
          await page.waitForSelector('[data-print-ready="true"]', { timeout: SELECTOR_TIMEOUT });
          loadTimeMs = Date.now() - startTime;
          passed = loadTimeMs < LOAD_TARGET_MS;
        } catch (err: any) {
          // If page fails to load, record a failure with max time
          loadTimeMs = SELECTOR_TIMEOUT;
          passed = false;
          console.error(`  ${RED}[ERROR]${RESET} ${pageConfig.name}: ${err.message}`);
        }

        const result: PageBenchmark = {
          page: pageConfig.name,
          url,
          loadTimeMs,
          passed,
          target: LOAD_TARGET_MS,
        };
        results.push(result);

        // Console output for this page
        const statusLabel = passed ? `${GREEN}[PASS]${RESET}` : `${RED}[FAIL]${RESET}`;
        console.log(`  ${pageConfig.name}: ${loadTimeMs}ms ${statusLabel}`);
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    const allPassed = results.every((r) => r.passed);

    return {
      runAt: new Date().toISOString(),
      allPassed,
      pages: results,
    };
  }

  /**
   * Print benchmark results to console with colour-coded output.
   */
  static printResults(result: BenchmarkResult): void {
    console.log(`\n${BOLD}  Performance Benchmark${RESET}`);
    console.log(`  Run at: ${result.runAt}`);
    console.log(`  Target: ${LOAD_TARGET_MS}ms per page (warm load)`);
    console.log(`  Method: Print routes used as proxy (same API + render pipeline)\n`);

    for (const page of result.pages) {
      const statusColour = page.passed ? GREEN : RED;
      const statusLabel = page.passed ? 'PASS' : 'FAIL';
      const barLength = Math.min(Math.round(page.loadTimeMs / 50), 40);
      const bar = '\u2588'.repeat(barLength);
      console.log(
        `  ${statusColour}[${statusLabel}]${RESET} ${page.page}: ${page.loadTimeMs}ms ${statusColour}${bar}${RESET}`
      );
    }

    const passedCount = result.pages.filter((p) => p.passed).length;
    const totalCount = result.pages.length;
    const overallColour = result.allPassed ? GREEN : RED;
    console.log(
      `\n  ${overallColour}${BOLD}${passedCount}/${totalCount} pages under ${LOAD_TARGET_MS}ms${RESET}\n`
    );
  }
}
