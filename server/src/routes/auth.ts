import { Router } from 'express';
import { AuthService } from '../services/AuthService.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const REDIRECT_URI = process.env.AZURE_AD_REDIRECT_URI || 'http://localhost:6001/api/v1/auth/callback';

// GET /login — Redirect to M365 login (or return dev token in dev mode)
router.get('/login', async (_req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      const user = await AuthService.getDevUser();
      const token = AuthService.signToken(user);
      res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } });
      return;
    }

    const authUrl = await AuthService.getAuthUrl(REDIRECT_URI);
    if (!authUrl) {
      res.status(503).json({
        error: { message: 'M365 SSO is not configured. Set AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, and AZURE_AD_TENANT_ID.', statusCode: 503 },
      });
      return;
    }

    res.redirect(authUrl);
  } catch (err) { next(err); }
});

// GET /callback — Handle M365 OAuth callback
router.get('/callback', async (req, res, next) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).json({
        error: { message: 'Missing authorization code', statusCode: 400 },
      });
      return;
    }

    const user = await AuthService.handleCallback(code, REDIRECT_URI);
    if (!user) {
      res.status(401).json({
        error: { message: 'Authentication failed', statusCode: 401 },
      });
      return;
    }

    const token = AuthService.signToken(user);

    // Redirect to frontend with token (frontend will store it)
    res.redirect(`/?token=${encodeURIComponent(token)}`);
  } catch (err) { next(err); }
});

// GET /me — Return the currently authenticated user's profile
router.get('/me', authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: { message: 'Not authenticated', statusCode: 401 },
      });
      return;
    }

    const user = await AuthService.getUserWithPermissions(req.user.id);
    res.json(user);
  } catch (err) { next(err); }
});

// POST /logout — Placeholder (JWT is stateless; client discards the token)
router.post('/logout', (_req, res) => {
  res.json({ message: 'Logged out. Discard your token.' });
});

// GET /status — Check if SSO is configured
router.get('/status', (_req, res) => {
  res.json({
    ssoConfigured: AuthService.isSsoConfigured(),
    devMode: process.env.NODE_ENV === 'development',
  });
});

export default router;
