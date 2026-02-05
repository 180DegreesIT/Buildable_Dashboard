import { Router } from 'express';
import { z } from 'zod';
import prisma from '../db.js';
import { TargetService } from '../services/TargetService.js';
import { validateQuery, schemas } from '../middleware/validation.js';
import type { Region } from '../generated/prisma/index.js';

const router = Router();

// GET /performance?weekEnding=YYYY-MM-DD — All 9 teams vs targets
router.get('/performance', validateQuery(schemas.weekEndingQuery), async (req, res, next) => {
  try {
    const { weekEnding } = (req as any).validated;
    const weekDate = new Date(weekEnding);

    const actuals = await prisma.teamPerformanceWeekly.findMany({
      where: { weekEnding: weekDate },
      orderBy: { region: 'asc' },
    });

    // Resolve targets for each team
    const results = await Promise.all(
      actuals.map(async (actual) => {
        const target = await TargetService.getTargetForWeek('team_revenue', weekDate, actual.region);
        const targetAmount = target ? Number(target.amount) : 0;
        const actualAmount = Number(actual.actualInvoiced);
        const percentageToTarget = targetAmount > 0 ? Number(((actualAmount / targetAmount) * 100).toFixed(2)) : 0;

        return {
          ...actual,
          targetAmount,
          percentageToTarget,
          variance: Number((actualAmount - targetAmount).toFixed(2)),
        };
      })
    );

    res.json(results);
  } catch (err) { next(err); }
});

// GET /performance/:team?from=YYYY-MM-DD&to=YYYY-MM-DD — Single team trend
const teamTrendSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.get('/performance/:team', validateQuery(teamTrendSchema), async (req, res, next) => {
  try {
    const { from, to } = (req as any).validated;
    const region = req.params.team as Region;

    const data = await prisma.teamPerformanceWeekly.findMany({
      where: {
        region,
        weekEnding: { gte: new Date(from), lte: new Date(to) },
      },
      orderBy: { weekEnding: 'asc' },
    });

    res.json(data);
  } catch (err) { next(err); }
});

export default router;
