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
  repo: ReturnType<typeof makeFriendRepository>,
  notifyUser?: (userId: string, eventName: string, payload: any) => void
) => {
  return {
    async sendRequest(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user!.userId;
        const body = friendRequestSchema.parse(req.body);
        
        if (userId === body.target_user_id) {
          throw new ValidationError('Cannot send friend request to yourself');
        }

        const isBlocked = await repo.isBlocked(userId, body.target_user_id);
        if (isBlocked) {
          throw new AppError(403, 'Cannot interact with this user', 'FORBIDDEN');
        }

        const request = await repo.sendFriendRequest(userId, body.target_user_id);
        
        if (notifyUser) {
          notifyUser(body.target_user_id, 'friend_request', request);
        }

        res.status(201).json(request);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return next(new ValidationError(err.errors[0].message));
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
        const requests = await repo.getPendingRequests(userId);
        res.status(200).json(requests);
      } catch (err) {
        next(err);
      }
    },

    async respondRequest(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user!.userId;
        const requesterId = req.params.id;
        const body = friendResponseSchema.parse(req.body);

        if (body.status === 'accepted') {
          const accepted = await repo.acceptFriendRequest(requesterId, userId);
          if (!accepted) {
            throw new AppError(404, 'Friend request not found', 'NOT_FOUND');
          }
          res.status(200).json(accepted);
        } else {
          await repo.deleteFriendship(requesterId, userId);
          res.status(200).json({ status: 'rejected' });
        }
      } catch (err) {
        if (err instanceof z.ZodError) {
          return next(new ValidationError(err.errors[0].message));
        }
        next(err);
      }
    },

    async getFriends(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user!.userId;
        const friends = await repo.getFriends(userId);
        res.status(200).json(friends);
      } catch (err) {
        next(err);
      }
    },

    async removeFriend(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user!.userId;
        const friendId = req.params.id;
        await repo.deleteFriendship(userId, friendId);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    async blockUser(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user!.userId;
        const body = friendRequestSchema.parse(req.body);

        await repo.blockUser(userId, body.target_user_id);
        await repo.deleteFriendship(userId, body.target_user_id);
        
        res.status(201).json({ status: 'blocked' });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return next(new ValidationError(err.errors[0].message));
        }
        next(err);
      }
    },

    async unblockUser(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user!.userId;
        const blockedId = req.params.id;
        await repo.unblockUser(userId, blockedId);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    }
  };
};
