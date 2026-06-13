import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth/jwt';
import { AUTH_COOKIE_NAME, readCookie } from '../auth/cookies';
import { AppError } from '../errors/AppError';
import pool from '../db';

const getBearerToken = (authHeader: string | undefined): string | undefined => {
  if (!authHeader?.startsWith('Bearer ')) return undefined;
  return authHeader.split(' ')[1];
};

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = readCookie(req.headers.cookie, AUTH_COOKIE_NAME) ?? getBearerToken(req.headers.authorization);
  if (!token) {
    return next(new AppError(401, 'Unauthorized: Missing authentication token'));
  }

  try {
    const payload = verifyToken(token);
    const result = await pool.query(
      'SELECT 1 FROM users WHERE user_id = $1 AND deleted_at IS NULL',
      [payload.userId]
    );
    if (result.rows.length === 0) {
      return next(new AppError(401, 'Unauthorized: Account not found or deleted'));
    }
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError(401, 'Unauthorized: Invalid token'));
  }
};
