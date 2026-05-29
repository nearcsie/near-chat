import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth/jwt';
import { AppError } from '../errors/AppError';

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'Unauthorized: Missing or invalid Authorization header');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    throw new AppError(401, 'Unauthorized: Invalid token');
  }
};
