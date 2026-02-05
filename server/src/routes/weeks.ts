import { Router } from 'express';
import { WeekService } from '../services/WeekService.js';
import { validateQuery, schemas } from '../middleware/validation.js';

const router = Router();

// GET /current — Returns the current week ending date (Saturday)
router.get('/current', async (_req, res, next) => {
  try {
    const currentWeek = WeekService.getCurrentWeekEnding();
    const mostRecentWithData = await WeekService.getMostRecentWeekWithData();

    res.json({
      currentWeekEnding: currentWeek.toISOString().split('T')[0],
      mostRecentWithData: mostRecentWithData?.toISOString().split('T')[0] ?? null,
    });
  } catch (err) { next(err); }
});

// GET /list?from=YYYY-MM-DD&to=YYYY-MM-DD — List of available weeks with data
router.get('/list', validateQuery(schemas.optionalDateRangeQuery), async (req, res, next) => {
  try {
    const { from, to } = (req as any).validated;
    const weeks = await WeekService.getAvailableWeeks(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
    res.json(weeks.map((w) => w.toISOString().split('T')[0]));
  } catch (err) { next(err); }
});

export default router;
