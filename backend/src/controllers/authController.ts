import { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema } from '../validators/userSchemas';
import { ValidationError } from '../errors/AppError';
import type { AuthResponse, PublicUser } from '../../../shared/types';

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
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  logout(_req: Request, res: Response): void {
    res.status(204).send();
  },
});
