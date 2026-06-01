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
  User,
  UserProfile,
  UserSettings,
} from '../../../shared/types';
import { ConflictError, NotFoundError, ValidationError } from '../errors/AppError';
import {
  updateMeSchema,
  updateSettingsSchema,
  searchQuerySchema,
  type UpdateMeInput,
  type UpdateSettingsInput,
} from '../validators/userSchemas';

interface JwtHelper {
  signToken(payload: JwtPayload): string;
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
  user: Pick<User, 'warningEnabled' | 'warningDays' | 'language'>,
): UserSettings => ({
  warningEnabled: user.warningEnabled,
  warningDays: user.warningDays,
  language: user.language,
});

export const makeUserService = (
  repo: IUserRepository,
  emergencyContactRepo: IEmergencyContactRepository,
  jwt: JwtHelper,
  notifyEmergencyContact?: (contactId: string, payload: { userId: string; message: string }) => void,
) => {
  const notifyContacts = async (userId: string, fallbackMessage: string): Promise<EmergencyAlertResult> => {
    const user = await repo.findById(userId);
    if (!user) throw new NotFoundError('user', userId);

    const contacts = await emergencyContactRepo.findByUserId(userId);
    if (contacts.length === 0) {
      return { alerted: false, recipients: [], reason: 'NO_CONTACTS' };
    }

    const recipients: string[] = [];
    for (const contact of contacts) {
      notifyEmergencyContact?.(contact.contactId, {
        userId,
        message: contact.message || fallbackMessage,
      });
      recipients.push(contact.contactId);
    }

    return { alerted: true, recipients };
  };

  return {
    async register(data: RegisterRequest): Promise<AuthResponse> {
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

      return {
        token,
        user: toPublicUser(user)
      };
    },

    async login(data: LoginRequest): Promise<AuthResponse> {
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

      return {
        token,
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
      const updated = await repo.update(userId, parsed.data);
      return toMyProfile(updated);
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
      const contact = await repo.findById(contactId);
      if (!contact) throw new NotFoundError('user', contactId);
      return await emergencyContactRepo.upsert(userId, contactId, message);
    },

    async deleteEmergencyContact(userId: string, contactId: string): Promise<void> {
      await emergencyContactRepo.delete(userId, contactId);
    },

    async triggerEmergencyAlert(userId: string, message = 'Emergency alert triggered'): Promise<EmergencyAlertResult> {
      return notifyContacts(userId, message);
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

    async search(query: string): Promise<PublicUser[]> {
      const parsed = searchQuerySchema.safeParse({ q: query });
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid query');
      }
      const users = await repo.search(parsed.data.q);
      return users.map(toPublicUser);
    },
  };
};
