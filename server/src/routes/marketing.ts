import { Router } from 'express';
import prisma from '../db.js';
import { validateQuery, schemas } from '../middleware/validation.js';

const router = Router();

// GET /leads?weekEnding=YYYY-MM-DD — Lead source breakdown
router.get('/leads', validateQuery(schemas.weekEndingQuery), async (req, res, next) => {
  try {
    const { weekEnding } = (req as any).validated;
    const data = await prisma.leadsWeekly.findMany({
      where: { weekEnding: new Date(weekEnding) },
      orderBy: { source: 'asc' },
    });
    res.json(data);
  } catch (err) { next(err); }
});

// GET /reviews?weekEnding=YYYY-MM-DD — Google Reviews
router.get('/reviews', validateQuery(schemas.weekEndingQuery), async (req, res, next) => {
  try {
    const { weekEnding } = (req as any).validated;
    const data = await prisma.googleReviewsWeekly.findUnique({
      where: { weekEnding: new Date(weekEnding) },
    });
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
