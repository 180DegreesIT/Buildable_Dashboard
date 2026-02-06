/**
 * Validation API routes -- Exposes the ValidationService for data verification.
 *
 * GET /run       -- Execute full validation suite, return structured results
 * GET /reference -- Return raw reference-values.json for debugging
 *
 * Dev tool, not user-facing in production. No permission middleware applied.
 */
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { ValidationService } from '../services/ValidationService.js';

const router = Router();

/**
 * GET /run
 * Execute the full validation suite: compare reference values against live API.
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

export default router;
