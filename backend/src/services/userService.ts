import bcrypt from 'bcryptjs';
import type { IUserRepository } from '../repositories/IUserRepository';
import type { IEmergencyContactRepository, EmergencyContact } from '../repositories/IEmergencyContactRepository';
import type {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  JwtPayload,
  MyProfile,
  PublicUser,
  SearchUserResult,
  User,
  UserProfile,
  UserSettings,
} from '../../../shared/types';

import { ConflictError, NotFoundError, ValidationError } from '../errors/AppError';
import { removeManagedAvatar, saveAvatarUpload } from '../lib/avatarUpload';
import {
  updateMeSchema,
  updateSettingsSchema,
  searchQuerySchema,
  type UpdateMeInput,
  type UpdateSettingsInput,
} from '../validators/userSchemas';
import { getRefreshTokenTtlMs } from '../auth/refreshTokenTtl';

import type { IRefreshTokenRepository } from '../repositories/IRefreshTokenRepository';

interface JwtHelper {
  signToken(payload: JwtPayload): string;
  generateRefreshToken(): string;
  hashToken(token: string): string;
}

interface EmergencyAlertResult {
  alerted: boolean;
  recipients: string[];
  reason?: string;
}

const toPublicUser = (user: Pick<User, 'userId' | 'name' | 'avatarUrl'>): PublicUser => ({
  userId: user.userId,
  name: user.name,
  avatarUrl: user.avatarUrl,
});

const toUserProfile = (user: Pick<User, 'userId' | 'name' | 'bio' | 'avatarUrl'>): UserProfile => ({
  userId: user.userId,
  name: user.name,
  bio: user.bio,
  avatarUrl: user.avatarUrl,
});

const toMyProfile = (
  user: Pick<User, 'userId' | 'name' | 'email' | 'bio' | 'avatarUrl'>,
): MyProfile => ({
  ...toUserProfile(user),
  email: user.email,
});

const toUserSettings = (
  user: Pick<User, 'warningEnabled' | 'warningDays' | 'language' | 'theme' | 'notifyDesktop' | 'notifySound'>,
): UserSettings => ({
  warningEnabled: user.warningEnabled,
  warningDays: user.warningDays,
  language: user.language,
  theme: user.theme,
  notifyDesktop: user.notifyDesktop,
  notifySound: user.notifySound,
});

export const makeUserService = (
  repo: IUserRepository,
  emergencyContactRepo: IEmergencyContactRepository,
  refreshTokenRepo: IRefreshTokenRepository,
  jwt: JwtHelper,
  notifyEmergencyContact?: (contactId: string, payload: { userId: string; message: string }) => void | Promise<void>,
) => {
  const notifyContacts = async (userId: string, fallbackMessage: string, isTest: boolean = false): Promise<EmergencyAlertResult> => {
    const user = await repo.findById(userId);
    if (!user) throw new NotFoundError('user', userId);

    const contacts = await emergencyContactRepo.findByUserId(userId);
    if (contacts.length === 0) {
      return { alerted: false, recipients: [], reason: 'NO_CONTACTS' };
    }

    const recipients: string[] = [];
    for (const contact of contacts) {
      const msg = (isTest ? '(測試) ' : '') + (contact.message || fallbackMessage);
      if (notifyEmergencyContact) {
        await notifyEmergencyContact(contact.contactId, {
          userId,
          message: msg,
        });
      }
      recipients.push(contact.contactId);
    }

    return { alerted: true, recipients };
  };

  const issueRefreshToken = async (userId: string): Promise<string> => {
    const refreshToken = jwt.generateRefreshToken();
    await refreshTokenRepo.create({
      userId,
      tokenHash: jwt.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + getRefreshTokenTtlMs()),
    });
    return refreshToken;
  };

  return {
    async register(data: RegisterRequest): Promise<AuthResponse & { refreshToken: string }> {
      const existingUser = await repo.findByEmail(data.email);
      if (existingUser) {
        throw new ConflictError('Email already in use');
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(data.password, salt);

      const user = await repo.create({
        email: data.email,
        name: data.name,
        passwordHash
      });

      const token = jwt.signToken({
        userId: user.userId,
        name: user.name
      });

      const refreshToken = await issueRefreshToken(user.userId);

      return {
        token,
        refreshToken,
        user: toPublicUser(user)
      };
    },

    async login(data: LoginRequest): Promise<AuthResponse & { refreshToken: string }> {
      const user = await repo.findByEmail(data.email);
      if (!user || user.deletedAt) {
        throw new ValidationError('Invalid email or password');
      }

      const isMatch = await bcrypt.compare(data.password, user.passwordHash);
      if (!isMatch) {
        throw new ValidationError('Invalid email or password');
      }

      await repo.update(user.userId, { lastActivity: new Date() });

      const token = jwt.signToken({
        userId: user.userId,
        name: user.name
      });

      const refreshToken = await issueRefreshToken(user.userId);

      return {
        token,
        refreshToken,
        user: toPublicUser(user)
      };
    },

    async getMe(userId: string): Promise<MyProfile> {
      const user = await repo.findById(userId);
      if (!user) throw new NotFoundError('user', userId);
      return toMyProfile(user);
    },

    async getUserProfile(userId: string): Promise<UserProfile> {
      const user = await repo.findById(userId);
      if (!user) throw new NotFoundError('user', userId);
      return toUserProfile(user);
    },

    async updateMe(userId: string, data: UpdateMeInput): Promise<MyProfile> {
      const parsed = updateMeSchema.safeParse(data);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid payload');
      }

      const updateData: Partial<Pick<User, 'name' | 'email' | 'passwordHash' | 'bio' | 'avatarUrl'>> = {
        name: parsed.data.name,
        email: parsed.data.email,
        bio: parsed.data.bio,
        avatarUrl: parsed.data.avatarUrl,
      };

      if (parsed.data.email !== undefined) {
        const existing = await repo.findByEmail(parsed.data.email);
        if (existing && existing.userId !== userId) {
          throw new ConflictError('Email already in use');
        }
      }

      if (parsed.data.password !== undefined) {
        const salt = await bcrypt.genSalt(10);
        updateData.passwordHash = await bcrypt.hash(parsed.data.password, salt);
      }

      const updated = await repo.update(userId, updateData);
      return toMyProfile(updated);
    },

    async uploadAvatar(userId: string, file: Express.Multer.File): Promise<MyProfile> {
      const currentUser = await repo.findById(userId);
      if (!currentUser) {
        throw new NotFoundError('user', userId);
      }

      const avatarUrl = await saveAvatarUpload(userId, file);

      try {
        const updated = await repo.update(userId, { avatarUrl });
        if (currentUser.avatarUrl && currentUser.avatarUrl !== avatarUrl) {
          await removeManagedAvatar(currentUser.avatarUrl);
        }
        return toMyProfile(updated);
      } catch (error) {
        await removeManagedAvatar(avatarUrl);
        throw error;
      }
    },

    async getMySettings(userId: string): Promise<UserSettings> {
      const user = await repo.findById(userId);
      if (!user) throw new NotFoundError('user', userId);
      return toUserSettings(user);
    },

    async updateMySettings(userId: string, data: UpdateSettingsInput): Promise<UserSettings> {
      const parsed = updateSettingsSchema.safeParse(data);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid payload');
      }

      const current = await repo.findById(userId);
      if (!current) throw new NotFoundError('user', userId);

      const nextWarningEnabled = parsed.data.warningEnabled ?? current.warningEnabled;
      const nextWarningDays = parsed.data.warningDays ?? current.warningDays;
      if (nextWarningEnabled && nextWarningDays < 1) {
        throw new ValidationError('warningDays must be at least 1 when warnings are enabled');
      }

      const updated = await repo.update(userId, parsed.data);
      return toUserSettings(updated);
    },

    async deleteMe(userId: string): Promise<void> {
      await repo.update(userId, { deletedAt: new Date() } as any);
    },

    
    async getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
      return await emergencyContactRepo.findByUserId(userId);
    },

    async upsertEmergencyContact(userId: string, contactId: string, message: string): Promise<{ contact: EmergencyContact, isUpdate: boolean }> {
      if (userId === contactId) {
        throw new ValidationError('Cannot add yourself as an emergency contact');
      }
      const contact = await repo.findById(contactId);
      if (!contact) throw new NotFoundError('user', contactId);
      return await emergencyContactRepo.upsert(userId, contactId, message);
    },

    async deleteEmergencyContact(userId: string, contactId: string): Promise<void> {
      await emergencyContactRepo.delete(userId, contactId);
    },

    async triggerEmergencyAlert(userId: string, message = 'Emergency alert triggered'): Promise<EmergencyAlertResult> {
      return notifyContacts(userId, message, true);
    },

    async checkInactivity(userId: string, now = new Date()): Promise<EmergencyAlertResult> {
      const user = await repo.findById(userId);
      if (!user) throw new NotFoundError('user', userId);

      if (!user.warningEnabled) {
        return { alerted: false, recipients: [], reason: 'WARNING_DISABLED' };
      }
      if (user.warningDays < 1) {
        return { alerted: false, recipients: [], reason: 'INVALID_THRESHOLD' };
      }

      const inactiveMs = now.getTime() - user.lastActivity.getTime();
      const thresholdMs = user.warningDays * 24 * 60 * 60 * 1000;
      if (inactiveMs < thresholdMs) {
        return { alerted: false, recipients: [], reason: 'BELOW_THRESHOLD' };
      }

      const shouldAlert = await emergencyContactRepo.recordAlertIfNew(userId, user.lastActivity);
      if (!shouldAlert) {
        return { alerted: false, recipients: [], reason: 'ALREADY_ALERTED' };
      }

      return notifyContacts(userId, 'User has exceeded their inactivity warning threshold');
    },

    async search(query: string, mode?: 'name' | 'userId' | 'email'): Promise<SearchUserResult[]> {
      const parsed = searchQuerySchema.safeParse({ q: query, mode });
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid query');
      }
      const users = await repo.search(parsed.data.q, parsed.data.mode);
      return users.map((user) => ({
        userId: user.userId,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      }));
    },

    async refresh(refreshToken: string): Promise<AuthResponse & { refreshToken: string }> {
      const tokenHash = jwt.hashToken(refreshToken);
      const tokenRecord = await refreshTokenRepo.findByHash(tokenHash);
      if (!tokenRecord) {
        throw new ValidationError('Invalid refresh token');
      }

      if (tokenRecord.revokedAt) {
        if (tokenRecord.replacedBy) {
          await refreshTokenRepo.revokeAllForUser(tokenRecord.userId);
          throw new ValidationError('Refresh token has been reused and revoked');
        }
        throw new ValidationError('Refresh token has been revoked');
      }

      if (new Date() > new Date(tokenRecord.expiresAt)) {
        throw new ValidationError('Refresh token expired');
      }

      const user = await repo.findById(tokenRecord.userId);
      if (!user || user.deletedAt) {
        throw new ValidationError('User not found or deleted');
      }

      const newAccessToken = jwt.signToken({
        userId: user.userId,
        name: user.name,
      });
      const newRefreshToken = jwt.generateRefreshToken();

      await refreshTokenRepo.rotate(tokenRecord.tokenId, {
        userId: user.userId,
        tokenHash: jwt.hashToken(newRefreshToken),
        expiresAt: new Date(Date.now() + getRefreshTokenTtlMs()),
      });

      return {
        token: newAccessToken,
        refreshToken: newRefreshToken,
        user: toPublicUser(user),
      };
    },

    async revokeToken(refreshToken: string): Promise<void> {
      const tokenHash = jwt.hashToken(refreshToken);
      const tokenRecord = await refreshTokenRepo.findByHash(tokenHash);
      if (tokenRecord) {
        await refreshTokenRepo.revoke(tokenRecord.tokenId);
      }
    },
  };
};
