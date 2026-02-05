import { Router } from 'express';
import { z } from 'zod';
import prisma from '../db.js';
import { validateQuery, validateBody } from '../middleware/validation.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

// POST /parse — Parse CSV and return headers + preview rows (placeholder — full impl in Task 4)
router.post('/parse', async (_req, res, next) => {
  try {
    res.status(501).json({ error: { message: 'CSV parsing not yet implemented (Task 4)', statusCode: 501 } });
  } catch (err) { next(err); }
});

// POST /import — Commit mapped data to database (placeholder — full impl in Task 6)
router.post('/import', async (_req, res, next) => {
  try {
    res.status(501).json({ error: { message: 'CSV import not yet implemented (Task 6)', statusCode: 501 } });
  } catch (err) { next(err); }
});

// GET /history — Upload audit trail
const historySchema = z.object({
  dataType: z.string().optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'rolled_back']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

router.get('/history', validateQuery(historySchema), async (req, res, next) => {
  try {
    const { dataType, status, from, to } = (req as any).validated;
    const where: any = {};
    if (dataType) where.dataType = dataType;
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59Z');
    }

    const uploads = await prisma.csvUpload.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { mapping: { select: { name: true } } },
    });
    res.json(uploads);
  } catch (err) { next(err); }
});

// POST /:id/rollback — Rollback an upload (placeholder — full impl in Task 6)
router.post('/:id/rollback', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(ApiError.badRequest('Invalid upload ID'));

    const upload = await prisma.csvUpload.findUnique({ where: { id } });
    if (!upload) return next(ApiError.notFound('Upload not found'));

    res.status(501).json({ error: { message: 'Rollback not yet implemented (Task 6)', statusCode: 501 } });
  } catch (err) { next(err); }
});

// GET /mappings — List saved column mappings
router.get('/mappings', async (_req, res, next) => {
  try {
    const mappings = await prisma.csvColumnMapping.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(mappings);
  } catch (err) { next(err); }
});

// POST /mappings — Save a new column mapping
const createMappingSchema = z.object({
  name: z.string().min(1),
  dataType: z.string().min(1),
  mapping: z.record(z.string()),
});

router.post('/mappings', validateBody(createMappingSchema), async (req, res, next) => {
  try {
    const data = (req as any).validated;
    const mapping = await prisma.csvColumnMapping.create({ data });
    res.status(201).json(mapping);
  } catch (err) { next(err); }
});

// PUT /mappings/:id — Update a mapping
router.put('/mappings/:id', validateBody(createMappingSchema), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(ApiError.badRequest('Invalid mapping ID'));

    const data = (req as any).validated;
    const mapping = await prisma.csvColumnMapping.update({ where: { id }, data });
    res.json(mapping);
  } catch (err) { next(err); }
});

// DELETE /mappings/:id — Delete a mapping
router.delete('/mappings/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(ApiError.badRequest('Invalid mapping ID'));

    await prisma.csvColumnMapping.delete({ where: { id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
