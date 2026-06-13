import type { Response } from 'express';
import { parsePositiveInt } from '../utils/parsePositiveInt';
import { getRefreshTokenTtlMs } from './refreshTokenTtl';

export const AUTH_COOKIE_NAME = 'auth_token';
export const REFRESH_COOKIE_NAME = 'refresh_token';

// Cookie lifetime must match the DB-side refresh token TTL, otherwise the
// browser drops the cookie while the token row is still valid.
const getRefreshCookieMaxAgeMs = (): number =>
  parsePositiveInt(process.env.REFRESH_COOKIE_MAX_AGE_MS, getRefreshTokenTtlMs());

const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test',
  sameSite: 'strict' as const,
  path: '/',
});

export const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...refreshCookieOptions(),
    maxAge: getRefreshCookieMaxAgeMs(),
  });
};

export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
};

export const readCookie = (cookieHeader: string | undefined, name: string): string | undefined => {
  if (!cookieHeader) return undefined;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [rawKey, ...rawValue] = pair.trim().split('=');
    if (rawKey === name && rawValue.length > 0) {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return undefined;
};
