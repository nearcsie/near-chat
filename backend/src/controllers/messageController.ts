import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../errors/AppError';
import type { MessageWithSender } from '../../../shared/types';

interface MessageService {
  listForRoom(
    userId: string,
    roomId: string,
    opts?: { beforeId?: string; limit?: number },
  ): Promise<MessageWithSender[]>;
}

export const makeMessageController = (service: MessageService) => ({
  async listForRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roomId = req.params.roomId as string;
      const before_id = typeof req.query.before_id === 'string' ? req.query.before_id : undefined;
      const limitRaw = typeof req.query.limit === 'string' ? req.query.limit : undefined;

      const parsedLimit = limitRaw !== undefined ? parseInt(limitRaw, 10) : 50;
      if (limitRaw !== undefined && (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100)) {
        return next(new ValidationError('limit must be an integer between 1 and 100'));
      }

      const messages = await service.listForRoom(req.user!.userId, roomId, {
        beforeId: before_id,
        limit: parsedLimit,
      });
      res.status(200).json(messages);
    } catch (err) {
      next(err);
    }
  },
});
