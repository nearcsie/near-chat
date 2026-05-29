import { z } from 'zod';

export const roomTypeSchema = z.enum(['private', 'group']);

export const createRoomSchema = z.object({
  type: roomTypeSchema.default('group'),
  name: z.string().trim().min(1, 'Room name cannot be empty'),
  requireApproval: z.boolean().default(false),
  viewHistory: z.boolean().default(true),
});

export const updateRoomSchema = z
  .object({
    name: z.string().trim().min(1, 'Room name cannot be empty').optional(),
    avatarUrl: z.string().url('Invalid avatar URL').optional(),
    requireApproval: z.boolean().optional(),
    viewHistory: z.boolean().optional(),
    isArchived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one room field must be provided',
  });

export type CreateRoomInput = z.input<typeof createRoomSchema>;
export type UpdateRoomInput = z.input<typeof updateRoomSchema>;
