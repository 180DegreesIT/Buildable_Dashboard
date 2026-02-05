import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import prisma from '../db.js';
import { validateQuery, validateBody } from '../middleware/validation.js';
import { ApiError } from '../middleware/errorHandler.js';
import { parseCsv, validateRows, detectDuplicates, type FieldMapping } from '../services/CsvParserService.js';
import { DataTypeRegistry } from '../services/DataTypeRegistry.js';

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

// ─── Data Type Registry ────────────────────────────────────────────────────────

// GET /data-types — List all importable data types (grouped by category)
router.get('/data-types', (_req, res) => {
  res.json({
    dataTypes: DataTypeRegistry.getAll(),
    grouped: DataTypeRegistry.getGrouped(),
  });
});

// GET /data-types/:id — Get a single data type definition with its fields
router.get('/data-types/:id', (req, res, next) => {
  const dt = DataTypeRegistry.getById(req.params.id);
  if (!dt) return next(ApiError.notFound(`Data type "${req.params.id}" not found`));
  res.json(dt);
});

// GET /data-types/:id/fields — Get the mappable fields for a data type
router.get('/data-types/:id/fields', (req, res, next) => {
  const dt = DataTypeRegistry.getById(req.params.id);
  if (!dt) return next(ApiError.notFound(`Data type "${req.params.id}" not found`));
  res.json({
    dataTypeId: dt.id,
    dataTypeName: dt.name,
    targetTable: dt.targetTable,
    fixedFields: dt.fixedFields,
    fields: dt.fields,
  });
});

// ─── Auto-Mapping ─────────────────────────────────────────────────────────────

// POST /auto-map — Find the best saved mapping for a data type + CSV headers
const autoMapSchema = z.object({
  dataTypeId: z.string().min(1),
  csvHeaders: z.array(z.string()),
});

router.post('/auto-map', validateBody(autoMapSchema), async (req, res, next) => {
  try {
    const { dataTypeId, csvHeaders } = (req as any).validated;

    // Validate data type exists
    const dt = DataTypeRegistry.getById(dataTypeId);
    if (!dt) return next(ApiError.notFound(`Data type "${dataTypeId}" not found`));

    // Find saved mappings for this data type
    const savedMappings = await prisma.csvColumnMapping.findMany({
      where: { dataType: dataTypeId },
      orderBy: { updatedAt: 'desc' },
    });

    if (savedMappings.length === 0) {
      return res.json({
        autoMapped: false,
        message: 'No saved mappings found for this data type.',
        suggestedMapping: null,
      });
    }

    // Score each saved mapping against the CSV headers
    const AUTO_MAP_THRESHOLD = 0.8;
    let bestMapping: typeof savedMappings[0] | null = null;
    let bestScore = 0;

    for (const saved of savedMappings) {
      const mapping = saved.mapping as Record<string, string>;
      const savedHeaders = Object.keys(mapping);
      const score = DataTypeRegistry.scoreMappingMatch(savedHeaders, csvHeaders);

      if (score > bestScore) {
        bestScore = score;
        bestMapping = saved;
      }
    }

    if (bestMapping && bestScore >= AUTO_MAP_THRESHOLD) {
      const mapping = bestMapping.mapping as Record<string, string>;

      // Identify which headers matched and which are new/missing
      const csvSet = new Set(csvHeaders.map((h) => h.trim().toLowerCase()));
      const matchedHeaders: string[] = [];
      const missingHeaders: string[] = [];

      for (const header of Object.keys(mapping)) {
        if (csvSet.has(header.trim().toLowerCase())) {
          matchedHeaders.push(header);
        } else {
          missingHeaders.push(header);
        }
      }

      const unmappedCsvHeaders = csvHeaders.filter(
        (h) => !Object.keys(mapping).some((mh) => mh.trim().toLowerCase() === h.trim().toLowerCase())
      );

      return res.json({
        autoMapped: true,
        mappingId: bestMapping.id,
        mappingName: bestMapping.name,
        score: Math.round(bestScore * 100),
        mapping: bestMapping.mapping,
        matchedHeaders,
        missingHeaders,
        unmappedCsvHeaders,
        message: `Auto-mapped using "${bestMapping.name}" (${Math.round(bestScore * 100)}% match). Review and confirm.`,
      });
    }

    return res.json({
      autoMapped: false,
      bestScore: bestMapping ? Math.round(bestScore * 100) : 0,
      bestMappingName: bestMapping?.name ?? null,
      message: bestMapping
        ? `Best match "${bestMapping.name}" only matched ${Math.round(bestScore * 100)}% of headers (need ${AUTO_MAP_THRESHOLD * 100}%).`
        : 'No saved mappings found for this data type.',
      suggestedMapping: null,
    });
  } catch (err) { next(err); }
});

// ─── Apply Mapping ────────────────────────────────────────────────────────────

// POST /apply-mapping — Validate rows using a data type + column mapping, return db-ready records
const applyMappingSchema = z.object({
  dataTypeId: z.string().min(1),
  rows: z.array(z.record(z.string())),
  mapping: z.record(z.string()),           // csvHeader → dbField
  targetTable: z.string().optional(),       // Override table for duplicate detection
});

router.post('/apply-mapping', validateBody(applyMappingSchema), async (req, res, next) => {
  try {
    const { dataTypeId, rows, mapping, targetTable } = (req as any).validated;

    // Validate data type exists
    const dt = DataTypeRegistry.getById(dataTypeId);
    if (!dt) return next(ApiError.notFound(`Data type "${dataTypeId}" not found`));

    // Build FieldMapping[] from the data type definition + user's column mapping
    const fieldMappings = DataTypeRegistry.buildFieldMappings(dataTypeId, mapping);

    if (fieldMappings.length === 0) {
      return next(ApiError.badRequest('No valid field mappings could be built. Check that your mapping references valid database fields.'));
    }

    // Check required fields are mapped
    const mappedDbFields = new Set(fieldMappings.map((f) => f.dbField));
    const missingRequired = dt.fields
      .filter((f) => f.required && !mappedDbFields.has(f.dbField))
      .map((f) => f.label);

    if (missingRequired.length > 0) {
      return next(ApiError.badRequest(
        `Required fields not mapped: ${missingRequired.join(', ')}`
      ));
    }

    // Run validation
    const validation = validateRows(rows, fieldMappings, 'weekEnding');

    // Inject fixed fields into each validated row's data
    if (Object.keys(dt.fixedFields).length > 0) {
      for (const row of validation.rows) {
        Object.assign(row.data, dt.fixedFields);
      }
    }

    // Duplicate detection
    const table = targetTable ?? dt.targetTable;
    const existingWeeks = await getExistingWeeks(table);
    const duplicates = await detectDuplicates(validation.rows, 'weekEnding', existingWeeks);

    res.json({
      dataType: { id: dt.id, name: dt.name, targetTable: dt.targetTable },
      fixedFields: dt.fixedFields,
      fieldMappings,
      ...validation,
      duplicates,
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
