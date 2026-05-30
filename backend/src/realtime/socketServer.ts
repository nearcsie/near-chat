import type { ApiError, MessageWithSender } from '@shared/types';
import { AppError, ForbiddenError, NotFoundError } from '../errors/AppError';
import type { IMessageRepository } from '../repositories/IMessageRepository';
import type { IRoomMemberRepository } from '../repositories/IRoomMemberRepository';
import type { ChatServer } from './authSocket';

interface MessageService {
  sendMessage(
    userId: string,
    roomId: string,
    content: string,
    opts?: { replyToId?: string },
  ): Promise<MessageWithSender>;
  recallMessage(userId: string, roomId: string, messageId: string): Promise<MessageWithSender>;
}

interface SocketDeps {
  messageService: MessageService;
  messageRepository: Pick<IMessageRepository, 'findById'>;
  roomMemberRepository: Pick<IRoomMemberRepository, 'update'>;
}

const toApiError = (err: unknown): ApiError => {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, message: err.message, code: err.code };
  }
  return { statusCode: 500, message: 'Internal server error' };
};

export const attachSockets = (io: ChatServer, deps: SocketDeps): void => {
  io.on('connection', (socket) => {
    const userId = socket.data.user.userId;

    socket.join(`user_${userId}`);

    socket.on('join_room', ({ roomId }) => {
      socket.join(`room_${roomId}`);
    });

    socket.on('leave_room', ({ roomId }) => {
      socket.leave(`room_${roomId}`);
    });

    socket.on('send_message', async ({ roomId, content, replyTo }) => {
      try {
        const message = await deps.messageService.sendMessage(userId, roomId, content, {
          replyToId: replyTo,
        });
        io.to(`room_${roomId}`).emit('new_message', message);
      } catch (err) {
        socket.emit('error', toApiError(err));
      }
    });

    socket.on('recall_message', async ({ messageId }) => {
      try {
        const existing = await deps.messageRepository.findById(messageId);
        if (!existing) {
          throw new NotFoundError('message', messageId);
        }
        if (existing.senderId !== userId) {
          throw new ForbiddenError('Only the original sender can recall this message');
        }

        const recalled = await deps.messageService.recallMessage(userId, existing.roomId, messageId);
        io.to(`room_${existing.roomId}`).emit('message_recalled', {
          messageId: recalled.messageId,
        });
      } catch (err) {
        socket.emit('error', toApiError(err));
      }
    });

    socket.on('typing', ({ roomId, isTyping }) => {
      socket.to(`room_${roomId}`).emit('user_typing', { roomId, userId, isTyping });
    });

    socket.on('read_receipt', async ({ roomId, messageId }) => {
      try {
        await deps.roomMemberRepository.update(roomId, userId, { lastReadId: messageId });
        socket.to(`room_${roomId}`).emit('read_update', { roomId, userId, messageId });
      } catch (err) {
        socket.emit('error', toApiError(err));
      }
    });
  });
};
