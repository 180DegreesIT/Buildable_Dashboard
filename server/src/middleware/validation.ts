import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiError } from './errorHandler.js';

/**
 * Validates that a date string is a valid ISO date (YYYY-MM-DD).
 */
const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').refine(
  (val) => !isNaN(new Date(val).getTime()),
  'Invalid date',
);

/**
 * Common query parameter schemas.
 */
export const schemas = {
  weekEndingQuery: z.object({
    weekEnding: isoDateString,
  }),
  dateRangeQuery: z.object({
    from: isoDateString,
    to: isoDateString,
  }),
  optionalDateRangeQuery: z.object({
    from: isoDateString.optional(),
    to: isoDateString.optional(),
  }),
};

/**
 * Express middleware factory that validates req.query against a Zod schema.
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const messages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return next(ApiError.badRequest(`Validation error: ${messages.join('; ')}`));
    }
    // Attach parsed values for type-safe access
    (req as any).validated = result.data;
    next();
  };
}

/**
 * Express middleware factory that validates req.body against a Zod schema.
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return next(ApiError.badRequest(`Validation error: ${messages.join('; ')}`));
    }
    (req as any).validated = result.data;
    next();
  };
}
