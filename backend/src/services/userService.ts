import bcrypt from 'bcryptjs';
import type { IUserRepository } from '../repositories/IUserRepository';
import type { RegisterRequest, LoginRequest, AuthResponse, PublicUser, JwtPayload } from '../../../shared/types';
import { ConflictError, NotFoundError, ValidationError } from '../errors/AppError';
import { updateMeSchema, searchQuerySchema, type UpdateMeInput } from '../validators/userSchemas';

export interface JwtHelper {
  signToken(payload: JwtPayload): string;
}

export const makeUserService = (repo: IUserRepository, jwt: JwtHelper) => {
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
