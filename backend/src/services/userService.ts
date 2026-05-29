import bcrypt from 'bcryptjs';
import type { IUserRepository } from '../repositories/IUserRepository';
import type { RegisterRequest, LoginRequest, AuthResponse, PublicUser, JwtPayload } from '../../../shared/types';
import { ConflictError, ValidationError } from '../errors/AppError';

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
    }
  };
};
