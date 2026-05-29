import { z } from 'zod';

const idSchema = z.string().trim().min(1, 'Id cannot be empty');

export const sendMessageSchema = z.object({
  roomId: idSchema,
  content: z.string().trim().min(1, 'Message content cannot be empty'),
  replyToId: idSchema.optional(),
});

export const listMessagesSchema = z.object({
  roomId: idSchema,
  beforeId: idSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export const recallMessageSchema = z.object({
  roomId: idSchema,
  messageId: idSchema,
});

export type SendMessageInput = z.input<typeof sendMessageSchema>;
export type ListMessagesInput = z.input<typeof listMessagesSchema>;
export type RecallMessageInput = z.input<typeof recallMessageSchema>;
