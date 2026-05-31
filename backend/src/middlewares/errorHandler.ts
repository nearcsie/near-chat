import { Request, Response, NextFunction } from 'express';
import { mapErrorToApiShape } from '../errors/mapError';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const body = mapErrorToApiShape(err);
  res.status(body.statusCode).json(body);
}
