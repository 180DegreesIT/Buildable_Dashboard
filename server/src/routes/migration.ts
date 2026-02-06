/**
 * Migration API routes — Excel workbook upload, dry-run, import, and SSE progress.
 *
 * POST /upload       — Upload .xlsx, return dry-run preview with jobId
 * POST /import/:jobId — Trigger import using stored buffer, returns immediately
 * GET  /progress/:jobId — SSE endpoint for real-time import progress
 */
import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { ApiError } from '../middleware/errorHandler.js';
import { ExcelMigrationService, migrationEmitter, type ProgressEvent } from '../services/ExcelMigrationService.js';

const router = Router();

// ─── Multer config for .xlsx uploads (separate from CSV upload config) ────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().split('.').pop();
    if (ext === 'xlsx' || ext === 'xls') {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx and .xls files are accepted'));
    }
  },
});

// ─── In-memory storage for uploaded buffers (keyed by jobId) ──────────────────

const jobBuffers = new Map<string, { buffer: Buffer; fileName: string; createdAt: number }>();

// Clean up old buffers (older than 30 minutes) periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of jobBuffers) {
    if (now - data.createdAt > 30 * 60 * 1000) {
      jobBuffers.delete(id);
    }
  }
}, 5 * 60 * 1000);

// ─── Service instance ─────────────────────────────────────────────────────────

const migrationService = new ExcelMigrationService();

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /upload
 * Upload an .xlsx file, parse it, and return a dry-run preview.
 * Stores the buffer in memory for subsequent import.
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return next(ApiError.badRequest('No file uploaded. Send an .xlsx file as multipart form data with field name "file".'));
    }

    const jobId = crypto.randomUUID();

    // Store buffer for later import
    jobBuffers.set(jobId, {
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      createdAt: Date.now(),
    });

    // Parse and return dry-run preview
    const dryRun = await migrationService.parseWorkbook(req.file.buffer);

    res.json({
      jobId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      ...dryRun,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /import/:jobId
 * Trigger the actual import using the previously uploaded buffer.
 * Returns immediately with status 'started'; import runs in background.
 */
router.post('/import/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const jobData = jobBuffers.get(jobId);

    if (!jobData) {
      return next(ApiError.notFound('Job not found or expired. Please re-upload the file.'));
    }

    // Return immediately — import runs in background
    res.json({ status: 'started', jobId });

    // Run import asynchronously (don't await)
    migrationService
      .importData(jobData.buffer, jobId)
      .then(() => {
        // Clean up buffer after successful import
        jobBuffers.delete(jobId);
      })
      .catch((err) => {
        console.error(`[Migration] Import failed for job ${jobId}:`, err);
      });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /progress/:jobId
 * SSE endpoint streaming real-time progress events for a migration job.
 */
router.get('/progress/:jobId', (req, res) => {
  const { jobId } = req.params;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const handler = (data: ProgressEvent) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (data.phase === 'complete' || data.phase === 'error') {
      setTimeout(() => res.end(), 100);
    }
  };

  migrationEmitter.on(jobId, handler);

  req.on('close', () => {
    migrationEmitter.off(jobId, handler);
  });
});

export default router;
