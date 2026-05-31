import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeUserService } from '../../../src/services/userService';
import { ConflictError, ValidationError } from '../../../src/errors/AppError';
import { registerSchema, loginSchema } from '../../../src/validators/userSchemas';
import type { IUserRepository } from '../../../src/repositories/IUserRepository';
import type { IEmergencyContactRepository } from '../../../src/repositories/IEmergencyContactRepository';
import type { User } from '../../../../shared/types';
import bcrypt from 'bcryptjs';

describe('userService', () => {
  let mockRepo: import('vitest').Mocked<IUserRepository>;
  let emergencyContactRepo: import('vitest').Mocked<IEmergencyContactRepository>;
  let mockJwt: { signToken: import('vitest').Mock };
  let notifyEmergencyContact: import('vitest').Mock;
  let userService: ReturnType<typeof makeUserService>;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      search: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    emergencyContactRepo = {
      findByUserId: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      recordAlertIfNew: vi.fn(),
    };
    mockJwt = {
      signToken: vi.fn(),
    };
    notifyEmergencyContact = vi.fn();
    userService = makeUserService(mockRepo, emergencyContactRepo, mockJwt, notifyEmergencyContact);
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
      expect(mockRepo.update).toHaveBeenCalledWith('u1', { lastActivity: expect.any(Date) });
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

  describe('getMe', () => {
    it('should return public user if found', async () => {
      mockRepo.findById.mockResolvedValue({ userId: 'u1', name: 'Test User', avatarUrl: 'http://img.com' } as User);
      const res = await userService.getMe('u1');
      expect(res).toEqual({ userId: 'u1', name: 'Test User', avatarUrl: 'http://img.com' });
      expect(mockRepo.findById).toHaveBeenCalledWith('u1');
    });

    it('should throw NotFoundError if user not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(userService.getMe('unknown')).rejects.toThrow();
    });
  });

  describe('updateMe', () => {
    it('should update user and return public profile', async () => {
      mockRepo.update.mockResolvedValue({ userId: 'u1', name: 'New Name', avatarUrl: 'new.jpg' } as User);
      const res = await userService.updateMe('u1', { name: 'New Name' });
      expect(mockRepo.update).toHaveBeenCalledWith('u1', { name: 'New Name' });
      expect(res).toEqual({ userId: 'u1', name: 'New Name', avatarUrl: 'new.jpg' });
    });

    it('should throw ValidationError on invalid payload', async () => {
      await expect(userService.updateMe('u1', { name: '' })).rejects.toThrow();
      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteMe', () => {
    it('should set deletedAt', async () => {
      await userService.deleteMe('u1');
      expect(mockRepo.update).toHaveBeenCalledWith('u1', { deletedAt: expect.any(Date) });
    });
  });

  describe('search', () => {
    it('should return mapped public users', async () => {
      mockRepo.search.mockResolvedValue([{ userId: 'u1', name: 'Test', avatarUrl: undefined } as User]);
      const res = await userService.search('Test');
      expect(res).toEqual([{ userId: 'u1', name: 'Test', avatarUrl: undefined }]);
      expect(mockRepo.search).toHaveBeenCalledWith('Test');
    });

    it('should throw ValidationError if query is invalid', async () => {
      await expect(userService.search('')).rejects.toThrow();
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

  describe('emergency alerts', () => {
    const inactiveUser: User = {
      userId: 'u1',
      name: 'Test',
      email: 'test@example.com',
      passwordHash: 'hash',
      warningEnabled: true,
      warningDays: 2,
      lastActivity: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    it('notifies emergency contacts for manual alerts', async () => {
      mockRepo.findById.mockResolvedValue(inactiveUser);
      emergencyContactRepo.findByUserId.mockResolvedValue([
        {
          userId: 'u1',
          contactId: 'u2',
          message: 'please check on me',
          createdAt: new Date(),
        },
      ]);

      const result = await userService.triggerEmergencyAlert('u1');

      expect(result).toEqual({ alerted: true, recipients: ['u2'] });
      expect(notifyEmergencyContact).toHaveBeenCalledWith('u2', {
        userId: 'u1',
        message: 'please check on me',
      });
    });

    it('checks inactivity threshold and suppresses duplicate alerts', async () => {
      mockRepo.findById.mockResolvedValue(inactiveUser);
      emergencyContactRepo.recordAlertIfNew.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      emergencyContactRepo.findByUserId.mockResolvedValue([
        {
          userId: 'u1',
          contactId: 'u2',
          message: 'inactive',
          createdAt: new Date(),
        },
      ]);

      const first = await userService.checkInactivity('u1', new Date('2026-01-04T00:00:00.000Z'));
      const second = await userService.checkInactivity('u1', new Date('2026-01-04T00:00:00.000Z'));

      expect(first.alerted).toBe(true);
      expect(second).toEqual({ alerted: false, recipients: [], reason: 'ALREADY_ALERTED' });
      expect(notifyEmergencyContact).toHaveBeenCalledTimes(1);
    });

    it('does not alert below the inactivity threshold', async () => {
      mockRepo.findById.mockResolvedValue(inactiveUser);

      const result = await userService.checkInactivity('u1', new Date('2026-01-02T00:00:00.000Z'));

      expect(result).toEqual({ alerted: false, recipients: [], reason: 'BELOW_THRESHOLD' });
      expect(emergencyContactRepo.recordAlertIfNew).not.toHaveBeenCalled();
      expect(notifyEmergencyContact).not.toHaveBeenCalled();
    });
  });
});
