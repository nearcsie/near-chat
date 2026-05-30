import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const body: { statusCode: number; message: string; code?: string } = {
      statusCode: err.statusCode,
      message: err.message,
      ...(err.code !== undefined && { code: err.code }),
    };
    res.status(err.statusCode).json(body);
    return;
  }

  console.error("APP ERROR:", err);
  // Unknown / unexpected errors — never leak stack traces in production
  res.status(500).json({
    statusCode: 500,
    message: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
  });
}
