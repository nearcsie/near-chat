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

export type RegisterSchema = z.infer<typeof registerSchema>;
export type LoginSchema = z.infer<typeof loginSchema>;
