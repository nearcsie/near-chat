import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../errors/AppError';
import type { MessageWithSender } from '../../../shared/types';

interface MessageService {
  listForRoom(
    userId: string,
    roomId: string,
    opts?: { beforeId?: string; limit?: number },
  ): Promise<MessageWithSender[]>;
  updateMessage(
    userId: string,
    roomId: string,
    messageId: string,
    content: string,
  ): Promise<MessageWithSender>;
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

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roomId = req.params.roomId as string;
      const messageId = req.params.messageId as string;
      const { content } = req.body;

      if (typeof content !== 'string') {
        return next(new ValidationError('content must be a string'));
      }

      const message = await service.updateMessage(
        req.user!.userId,
        roomId,
        messageId,
        content,
      );
      res.status(200).json(message);
    } catch (err) {
      next(err);
    }
  },
});
