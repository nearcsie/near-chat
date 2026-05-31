import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth/jwt';
import { AppError } from '../errors/AppError';

import pool from '../db';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(401, 'Unauthorized: Missing or invalid Authorization header'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyToken(token);
    
    // Check if user is soft-deleted
    const userRes = await pool.query('SELECT deleted_at FROM users WHERE user_id = $1', [payload.userId]);
    if (userRes.rows.length === 0 || userRes.rows[0].deleted_at !== null) {
      return next(new AppError(401, 'Unauthorized: Account deleted or disabled'));
    }

    req.user = payload;
    next();
  } catch (error) {
    next(new AppError(401, 'Unauthorized: Invalid token'));
  }
};
