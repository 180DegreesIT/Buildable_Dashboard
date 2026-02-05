import { Router } from 'express';
import prisma from '../db.js';
import { validateQuery, schemas } from '../middleware/validation.js';

const router = Router();

// GET /weekly?weekEnding=YYYY-MM-DD — Project summary (resi/commercial/retro)
router.get('/weekly', validateQuery(schemas.weekEndingQuery), async (req, res, next) => {
  try {
    const { weekEnding } = (req as any).validated;
    const data = await prisma.projectsWeekly.findMany({
      where: { weekEnding: new Date(weekEnding) },
      orderBy: { projectType: 'asc' },
    });
    res.json(data);
  } catch (err) { next(err); }
});

// GET /weekly/range?from=YYYY-MM-DD&to=YYYY-MM-DD — Trend data
router.get('/weekly/range', validateQuery(schemas.dateRangeQuery), async (req, res, next) => {
  try {
    const { from, to } = (req as any).validated;
    const data = await prisma.projectsWeekly.findMany({
      where: {
        weekEnding: { gte: new Date(from), lte: new Date(to) },
      },
      orderBy: [{ weekEnding: 'asc' }, { projectType: 'asc' }],
    });
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
