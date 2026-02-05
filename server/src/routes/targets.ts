import { Router } from 'express';
import { z } from 'zod';
import { TargetService } from '../services/TargetService.js';
import { validateQuery, validateBody, schemas } from '../middleware/validation.js';
import { ApiError } from '../middleware/errorHandler.js';
import type { TargetType, Region } from '../generated/prisma/index.js';

const router = Router();

// GET /current?weekEnding=YYYY-MM-DD — Active targets for a given week
router.get('/current', validateQuery(schemas.weekEndingQuery), async (req, res, next) => {
  try {
    const { weekEnding } = (req as any).validated;
    const targets = await TargetService.getAllTargetsForWeek(new Date(weekEnding));
    res.json(targets);
  } catch (err) { next(err); }
});

// POST / — Create new target (with effective_from date)
const createTargetSchema = z.object({
  targetType: z.enum(['net_profit', 'residential_revenue', 'commercial_revenue', 'retrospective_revenue', 'team_revenue', 'breakeven']),
  entity: z.enum(['cairns', 'mackay', 'nq_commercial', 'seq_residential', 'seq_commercial', 'town_planning', 'townsville', 'wide_bay', 'all_in_access']).nullish(),
  amount: z.number().positive(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  setBy: z.string().optional(),
  notes: z.string().optional(),
});

router.post('/', validateBody(createTargetSchema), async (req, res, next) => {
  try {
    const data = (req as any).validated;
    const target = await TargetService.createTarget({
      ...data,
      effectiveFrom: new Date(data.effectiveFrom),
    });
    res.status(201).json(target);
  } catch (err) { next(err); }
});

// PUT /:id — Update target (supersedes old, creates history)
const updateTargetSchema = z.object({
  amount: z.number().positive(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  setBy: z.string().optional(),
  notes: z.string().optional(),
});

router.put('/:id', validateBody(updateTargetSchema), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(ApiError.badRequest('Invalid target ID'));

    const data = (req as any).validated;
    const target = await TargetService.updateTarget(id, {
      ...data,
      effectiveFrom: new Date(data.effectiveFrom),
    });
    if (!target) return next(ApiError.notFound('Target not found'));
    res.json(target);
  } catch (err) { next(err); }
});

// GET /history?targetType=X&entity=Y — Full change history
const historySchema = z.object({
  targetType: z.enum(['net_profit', 'residential_revenue', 'commercial_revenue', 'retrospective_revenue', 'team_revenue', 'breakeven']),
  entity: z.enum(['cairns', 'mackay', 'nq_commercial', 'seq_residential', 'seq_commercial', 'town_planning', 'townsville', 'wide_bay', 'all_in_access']).optional(),
});

router.get('/history', validateQuery(historySchema), async (req, res, next) => {
  try {
    const { targetType, entity } = (req as any).validated;
    const history = await TargetService.getHistory(
      targetType as TargetType,
      entity as Region | undefined,
    );
    res.json(history);
  } catch (err) { next(err); }
});

export default router;
