import { Router } from 'express';
import { FinancialService } from '../services/FinancialService.js';
import { validateQuery, schemas } from '../middleware/validation.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

// GET /weekly?weekEnding=YYYY-MM-DD — Single week P&L summary
router.get('/weekly', validateQuery(schemas.weekEndingQuery), async (req, res, next) => {
  try {
    const { weekEnding } = (req as any).validated;
    const data = await FinancialService.getWeeklySummary(new Date(weekEnding));
    if (!data) return next(ApiError.notFound('No financial data for this week'));
    res.json(data);
  } catch (err) { next(err); }
});

// GET /weekly/range?from=YYYY-MM-DD&to=YYYY-MM-DD — Range of weeks (for charts)
router.get('/weekly/range', validateQuery(schemas.dateRangeQuery), async (req, res, next) => {
  try {
    const { from, to } = (req as any).validated;
    const data = await FinancialService.getWeeklyRange(new Date(from), new Date(to));
    res.json(data);
  } catch (err) { next(err); }
});

// GET /revenue/breakdown?weekEnding=YYYY-MM-DD — Revenue by category
router.get('/revenue/breakdown', validateQuery(schemas.weekEndingQuery), async (req, res, next) => {
  try {
    const { weekEnding } = (req as any).validated;
    const data = await FinancialService.getRevenueBreakdown(new Date(weekEnding));
    res.json(data);
  } catch (err) { next(err); }
});

// GET /cash-position?weekEnding=YYYY-MM-DD — Cash position snapshot
router.get('/cash-position', validateQuery(schemas.weekEndingQuery), async (req, res, next) => {
  try {
    const { weekEnding } = (req as any).validated;
    const data = await FinancialService.getCashPosition(new Date(weekEnding));
    if (!data) return next(ApiError.notFound('No cash position data for this week'));
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
