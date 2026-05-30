import bcrypt from 'bcryptjs';
import type { IUserRepository } from '../repositories/IUserRepository';
import type { IEmergencyContactRepository, EmergencyContact } from '../repositories/IEmergencyContactRepository';
import type { RegisterRequest, LoginRequest, AuthResponse, PublicUser, JwtPayload } from '../../../shared/types';
import { ConflictError, NotFoundError, ValidationError } from '../errors/AppError';
import { updateMeSchema, searchQuerySchema, type UpdateMeInput } from '../validators/userSchemas';

export interface JwtHelper {
  signToken(payload: JwtPayload): string;
}

export interface EmergencyAlertResult {
  alerted: boolean;
  recipients: string[];
  reason?: string;
}

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

      const publicUser: PublicUser = {
        userId: user.userId,
        name: user.name,
        avatarUrl: user.avatarUrl
      };

      const token = jwt.signToken({
        userId: user.userId,
        name: user.name
      });

      return {
        token,
        user: publicUser
      };
    },

    async login(data: LoginRequest): Promise<AuthResponse> {
      const user = await repo.findByEmail(data.email);
      if (!user) {
        throw new ValidationError('Invalid email or password');
      }

      const isMatch = await bcrypt.compare(data.password, user.passwordHash);
      if (!isMatch) {
        throw new ValidationError('Invalid email or password');
      }

      await repo.update(user.userId, { lastActivity: new Date() });

      const publicUser: PublicUser = {
        userId: user.userId,
        name: user.name,
        avatarUrl: user.avatarUrl
      };

      const token = jwt.signToken({
        userId: user.userId,
        name: user.name
      });

      return {
        token,
        user: publicUser
      };
    },

    async getMe(userId: string): Promise<PublicUser> {
      const user = await repo.findById(userId);
      if (!user) throw new NotFoundError('user', userId);
      return { userId: user.userId, name: user.name, avatarUrl: user.avatarUrl };
    },

    async updateMe(userId: string, data: UpdateMeInput): Promise<PublicUser> {
      const parsed = updateMeSchema.safeParse(data);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid payload');
      }
      const updated = await repo.update(userId, parsed.data);
      return { userId: updated.userId, name: updated.name, avatarUrl: updated.avatarUrl };
    },

    
    async getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
      return await emergencyContactRepo.findByUserId(userId);
    },

    async upsertEmergencyContact(userId: string, contactId: string, message: string): Promise<EmergencyContact> {
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
      const parsed = searchQuerySchema.safeParse({ query });
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid query');
      }
      const users = await repo.search(parsed.data.query);
      return users.map((u) => ({ userId: u.userId, name: u.name, avatarUrl: u.avatarUrl }));
    },
  };
};
