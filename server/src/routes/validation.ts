/**
 * Validation API routes -- Exposes the ValidationService for data verification.
 *
 * GET /run        -- Execute data validation suite, return structured results
 * GET /reference  -- Return raw reference-values.json for debugging
 * GET /benchmark  -- Run Puppeteer performance benchmark on all dashboard pages
 * GET /full       -- Run ALL validation tests (data + CSV + targets + performance)
 *
 * Dev tool, not user-facing in production. No permission middleware applied.
 */
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { ValidationService } from '../services/ValidationService.js';
import { PerformanceBenchmark } from '../services/PerformanceBenchmark.js';

const router = Router();

// ---- ANSI Colours for Terminal Output ----------------------------------------

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

/**
 * GET /run
 * Execute the data validation suite: compare reference values against live API.
 * Returns JSON result and prints colour-coded summary to server console.
 */
router.get('/run', async (_req, res, next) => {
  try {
    console.log('\n[Validation] Starting validation run...');
    const result = await ValidationService.runValidation();

    // Print results to server console (terminal visibility)
    ValidationService.printResults(result);

    res.json(result);
  } catch (err: any) {
    console.error('[Validation] Error:', err.message);
    next(err);
  }
});

/**
 * GET /reference
 * Return the raw reference-values.json file for debugging.
 * Returns 404 if the file hasn't been generated yet.
 */
router.get('/reference', (_req, res) => {
  const refPath = path.resolve(__dirname, '..', 'data', 'reference-values.json');

  if (!fs.existsSync(refPath)) {
    res.status(404).json({
      error: 'Reference values not found',
      message: 'Run the extraction script first: npx tsx server/src/scripts/extract-reference.ts [path-to-workbook]',
    });
    return;
  }

  try {
    const raw = fs.readFileSync(refPath, 'utf-8');
    const data = JSON.parse(raw);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({
      error: 'Failed to read reference values',
      message: err.message,
    });
  }
});

/**
 * GET /benchmark
 * Run Puppeteer performance benchmark on all 4 dashboard pages.
 * Returns BenchmarkResult with per-page load times and pass/fail.
 */
router.get('/benchmark', async (_req, res, next) => {
  try {
    console.log('\n[Validation] Starting performance benchmark...');
    const result = await PerformanceBenchmark.runBenchmark();
    PerformanceBenchmark.printResults(result);
    res.json(result);
  } catch (err: any) {
    console.error('[Validation] Benchmark error:', err.message);
    next(err);
  }
});

/**
 * GET /full
 * Run ALL validation tests sequentially: data, CSV round-trip, target workflow, performance.
 * Returns a combined FullValidationResult. Total runtime may be 15-30 seconds.
 */
router.get('/full', async (_req, res, next) => {
  try {
    console.log(`\n${BOLD}=== VALIDATION SUITE ===${RESET}`);

    // [1/4] Data validation
    console.log(`${CYAN}[1/4]${RESET} Data validation...`);
    const dataValidation = await ValidationService.runValidation();
    const dataLabel = `${dataValidation.passed}/${dataValidation.totalChecks} passed`;
    const dataColour = dataValidation.failed === 0 ? GREEN : RED;
    console.log(`  ${dataColour}${dataLabel}${RESET}`);

    // [2/4] CSV round-trip
    console.log(`${CYAN}[2/4]${RESET} CSV round-trip...`);
    const csvRoundTrip = await ValidationService.runCsvRoundTrip();
    const csvLabel = csvRoundTrip.allPassed ? 'PASSED' : 'FAILED';
    const csvColour = csvRoundTrip.allPassed ? GREEN : RED;
    console.log(`  ${csvColour}${csvLabel}${RESET}`);

    // [3/4] Target workflow
    console.log(`${CYAN}[3/4]${RESET} Target workflow...`);
    const targetWorkflow = await ValidationService.runTargetWorkflowTest();
    const tgtPassed = targetWorkflow.steps.filter((s) => s.passed).length;
    const tgtTotal = targetWorkflow.steps.length;
    const tgtLabel = targetWorkflow.allPassed
      ? `PASSED (${tgtPassed}/${tgtTotal} steps)`
      : `FAILED (${tgtPassed}/${tgtTotal} steps)`;
    const tgtColour = targetWorkflow.allPassed ? GREEN : RED;
    console.log(`  ${tgtColour}${tgtLabel}${RESET}`);

    // [4/4] Performance benchmark
    console.log(`${CYAN}[4/4]${RESET} Performance benchmark...`);
    const performance = await PerformanceBenchmark.runBenchmark();
    for (const page of performance.pages) {
      const pageColour = page.passed ? GREEN : RED;
      const pageLabel = page.passed ? 'PASS' : 'FAIL';
      console.log(`  ${page.page}: ${page.loadTimeMs}ms ${pageColour}[${pageLabel}]${RESET}`);
    }

    // Overall summary
    const perfPassed = performance.pages.filter((p) => p.passed).length;
    const perfTotal = performance.pages.length;
    const overallPassed =
      dataValidation.failed === 0 &&
      csvRoundTrip.allPassed &&
      targetWorkflow.allPassed &&
      performance.allPassed;

    const summary = `Data: ${dataValidation.passed}/${dataValidation.totalChecks}, CSV: ${csvLabel}, Targets: ${tgtLabel}, Perf: ${perfPassed}/${perfTotal}`;

    const overallColour = overallPassed ? GREEN : RED;
    const overallLabel = overallPassed ? 'PASSED' : 'FAILED';
    console.log(`\n${overallColour}${BOLD}OVERALL: ${overallLabel} (${summary})${RESET}\n`);

    res.json({
      dataValidation,
      csvRoundTrip,
      targetWorkflow,
      performance,
      overallPassed,
      summary,
    });
  } catch (err: any) {
    console.error('[Validation] Full suite error:', err.message);
    next(err);
  }
});

export default router;
