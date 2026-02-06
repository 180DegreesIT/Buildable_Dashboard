import { Router } from 'express';
import { XeroAuthService } from '../services/XeroAuthService.js';
import { XeroSyncService } from '../services/XeroSyncService.js';
import { XeroScheduler } from '../services/XeroScheduler.js';
import prisma from '../db.js';

const router = Router();

// ─── GET /connect — Initiate Xero OAuth2 flow ─────────────────────────────

router.get('/connect', async (_req, res, next) => {
  try {
    const authService = XeroAuthService.getInstance();
    const consentUrl = await authService.getConsentUrl();

    if (authService.isMockMode()) {
      // In mock mode, return URL as JSON so client can redirect
      res.json({ url: consentUrl });
    } else {
      // In real mode, redirect to Xero consent page
      res.redirect(consentUrl);
    }
  } catch (err) {
    next(err);
  }
});

// ─── GET /callback — OAuth2 callback ──────────────────────────────────────

router.get('/callback', async (req, res, next) => {
  try {
    const authService = XeroAuthService.getInstance();

    // Build full callback URL from request
    const protocol = req.protocol;
    const host = req.get('host');
    const fullUrl = `${protocol}://${host}${req.originalUrl}`;

    await authService.handleCallback(fullUrl);

    // Redirect to admin settings with success indicator
    // TODO: In production, handle OAuth state parameter for CSRF protection
    res.redirect('/admin-settings?xero=connected');
  } catch (err) {
    console.error('[Xero Callback] Error:', err);
    res.redirect('/admin-settings?xero=error');
  }
});

// ─── GET /status — Connection status ──────────────────────────────────────

router.get('/status', async (_req, res, next) => {
  try {
    const authService = XeroAuthService.getInstance();
    const status = await authService.getConnectionStatus();

    res.json({
      ...status,
      schedulerRunning: XeroScheduler.isRunning(),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /disconnect — Disconnect Xero ───────────────────────────────────

router.post('/disconnect', async (_req, res, next) => {
  try {
    const authService = XeroAuthService.getInstance();

    // Stop scheduler if running
    XeroScheduler.stop();

    // Delete tokens
    await authService.disconnect();

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── POST /sync — Manual sync trigger ────────────────────────────────────

router.post('/sync', async (req, res, next) => {
  try {
    const syncService = XeroSyncService.getInstance();
    const weekEnding = req.body?.weekEnding || req.query?.weekEnding;

    const results = await syncService.syncAll(weekEnding as string | undefined);

    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    res.json({
      success: failedCount === 0,
      syncResults: results,
      summary: {
        total: results.length,
        succeeded: successCount,
        failed: failedCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /sync-logs — Recent sync logs ───────────────────────────────────

router.get('/sync-logs', async (_req, res, next) => {
  try {
    const logs = await prisma.xeroSyncLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    res.json(logs);
  } catch (err) {
    next(err);
  }
});

// ─── POST /scheduler/start — Start sync scheduler ────────────────────────

router.post('/scheduler/start', async (req, res, next) => {
  try {
    const cronExpression = req.body?.cronExpression;
    XeroScheduler.start(cronExpression);

    res.json({
      running: true,
      cronExpression: XeroScheduler.getCronExpression(),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /scheduler/stop — Stop sync scheduler ─────────────────────────

router.post('/scheduler/stop', async (_req, res, next) => {
  try {
    XeroScheduler.stop();

    res.json({ running: false });
  } catch (err) {
    next(err);
  }
});

export default router;
