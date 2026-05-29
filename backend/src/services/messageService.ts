import type { Message, MessageWithSender } from '@shared/types';
import type { IMessageRepository } from '../repositories/IMessageRepository';
import type { IRoomMemberRepository } from '../repositories/IRoomMemberRepository';
import type { IRoomRepository } from '../repositories/IRoomRepository';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors/AppError';
import {
  listMessagesSchema,
  recallMessageSchema,
  sendMessageSchema,
} from '../validators/messageSchemas';

const validationMessage = (issues: { message: string }[]) =>
  issues[0]?.message ?? 'Invalid message payload';

const withSenderPlaceholder = (message: Message): MessageWithSender => ({
  ...message,
  sender: null,
});

export const makeMessageService = (
  messageRepo: IMessageRepository,
  roomRepo: IRoomRepository,
  roomMemberRepo: IRoomMemberRepository,
) => {
  const assertRoomMembership = async (userId: string, roomId: string) => {
    const room = await roomRepo.findById(roomId);
    if (!room) {
      throw new NotFoundError('room', roomId);
    }

    const member = await roomMemberRepo.findMember(roomId, userId);
    if (!member) {
      throw new ForbiddenError('User is not a member of this room');
    }
  };

  return {
    async sendMessage(
      userId: string,
      roomId: string,
      content: string,
      opts: { replyToId?: string } = {},
    ): Promise<MessageWithSender> {
      const parsed = sendMessageSchema.safeParse({
        roomId,
        content,
        replyToId: opts.replyToId,
      });
      if (!parsed.success) {
        throw new ValidationError(validationMessage(parsed.error.issues));
      }

      await assertRoomMembership(userId, parsed.data.roomId);

      const messageData: Pick<Message, 'roomId' | 'senderId' | 'content' | 'replyToId'> = {
        roomId: parsed.data.roomId,
        senderId: userId,
        content: parsed.data.content,
      };
      if (parsed.data.replyToId) {
        messageData.replyToId = parsed.data.replyToId;
      }

      const message = await messageRepo.create(messageData);
      return withSenderPlaceholder(message);
    },

    async listForRoom(
      userId: string,
      roomId: string,
      opts: { beforeId?: string; limit?: number } = {},
    ): Promise<MessageWithSender[]> {
      const parsed = listMessagesSchema.safeParse({
        roomId,
        beforeId: opts.beforeId,
        limit: opts.limit ?? 50,
      });
      if (!parsed.success) {
        throw new ValidationError(validationMessage(parsed.error.issues));
      }

      await assertRoomMembership(userId, parsed.data.roomId);

      const messages = await messageRepo.findByRoom(parsed.data.roomId, {
        beforeId: parsed.data.beforeId,
        limit: parsed.data.limit,
      });
      return messages.map(withSenderPlaceholder);
    },

    async recallMessage(
      userId: string,
      roomId: string,
      messageId: string,
    ): Promise<MessageWithSender> {
      const parsed = recallMessageSchema.safeParse({ roomId, messageId });
      if (!parsed.success) {
        throw new ValidationError(validationMessage(parsed.error.issues));
      }

      await assertRoomMembership(userId, parsed.data.roomId);

      const existing = await messageRepo.findById(parsed.data.messageId);
      if (!existing || existing.roomId !== parsed.data.roomId) {
        throw new NotFoundError('message', parsed.data.messageId);
      }

      const recalled = await messageRepo.markRecalled(parsed.data.messageId);
      return withSenderPlaceholder(recalled);
    },
  };
};
