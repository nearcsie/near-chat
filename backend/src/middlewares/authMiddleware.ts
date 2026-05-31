import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth/jwt';
import { AUTH_COOKIE_NAME, readCookie } from '../auth/cookies';
import { AppError } from '../errors/AppError';

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
    req.user = payload;
    next();
  } catch (error) {
    next(new AppError(401, 'Unauthorized: Invalid token'));
  }
};
