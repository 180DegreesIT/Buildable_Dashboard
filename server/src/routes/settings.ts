import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { SettingsService } from '../services/SettingsService.js';
import { validateBody } from '../middleware/validation.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

// ─── Multer config for logo upload ─────────────────────────────────────────

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PNG, JPEG, SVG, WebP'));
    }
  },
});

// ─── Zod Schemas ───────────────────────────────────────────────────────────

const updateBrandingSchema = z.object({
  companyName: z.string().min(1).max(100),
  primaryColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

const updatePassThroughSchema = z.object({
  categories: z.array(z.string().min(1)).max(20),
});

const alertThresholdSchema = z.object({
  metric: z.string().min(1),
  label: z.string().min(1),
  direction: z.enum(['below', 'above']),
  warningValue: z.number(),
  criticalValue: z.number(),
  unit: z.enum(['currency', 'percentage']),
});

const updateAlertThresholdsSchema = z.object({
  thresholds: z.array(alertThresholdSchema),
});

// ─── Routes ────────────────────────────────────────────────────────────────

// GET / — Fetch all settings (any authenticated user — branding is needed globally)
router.get('/', async (_req, res, next) => {
  try {
    const settings = await SettingsService.getAll();
    res.json(settings);
  } catch (err) { next(err); }
});

// GET /:key — Fetch single setting by key
router.get('/:key', async (req, res, next) => {
  try {
    const value = await SettingsService.get(req.params.key);
    if (value === null) {
      res.json(null);
      return;
    }
    res.json(value);
  } catch (err) { next(err); }
});

// PUT /branding — Update branding text fields (merges with existing — preserves logoPath)
router.put('/branding',
  requirePermission('admin_settings', 'write'),
  validateBody(updateBrandingSchema),
  async (req, res, next) => {
    try {
      const data = (req as any).validated;
      const result = await SettingsService.upsert('branding', data);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// POST /branding/logo — Upload logo image
router.post('/branding/logo',
  requirePermission('admin_settings', 'write'),
  logoUpload.single('logo'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: { message: 'No file uploaded', statusCode: 400 } });
        return;
      }

      const logoPath = await SettingsService.uploadLogo(req.file.buffer, req.file.originalname);
      res.json({ logoPath });
    } catch (err) { next(err); }
  }
);

// DELETE /branding/logo — Remove logo
router.delete('/branding/logo',
  requirePermission('admin_settings', 'write'),
  async (_req, res, next) => {
    try {
      await SettingsService.deleteLogo();
      res.status(204).send();
    } catch (err) { next(err); }
  }
);

// PUT /pass-through-categories — Update pass-through items list
router.put('/pass-through-categories',
  requirePermission('admin_settings', 'write'),
  validateBody(updatePassThroughSchema),
  async (req, res, next) => {
    try {
      const data = (req as any).validated;
      const result = await SettingsService.upsert('pass_through_categories', data.categories);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// PUT /alert-thresholds — Update alert threshold configuration
router.put('/alert-thresholds',
  requirePermission('admin_settings', 'write'),
  validateBody(updateAlertThresholdsSchema),
  async (req, res, next) => {
    try {
      const data = (req as any).validated;
      const result = await SettingsService.upsert('alert_thresholds', data.thresholds);
      res.json(result);
    } catch (err) { next(err); }
  }
);

export default router;
