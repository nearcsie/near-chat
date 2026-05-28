import type { Message } from '@shared/types';

export interface IMessageRepository {
  findById(messageId: string): Promise<Message | null>;
  findByRoom(roomId: string, opts: { beforeId?: string; limit: number }): Promise<Message[]>;
  create(data: Pick<Message, 'roomId' | 'senderId' | 'content' | 'replyToId'>): Promise<Message>;
  markRecalled(messageId: string): Promise<Message>;
}
