import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError, ValidationError } from '../errors/AppError';
import type { makeFriendRepository } from '../repositories/friendRepository';

export const friendRequestSchema = z.object({
  target_user_id: z.string().uuid(),
});

export const friendResponseSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
});

export const makeFriendController = (
  service: any
) => {
  return {
    async sendRequest(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user!.userId;
        const body = friendRequestSchema.parse(req.body);
        
        const request = await service.sendFriendRequest(userId, body.target_user_id);

        res.status(201).json(request);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return next(new ValidationError(err.issues[0]?.message ?? 'Invalid request'));
        }
        if ((err as any).code === '23505') { // Unique violation
           return res.status(409).json({ message: 'Request already exists' });
        }
        next(err);
      }
    },

    async getRequests(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user!.userId;
        const requests = await service.getPendingRequests(userId);
        res.status(200).json(requests);
      } catch (err) {
        next(err);
      }
    },

    async respondRequest(req: Request<{ id: string }>, res: Response, next: NextFunction) {
      try {
        const userId = req.user!.userId;
        const requesterId = req.params.id;
        const body = friendResponseSchema.parse(req.body);

        const result = await service.respondFriendRequest(userId, requesterId, body.status);
        res.status(200).json(result);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return next(new ValidationError(err.issues[0]?.message ?? 'Invalid request'));
        }
        next(err);
      }
    },

    async getFriends(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user!.userId;
        const friends = await service.getFriends(userId);
        res.status(200).json(friends);
      } catch (err) {
        next(err);
      }
    },

    async removeFriend(req: Request<{ id: string }>, res: Response, next: NextFunction) {
      try {
        const userId = req.user!.userId;
        const friendId = req.params.id;
        await service.removeFriend(userId, friendId);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    async blockUser(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user!.userId;
        const body = friendRequestSchema.parse(req.body);

        const result = await service.blockUser(userId, body.target_user_id);
        
        res.status(201).json(result);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return next(new ValidationError(err.issues[0]?.message ?? 'Invalid request'));
        }
        next(err);
      }
    },

    async unblockUser(req: Request<{ id: string }>, res: Response, next: NextFunction) {
      try {
        const userId = req.user!.userId;
        const blockedId = req.params.id;
        await service.unblockUser(userId, blockedId);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    }
  };
};
