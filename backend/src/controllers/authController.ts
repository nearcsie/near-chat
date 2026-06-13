import { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema } from '../validators/userSchemas';
import { ValidationError } from '../errors/AppError';
import { clearAuthCookie, setAuthCookie } from '../auth/cookies';
import type { AuthResponse } from '../../../shared/types';

interface AuthService {
  register(data: { email: string; name: string; password: string }): Promise<AuthResponse>;
  login(data: { email: string; password: string }): Promise<AuthResponse>;
}

export const makeAuthController = (service: AuthService) => ({
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid payload'));
      }
      const result = await service.register(parsed.data);
      setAuthCookie(res, result.token);
      res.status(201).json(result);
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
      setAuthCookie(res, result.token);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  logout(_req: Request, res: Response): void {
    clearAuthCookie(res);
    res.status(204).send();
  },
});
