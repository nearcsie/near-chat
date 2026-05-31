import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name cannot be empty'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password cannot be empty'),
});

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(1, 'Name cannot be empty').optional(),
    bio: z.string().trim().optional(),
    avatarUrl: z.string().url('Invalid avatar URL').optional(),
    warningEnabled: z.boolean().optional(),
    warningDays: z.number().int().min(1).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided',
  });

export const searchQuerySchema = z.object({
  query: z.string().trim().min(1, 'Search query cannot be empty'),
});

type RegisterSchema = z.infer<typeof registerSchema>;
type LoginSchema = z.infer<typeof loginSchema>;
export type UpdateMeInput = z.input<typeof updateMeSchema>;
type SearchQueryInput = z.input<typeof searchQuerySchema>;

export const addEmergencyContactSchema = z.object({
  contactId: z.string().uuid('Invalid contactId'),
  message: z.string().min(1, 'Message cannot be empty'),
});
type AddEmergencyContactInput = z.input<typeof addEmergencyContactSchema>;
