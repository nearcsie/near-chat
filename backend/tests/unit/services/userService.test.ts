import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, ValidationError } from '../../../src/errors/AppError';
import type { IEmergencyContactRepository } from '../../../src/repositories/IEmergencyContactRepository';
import type { IUserRepository } from '../../../src/repositories/IUserRepository';
import { makeUserService } from '../../../src/services/userService';
import { loginSchema, registerSchema } from '../../../src/validators/userSchemas';
import type { User } from '../../../../shared/types';

describe('userService', () => {
  let mockRepo: import('vitest').Mocked<IUserRepository>;
  let emergencyContactRepo: import('vitest').Mocked<IEmergencyContactRepository>;
  let mockRefreshTokenRepo: import('vitest').Mocked<any>;
  let mockJwt: { signToken: import('vitest').Mock; generateRefreshToken: import('vitest').Mock; hashToken: import('vitest').Mock };
  let notifyEmergencyContact: import('vitest').Mock;
  let userService: ReturnType<typeof makeUserService>;

  const baseUser = (): User => ({
    userId: 'u1',
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: 'hashedpassword',
    bio: 'Hello there',
    avatarUrl: 'https://example.com/avatar.png',
    language: 'en',
    theme: 'light',
    notifyDesktop: true,
    notifySound: true,
    warningEnabled: false,
    warningDays: 0,
    lastActivity: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
  });

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      search: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findAllWarningEnabled: vi.fn(),
    };
    emergencyContactRepo = {
      findByUserId: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      recordAlertIfNew: vi.fn(),
    };
    mockRefreshTokenRepo = {
      create: vi.fn(),
      findByHash: vi.fn(),
      revoke: vi.fn(),
      revokeAllForUser: vi.fn(),
      rotate: vi.fn(),
    };
    mockRefreshTokenRepo.create.mockResolvedValue({
      tokenId: 'new-rt-id',
      userId: 'u1',
      tokenHash: 'hashed-fake-refresh-token',
      expiresAt: new Date(Date.now() + 100000),
      createdAt: new Date(),
      revokedAt: null,
      replacedBy: null,
    });
    mockRefreshTokenRepo.rotate.mockResolvedValue({
      tokenId: 'new-rt-id',
      userId: 'u1',
      tokenHash: 'hashed-new-fake-refresh-token',
      expiresAt: new Date(Date.now() + 100000),
      createdAt: new Date(),
      revokedAt: null,
      replacedBy: null,
    });
    mockJwt = {
      signToken: vi.fn(),
      generateRefreshToken: vi.fn(),
      hashToken: vi.fn(),
    };
    mockJwt.generateRefreshToken.mockReturnValue('fake-refresh-token');
    mockJwt.hashToken.mockImplementation((t: string) => `hashed-${t}`);
    notifyEmergencyContact = vi.fn();
    userService = makeUserService(
      mockRepo,
      emergencyContactRepo,
      mockRefreshTokenRepo,
      mockJwt,
      notifyEmergencyContact
    );
  });

  describe('register', () => {
    it('registers a new user and returns a public profile', async () => {
      mockRepo.findByEmail.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(baseUser());
      mockJwt.signToken.mockReturnValue('fake-jwt-token');

      const result = await userService.register({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
      });

      expect(mockRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockRepo.create).toHaveBeenCalled();
      const createCall = mockRepo.create.mock.calls[0][0];
      expect(createCall.name).toBe('Test User');
      expect(createCall.email).toBe('test@example.com');
      expect(createCall.passwordHash).not.toBe('password123');
      expect(await bcrypt.compare('password123', createCall.passwordHash)).toBe(true);
      expect(result).toEqual({
        token: 'fake-jwt-token',
        refreshToken: 'fake-refresh-token',
        user: {
          userId: 'u1',
          name: 'Test User',
          avatarUrl: 'https://example.com/avatar.png',
        },
      });
    });

    it('rejects duplicate emails', async () => {
      mockRepo.findByEmail.mockResolvedValue(baseUser());
      await expect(
        userService.register({
          email: 'test@example.com',
          name: 'Test User',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictError);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('logs in a valid user', async () => {
      const user = baseUser();
      user.passwordHash = await bcrypt.hash('password123', 10);
      mockRepo.findByEmail.mockResolvedValue(user);
      mockJwt.signToken.mockReturnValue('fake-jwt-token');

      const result = await userService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockRepo.update).toHaveBeenCalledWith('u1', { lastActivity: expect.any(Date) });
      expect(result.token).toBe('fake-jwt-token');
      expect(result.refreshToken).toBe('fake-refresh-token');
      expect(result.user).toEqual({
        userId: 'u1',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
      });
    });

    it('rejects unknown emails', async () => {
      mockRepo.findByEmail.mockResolvedValue(null);
      await expect(
        userService.login({
          email: 'missing@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects wrong passwords', async () => {
      const user = baseUser();
      user.passwordHash = await bcrypt.hash('correctpassword', 10);
      mockRepo.findByEmail.mockResolvedValue(user);
      await expect(
        userService.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('profile methods', () => {
    it('returns my profile', async () => {
      mockRepo.findById.mockResolvedValue(baseUser());

      await expect(userService.getMe('u1')).resolves.toEqual({
        userId: 'u1',
        name: 'Test User',
        email: 'test@example.com',
        bio: 'Hello there',
        avatarUrl: 'https://example.com/avatar.png',
      });
    });

    it('returns a public user profile', async () => {
      mockRepo.findById.mockResolvedValue(baseUser());

      await expect(userService.getUserProfile('u1')).resolves.toEqual({
        userId: 'u1',
        name: 'Test User',
        bio: 'Hello there',
        avatarUrl: 'https://example.com/avatar.png',
      });
    });

    it('updates my editable profile fields', async () => {
      const updatedUser = { ...baseUser(), name: 'New Name', avatarUrl: 'https://example.com/new.png' };
      mockRepo.update.mockResolvedValue(updatedUser);

      const result = await userService.updateMe('u1', { name: 'New Name' });

      expect(mockRepo.update).toHaveBeenCalledWith('u1', { name: 'New Name' });
      expect(result).toEqual({
        userId: 'u1',
        name: 'New Name',
        email: 'test@example.com',
        bio: 'Hello there',
        avatarUrl: 'https://example.com/new.png',
      });
    });

    it('updates email and password through my profile', async () => {
      const passwordHash = await bcrypt.hash('oldpassword123', 10);
      mockRepo.findById.mockResolvedValue({ ...baseUser(), passwordHash });
      const updatedUser = { ...baseUser(), email: 'new@example.com' };
      mockRepo.findByEmail.mockResolvedValue(null);
      mockRepo.update.mockResolvedValue(updatedUser);

      const result = await userService.updateMe('u1', {
        email: 'new@example.com',
        password: 'newpassword123',
        currentPassword: 'oldpassword123',
      });

      expect(mockRepo.findById).toHaveBeenCalledWith('u1');
      expect(mockRepo.findByEmail).toHaveBeenCalledWith('new@example.com');
      const updateCall = mockRepo.update.mock.calls[0][1];
      expect(updateCall.email).toBe('new@example.com');
      expect(updateCall.passwordHash).not.toBe('newpassword123');
      expect(await bcrypt.compare('newpassword123', updateCall.passwordHash!)).toBe(true);
      expect(result.email).toBe('new@example.com');
    });

    it('rejects updating email to another user email', async () => {
      mockRepo.findByEmail.mockResolvedValue({ ...baseUser(), userId: 'u2' });

      await expect(userService.updateMe('u1', { email: 'taken@example.com' })).rejects.toThrow(ConflictError);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('rejects invalid profile payloads', async () => {
      await expect(userService.updateMe('u1', { name: '' })).rejects.toThrow(ValidationError);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('settings methods', () => {
    it('returns user settings', async () => {
      mockRepo.findById.mockResolvedValue(baseUser());

      await expect(userService.getMySettings('u1')).resolves.toEqual({
        warningEnabled: false,
        warningDays: 0,
        language: 'en',
        theme: 'light',
        notifyDesktop: true,
        notifySound: true,
      });
    });

    it('updates settings when the next state is valid', async () => {
      mockRepo.findById.mockResolvedValue({ ...baseUser(), warningEnabled: false, warningDays: 0 });
      mockRepo.update.mockResolvedValue({
        ...baseUser(),
        warningEnabled: true,
        warningDays: 3,
        language: 'zh-TW',
        theme: 'dark',
        notifyDesktop: false,
        notifySound: false,
      });

      const result = await userService.updateMySettings('u1', {
        warningEnabled: true,
        warningDays: 3,
        language: 'zh-TW',
        theme: 'dark',
        notifyDesktop: false,
        notifySound: false,
      });

      expect(mockRepo.update).toHaveBeenCalledWith('u1', {
        warningEnabled: true,
        warningDays: 3,
        language: 'zh-TW',
        theme: 'dark',
        notifyDesktop: false,
        notifySound: false,
      });
      expect(result).toEqual({
        warningEnabled: true,
        warningDays: 3,
        language: 'zh-TW',
        theme: 'dark',
        notifyDesktop: false,
        notifySound: false,
      });
    });

    it('rejects enabling alerts with a zero-day threshold', async () => {
      mockRepo.findById.mockResolvedValue({ ...baseUser(), warningEnabled: false, warningDays: 0 });

      await expect(
        userService.updateMySettings('u1', {
          warningEnabled: true,
        }),
      ).rejects.toThrow(ValidationError);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteMe', () => {
    it('soft deletes the account', async () => {
      await userService.deleteMe('u1');
      expect(mockRepo.update).toHaveBeenCalledWith('u1', { deletedAt: expect.any(Date) });
    });
  });

  describe('search', () => {
    it('maps search results to public users', async () => {
      mockRepo.search.mockResolvedValue([baseUser()]);

      await expect(userService.search('Test')).resolves.toEqual([
        {
          userId: 'u1',
          name: 'Test User',
          email: 'test@example.com',
          avatarUrl: 'https://example.com/avatar.png',
        },
      ]);
    });

    it('rejects empty search queries', async () => {
      await expect(userService.search('')).rejects.toThrow(ValidationError);
    });

    it('passes mode=email to repo for exact email lookup', async () => {
      mockRepo.search.mockResolvedValue([baseUser()]);

      await userService.search('test@example.com', 'email');

      expect(mockRepo.search).toHaveBeenCalledWith('test@example.com', 'email');
    });

    it('passes mode=userId to repo for exact userId lookup', async () => {
      mockRepo.search.mockResolvedValue([baseUser()]);

      await userService.search('u1', 'userId');

      expect(mockRepo.search).toHaveBeenCalledWith('u1', 'userId');
    });

    it('passes mode=name to repo for fuzzy name search', async () => {
      mockRepo.search.mockResolvedValue([baseUser()]);

      await userService.search('Test', 'name');

      expect(mockRepo.search).toHaveBeenCalledWith('Test', 'name');
    });

    it('omits email from results when mode=name to prevent email enumeration', async () => {
      mockRepo.search.mockResolvedValue([baseUser()]);

      const results = await userService.search('Test', 'name');

      expect(results).toEqual([
        {
          userId: 'u1',
          name: 'Test User',
          avatarUrl: 'https://example.com/avatar.png',
        },
      ]);
      expect(results[0]).not.toHaveProperty('email');
    });

    it('includes email in results when mode=email', async () => {
      mockRepo.search.mockResolvedValue([baseUser()]);

      const results = await userService.search('test@example.com', 'email');

      expect(results[0]).toMatchObject({ email: 'test@example.com' });
    });

    it('includes email in results when mode=userId', async () => {
      mockRepo.search.mockResolvedValue([baseUser()]);

      const results = await userService.search('u1', 'userId');

      expect(results[0]).toMatchObject({ email: 'test@example.com' });
    });

    it('searches user friends when currentUserId is provided', async () => {
      const mockFriendRepo = {
        getFriends: vi.fn().mockResolvedValue([
          {
            friend: {
              userId: 'friend-1',
              name: 'Alice Friend',
              email: 'alice.friend@example.com',
              avatarUrl: 'https://example.com/alice.png',
            },
            friendshipCreatedAt: new Date(),
          },
          {
            friend: {
              userId: 'friend-2',
              name: 'Bob Friend',
              email: 'bob.friend@example.com',
              avatarUrl: 'https://example.com/bob.png',
            },
            friendshipCreatedAt: new Date(),
          },
        ]),
      };

      const userServiceWithFriends = makeUserService(
        mockRepo,
        emergencyContactRepo,
        mockRefreshTokenRepo,
        mockJwt,
        notifyEmergencyContact,
        mockFriendRepo,
      );

      const results = await userServiceWithFriends.search('Alice', 'name', 'user-id');
      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe('friend-1');
      expect(results[0].name).toBe('Alice Friend');
      expect(mockFriendRepo.getFriends).toHaveBeenCalledWith('user-id');
      expect(mockRepo.search).not.toHaveBeenCalled();
    });
  });

  describe('schema sanity checks', () => {
    it('keeps register schema validation intact', () => {
      expect(registerSchema.safeParse({ email: 'valid@example.com', name: 'N', password: 'password123' }).success).toBe(true);
      expect(registerSchema.safeParse({ email: 'invalid', name: 'N', password: 'password123' }).success).toBe(false);
    });

    it('keeps login schema validation intact', () => {
      expect(loginSchema.safeParse({ email: 'valid@example.com', password: 'password123' }).success).toBe(true);
      expect(loginSchema.safeParse({ email: 'invalid', password: 'password123' }).success).toBe(false);
    });
  });

  describe('emergency alerts', () => {
    const inactiveUser: User = {
      ...baseUser(),
      warningEnabled: true,
      warningDays: 2,
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
        message: '(測試) please check on me',
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
    });
  });

  describe('refresh and revokeToken', () => {
    it('successfully refreshes token', async () => {
      const mockRecord = {
        tokenId: 'rt1',
        userId: 'u1',
        tokenHash: 'hashed-old-token',
        expiresAt: new Date(Date.now() + 100000),
        createdAt: new Date(),
        revokedAt: null,
        replacedBy: null,
      };
      mockRefreshTokenRepo.findByHash.mockResolvedValue(mockRecord);
      mockRepo.findById.mockResolvedValue(baseUser());
      mockJwt.signToken.mockReturnValue('new-fake-jwt-token');
      mockJwt.generateRefreshToken.mockReturnValue('new-fake-refresh-token');

      const result = await userService.refresh('old-token');

      expect(mockRefreshTokenRepo.findByHash).toHaveBeenCalledWith('hashed-old-token');
      expect(mockRefreshTokenRepo.rotate).toHaveBeenCalledWith('rt1', expect.objectContaining({
        userId: 'u1',
        tokenHash: 'hashed-new-fake-refresh-token',
      }));
      expect(result.token).toBe('new-fake-jwt-token');
      expect(result.refreshToken).toBe('new-fake-refresh-token');
    });

    it('rejects invalid or non-existent refresh token', async () => {
      mockRefreshTokenRepo.findByHash.mockResolvedValue(null);
      await expect(userService.refresh('invalid-token')).rejects.toThrow(ValidationError);
    });

    it('detects token reuse and revokes all user tokens', async () => {
      const mockRecord = {
        tokenId: 'rt1',
        userId: 'u1',
        tokenHash: 'hashed-old-token',
        expiresAt: new Date(Date.now() + 100000),
        createdAt: new Date(),
        revokedAt: new Date(),
        replacedBy: 'rt2',
      };
      mockRefreshTokenRepo.findByHash.mockResolvedValue(mockRecord);

      await expect(userService.refresh('old-token')).rejects.toThrow(ValidationError);
      expect(mockRefreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith('u1');
    });

    it('rejects a revoked token without revoking other tokens if it was not replaced (manual logout)', async () => {
      const mockRecord = {
        tokenId: 'rt1',
        userId: 'u1',
        tokenHash: 'hashed-old-token',
        expiresAt: new Date(Date.now() + 100000),
        createdAt: new Date(),
        revokedAt: new Date(),
        replacedBy: null,
      };
      mockRefreshTokenRepo.findByHash.mockResolvedValue(mockRecord);

      await expect(userService.refresh('old-token')).rejects.toThrow(ValidationError);
      expect(mockRefreshTokenRepo.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('rejects expired refresh token', async () => {
      const mockRecord = {
        tokenId: 'rt1',
        userId: 'u1',
        tokenHash: 'hashed-old-token',
        expiresAt: new Date(Date.now() - 100000),
        createdAt: new Date(),
        revokedAt: null,
        replacedBy: null,
      };
      mockRefreshTokenRepo.findByHash.mockResolvedValue(mockRecord);

      await expect(userService.refresh('old-token')).rejects.toThrow(ValidationError);
    });

    it('successfully revokes token on logout', async () => {
      const mockRecord = {
        tokenId: 'rt1',
        userId: 'u1',
        tokenHash: 'hashed-token',
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
        replacedBy: null,
      };
      mockRefreshTokenRepo.findByHash.mockResolvedValue(mockRecord);

      await userService.revokeToken('some-token');

      expect(mockRefreshTokenRepo.revoke).toHaveBeenCalledWith('rt1');
    });

    it('sets new refresh token expiration according to JWT_REFRESH_EXPIRES_IN_DAYS (sliding window)', async () => {
      const originalEnv = process.env.JWT_REFRESH_EXPIRES_IN_DAYS;
      process.env.JWT_REFRESH_EXPIRES_IN_DAYS = '14';
      try {
        const mockRecord = {
          tokenId: 'rt1',
          userId: 'u1',
          tokenHash: 'hashed-old-token',
          expiresAt: new Date(Date.now() + 100000),
          createdAt: new Date(),
          revokedAt: null,
          replacedBy: null,
        };
        mockRefreshTokenRepo.findByHash.mockResolvedValue(mockRecord);
        mockRepo.findById.mockResolvedValue(baseUser());
        mockJwt.signToken.mockReturnValue('new-fake-jwt-token');
        mockJwt.generateRefreshToken.mockReturnValue('new-fake-refresh-token');

        const now = Date.now();
        await userService.refresh('old-token');

        expect(mockRefreshTokenRepo.rotate).toHaveBeenCalledWith(
          'rt1',
          expect.objectContaining({
            userId: 'u1',
            expiresAt: expect.any(Date),
          })
        );
        const rotateCall = mockRefreshTokenRepo.rotate.mock.calls[mockRefreshTokenRepo.rotate.mock.calls.length - 1][1];
        const expectedTime = now + 14 * 24 * 60 * 60 * 1000;
        expect(Math.abs(rotateCall.expiresAt.getTime() - expectedTime)).toBeLessThan(5000);
      } finally {
        process.env.JWT_REFRESH_EXPIRES_IN_DAYS = originalEnv;
      }
    });
  });
});
