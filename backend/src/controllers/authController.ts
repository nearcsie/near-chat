import { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema } from '../validators/userSchemas';
import { ValidationError } from '../errors/AppError';
import { clearRefreshCookie, setRefreshCookie, readCookie, REFRESH_COOKIE_NAME } from '../auth/cookies';
import type { AuthResponse } from '../../../shared/types';

interface AuthService {
  register(data: { email: string; name: string; password: string }): Promise<AuthResponse & { refreshToken: string }>;
  login(data: { email: string; password: string }): Promise<AuthResponse & { refreshToken: string }>;
  refresh(refreshToken: string): Promise<AuthResponse & { refreshToken: string }>;
  revokeToken(refreshToken: string): Promise<void>;
}

export const makeAuthController = (service: AuthService) => ({
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid payload'));
      }
      const result = await service.register(parsed.data);
      setRefreshCookie(res, result.refreshToken);
      res.status(201).json({
        token: result.token,
        user: result.user
      });
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid payload'));
      }
      const result = await service.login(parsed.data);
      setRefreshCookie(res, result.refreshToken);
      res.status(200).json({
        token: result.token,
        user: result.user
      });
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = readCookie(req.headers.cookie, REFRESH_COOKIE_NAME);
      if (refreshToken) {
        await service.revokeToken(refreshToken);
      }
      clearRefreshCookie(res);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = readCookie(req.headers.cookie, REFRESH_COOKIE_NAME);
      if (!refreshToken) {
        return next(new ValidationError('Missing refresh token'));
      }
      const result = await service.refresh(refreshToken);
      setRefreshCookie(res, result.refreshToken);
      res.status(200).json({
        token: result.token,
        user: result.user
      });
    } catch (err) {
      clearRefreshCookie(res);
      next(err);
    }
  },
});

