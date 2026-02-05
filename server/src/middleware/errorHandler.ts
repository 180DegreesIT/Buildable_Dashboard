import type { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string) {
    return new ApiError(400, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error(`[Error] ${err.message}`, err.stack);

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: { message: err.message, statusCode: err.statusCode },
    });
    return;
  }

  res.status(500).json({
    error: { message: 'An unexpected error occurred', statusCode: 500 },
  });
}
