import { Request, Response, NextFunction } from 'express';
import { updateMeSchema, searchQuerySchema } from '../validators/userSchemas';
import { ValidationError } from '../errors/AppError';
import type { PublicUser } from '../../../shared/types';

interface UserService {
  getMe(userId: string): Promise<PublicUser>;
  updateMe(userId: string, data: unknown): Promise<PublicUser>;
  search(query: string): Promise<PublicUser[]>;
}

export const makeUserController = (service: UserService) => ({
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const user = await service.getMe(userId);
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  },

  async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateMeSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid payload'));
      }
      const userId = req.user!.userId;
      const updated = await service.updateMe(userId, parsed.data);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  },

  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = searchQuerySchema.safeParse({ query: req.query.query });
      if (!parsed.success) {
        return next(new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid query'));
      }
      const users = await service.search(parsed.data.query);
      res.status(200).json(users);
    } catch (err) {
      next(err);
    }
  },
});
