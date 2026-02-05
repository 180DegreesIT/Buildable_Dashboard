import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import prisma from '../db.js';
import { validateQuery, validateBody } from '../middleware/validation.js';
import { ApiError } from '../middleware/errorHandler.js';
import { parseCsv, validateRows, detectDuplicates, type FieldMapping } from '../services/CsvParserService.js';

const router = Router();

// Multer config: 10MB max, memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.csv', '.tsv', 'text/csv', 'text/tab-separated-values', 'application/vnd.ms-excel'];
    const ext = file.originalname.toLowerCase().split('.').pop();
    if (ext === 'csv' || ext === 'tsv' || allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only .csv and .tsv files are accepted'));
    }
  },
});

// POST /parse — Parse CSV and return headers + preview rows + type inference
router.post('/parse', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return next(ApiError.badRequest('No file uploaded. Send a CSV file as multipart form data with field name "file".'));
    }

    const result = parseCsv(req.file.buffer);

    res.json({
      fileName: req.file.originalname,
      fileSize: req.file.size,
      ...result,
    });
  } catch (err) { next(err); }
});

// POST /validate — Validate parsed CSV data against a field mapping
const validateSchema = z.object({
  rows: z.array(z.record(z.string())),
  mappings: z.array(z.object({
    csvHeader: z.string(),
    dbField: z.string(),
    expectedType: z.enum(['date', 'currency', 'integer', 'decimal', 'percentage', 'text']),
    required: z.boolean(),
  })),
  weekEndingField: z.string().optional(),
  targetTable: z.string().optional(),
});

router.post('/validate', validateBody(validateSchema), async (req, res, next) => {
  try {
    const { rows, mappings, weekEndingField, targetTable } = (req as any).validated;

    const validation = validateRows(rows, mappings as FieldMapping[], weekEndingField);

    // Duplicate detection if weekEndingField and targetTable provided
    let duplicates: any[] = [];
    if (weekEndingField && targetTable) {
      // Get existing week_ending dates from the target table
      const existingWeeks = await getExistingWeeks(targetTable);
      duplicates = await detectDuplicates(validation.rows, weekEndingField, existingWeeks);
    }

    res.json({
      ...validation,
      duplicates,
    });
  } catch (err) { next(err); }
});

/**
 * Query existing week_ending dates from a target table for duplicate detection.
 */
async function getExistingWeeks(tableName: string): Promise<Date[]> {
  const tableMap: Record<string, () => Promise<Date[]>> = {
    financial_weekly: async () => (await prisma.financialWeekly.findMany({ select: { weekEnding: true } })).map(r => r.weekEnding),
    revenue_weekly: async () => [...new Set((await prisma.revenueWeekly.findMany({ select: { weekEnding: true } })).map(r => r.weekEnding))],
    projects_weekly: async () => [...new Set((await prisma.projectsWeekly.findMany({ select: { weekEnding: true } })).map(r => r.weekEnding))],
    sales_weekly: async () => [...new Set((await prisma.salesWeekly.findMany({ select: { weekEnding: true } })).map(r => r.weekEnding))],
    sales_regional_weekly: async () => [...new Set((await prisma.salesRegionalWeekly.findMany({ select: { weekEnding: true } })).map(r => r.weekEnding))],
    team_performance_weekly: async () => [...new Set((await prisma.teamPerformanceWeekly.findMany({ select: { weekEnding: true } })).map(r => r.weekEnding))],
    leads_weekly: async () => [...new Set((await prisma.leadsWeekly.findMany({ select: { weekEnding: true } })).map(r => r.weekEnding))],
    marketing_performance_weekly: async () => [...new Set((await prisma.marketingPerformanceWeekly.findMany({ select: { weekEnding: true } })).map(r => r.weekEnding))],
    website_analytics_weekly: async () => (await prisma.websiteAnalyticsWeekly.findMany({ select: { weekEnding: true } })).map(r => r.weekEnding),
    staff_productivity_weekly: async () => [...new Set((await prisma.staffProductivityWeekly.findMany({ select: { weekEnding: true } })).map(r => r.weekEnding))],
    phone_weekly: async () => [...new Set((await prisma.phoneWeekly.findMany({ select: { weekEnding: true } })).map(r => r.weekEnding))],
    cash_position_weekly: async () => (await prisma.cashPositionWeekly.findMany({ select: { weekEnding: true } })).map(r => r.weekEnding),
    google_reviews_weekly: async () => (await prisma.googleReviewsWeekly.findMany({ select: { weekEnding: true } })).map(r => r.weekEnding),
  };

  const fetcher = tableMap[tableName];
  if (!fetcher) return [];
  return fetcher();
}

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
