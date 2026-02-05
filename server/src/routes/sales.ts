import { Router } from 'express';
import prisma from '../db.js';
import { validateQuery, schemas } from '../middleware/validation.js';

const router = Router();

// GET /weekly?weekEnding=YYYY-MM-DD — Sales pipeline summary
router.get('/weekly', validateQuery(schemas.weekEndingQuery), async (req, res, next) => {
  try {
    const { weekEnding } = (req as any).validated;
    const data = await prisma.salesWeekly.findMany({
      where: { weekEnding: new Date(weekEnding) },
      orderBy: { salesType: 'asc' },
    });
    res.json(data);
  } catch (err) { next(err); }
});

// GET /regional?weekEnding=YYYY-MM-DD — Regional sales breakdown
router.get('/regional', validateQuery(schemas.weekEndingQuery), async (req, res, next) => {
  try {
    const { weekEnding } = (req as any).validated;
    const data = await prisma.salesRegionalWeekly.findMany({
      where: { weekEnding: new Date(weekEnding) },
      orderBy: [{ region: 'asc' }, { salesType: 'asc' }],
    });
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
