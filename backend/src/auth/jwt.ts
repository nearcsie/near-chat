import jwt from 'jsonwebtoken';
import type { JwtPayload } from '@shared/types';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is not defined in production environment.');
    }
    return 'default-dev-secret';
  }
  return secret;
};

export const signToken = (payload: JwtPayload): string => {
  const secret = getJwtSecret();
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? '15m') as jwt.SignOptions['expiresIn'];
  return jwt.sign(payload, secret, { expiresIn });
};

export const verifyToken = (token: string): JwtPayload => {
  const secret = getJwtSecret();
  return jwt.verify(token, secret) as JwtPayload;
};
