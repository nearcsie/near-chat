import { describe, expect, it } from 'vitest';
import {
  loginSchema,
  registerSchema,
  searchQuerySchema,
  updateMeSchema,
  updateSettingsSchema,
} from '../../../src/validators/userSchemas';

describe('user validation schemas', () => {
  it('validates register payloads and enforces password length', () => {
    expect(registerSchema.safeParse({
      email: 'user@example.com',
      name: 'Alice',
      password: 'password123',
    }).success).toBe(true);
    expect(registerSchema.safeParse({
      email: 'invalid',
      name: 'Alice',
      password: 'password123',
    }).success).toBe(false);
    expect(registerSchema.safeParse({
      email: 'user@example.com',
      name: '',
      password: 'password123',
    }).success).toBe(false);
    expect(registerSchema.safeParse({
      email: 'user@example.com',
      name: 'Alice',
      password: 'short',
    }).success).toBe(false);
  });

  it('validates login payloads', () => {
    expect(loginSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
    }).success).toBe(true);
    expect(loginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    }).success).toBe(false);
  });

  it('requires at least one valid profile update field', () => {
    expect(updateMeSchema.parse({ name: '  Alice  ' })).toEqual({ name: 'Alice' });
    expect(updateMeSchema.safeParse({}).success).toBe(false);
    expect(updateMeSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(updateMeSchema.safeParse({ avatarUrl: 'not-a-url' }).success).toBe(false);
    expect(updateMeSchema.safeParse({ warningDays: 0 }).success).toBe(false);
  });

  it('requires at least one valid settings field', () => {
    expect(updateSettingsSchema.parse({ warningDays: 0 })).toEqual({ warningDays: 0 });
    expect(updateSettingsSchema.parse({ language: ' zh-TW ' })).toEqual({ language: 'zh-TW' });
    expect(updateSettingsSchema.safeParse({}).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ warningDays: -1 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ language: 'bad_tag!' }).success).toBe(false);
  });

  it('validates trimmed search queries', () => {
    expect(searchQuerySchema.parse({ q: ' Alice ' })).toEqual({ q: 'Alice' });
    expect(searchQuerySchema.safeParse({ q: '   ' }).success).toBe(false);
  });
});
