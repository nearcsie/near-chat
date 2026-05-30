import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeUserService } from '../../../src/services/userService';
import { ConflictError, ValidationError } from '../../../src/errors/AppError';
import { registerSchema, loginSchema } from '../../../src/validators/userSchemas';
import type { IUserRepository } from '../../../src/repositories/IUserRepository';
import type { User } from '../../../../shared/types';
import bcrypt from 'bcryptjs';

describe('userService', () => {
  let mockRepo: import('vitest').Mocked<IUserRepository>;
  let mockJwt: { signToken: import('vitest').Mock };
  let userService: ReturnType<typeof makeUserService>;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    mockJwt = {
      signToken: vi.fn(),
    };
    userService = makeUserService(mockRepo, {} as any, mockJwt);
  });

  describe('register', () => {
    it('should successfully register a new user and return token and public profile', async () => {
      mockRepo.findByEmail.mockResolvedValue(null);
      const fakeUser: User = {
        userId: 'u1',
        name: 'Test',
        email: 'test@example.com',
        passwordHash: 'hashedpassword',
        warningEnabled: false,
        warningDays: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };
      mockRepo.create.mockResolvedValue(fakeUser);
      mockJwt.signToken.mockReturnValue('fake-jwt-token');

      const result = await userService.register({
        email: 'test@example.com',
        name: 'Test',
        password: 'password123'
      });

      expect(mockRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockRepo.create).toHaveBeenCalled();
      
      const createCall = mockRepo.create.mock.calls[0][0];
      expect(createCall.email).toBe('test@example.com');
      expect(createCall.name).toBe('Test');
      expect(createCall.passwordHash).not.toBe('password123'); // Should be hashed
      const isHashValid = await bcrypt.compare('password123', createCall.passwordHash);
      expect(isHashValid).toBe(true);

      expect(mockJwt.signToken).toHaveBeenCalledWith({ userId: 'u1', name: 'Test' });

      expect(result).toEqual({
        token: 'fake-jwt-token',
        user: {
          userId: 'u1',
          name: 'Test',
          avatarUrl: undefined
        }
      });
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw ConflictError if email already exists', async () => {
      mockRepo.findByEmail.mockResolvedValue({} as User);
      
      await expect(userService.register({
        email: 'exist@example.com',
        name: 'Exist',
        password: 'password123'
      })).rejects.toThrow(ConflictError);
      
      expect(mockRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should successfully login and return token and public profile', async () => {
      const password = 'password123';
      const passwordHash = await bcrypt.hash(password, 10);
      const fakeUser: User = {
        userId: 'u1',
        name: 'Test',
        email: 'test@example.com',
        passwordHash,
        warningEnabled: false,
        warningDays: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };
      mockRepo.findByEmail.mockResolvedValue(fakeUser);
      mockJwt.signToken.mockReturnValue('fake-jwt-token');

      const result = await userService.login({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(mockRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockJwt.signToken).toHaveBeenCalledWith({ userId: 'u1', name: 'Test' });
      expect(result.token).toBe('fake-jwt-token');
      expect(result.user).toEqual({
        userId: 'u1',
        name: 'Test',
        avatarUrl: undefined
      });
    });

    it('should throw ValidationError if email is unknown', async () => {
      mockRepo.findByEmail.mockResolvedValue(null);

      await expect(userService.login({
        email: 'unknown@example.com',
        password: 'password123'
      })).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if password does not match', async () => {
      const passwordHash = await bcrypt.hash('correctpassword', 10);
      mockRepo.findByEmail.mockResolvedValue({
        passwordHash
      } as User);

      await expect(userService.login({
        email: 'test@example.com',
        password: 'wrongpassword'
      })).rejects.toThrow(ValidationError);
    });
  });

  describe('Zod schemas', () => {
    it('should validate registerSchema', () => {
      expect(registerSchema.safeParse({ email: 'valid@example.com', name: 'N', password: 'password123' }).success).toBe(true);
      expect(registerSchema.safeParse({ email: 'invalid', name: 'N', password: 'password123' }).success).toBe(false);
      expect(registerSchema.safeParse({ email: 'valid@example.com', name: '', password: 'password123' }).success).toBe(false);
      expect(registerSchema.safeParse({ email: 'valid@example.com', name: 'N', password: 'short' }).success).toBe(false);
    });

    it('should validate loginSchema', () => {
      expect(loginSchema.safeParse({ email: 'valid@example.com', password: 'password123' }).success).toBe(true);
      expect(loginSchema.safeParse({ email: 'invalid', password: 'password123' }).success).toBe(false);
      expect(loginSchema.safeParse({ email: 'valid@example.com', password: '' }).success).toBe(false);
    });
  });
});
