import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService.js';
import type { User } from '../generated/prisma/index.js';

// Extend Express Request with user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Authentication middleware.
 *
 * In development mode (NODE_ENV=development): auto-authenticates as the
 * configured dev user with Super Admin permissions. No token required.
 *
 * In production mode: verifies the JWT from the Authorization header
 * and attaches the user to req.user.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  // Dev bypass: auto-authenticate as dev user
  if (process.env.NODE_ENV === 'development') {
    try {
      req.user = await AuthService.getDevUser();
      return next();
    } catch (err) {
      // If DB is unavailable in dev, continue without user
      return next();
    }
  }

  // Production: verify JWT from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: { message: 'Authentication required', statusCode: 401 },
    });
    return;
  }

  const token = authHeader.slice(7);
  const payload = AuthService.verifyToken(token);
  if (!payload) {
    res.status(401).json({
      error: { message: 'Invalid or expired token', statusCode: 401 },
    });
    return;
  }

  // Load full user from database
  const user = await AuthService.getUserWithPermissions(payload.userId);
  if (!user || !user.isActive) {
    res.status(403).json({
      error: { message: 'Account is inactive', statusCode: 403 },
    });
    return;
  }

  req.user = user;
  next();
}
