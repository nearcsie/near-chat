import type { Response } from 'express';
import { parsePositiveInt } from '../utils/parsePositiveInt';

export const AUTH_COOKIE_NAME = 'auth_token';
export const REFRESH_COOKIE_NAME = 'refresh_token';

const getAuthCookieMaxAgeMs = (): number =>
  parsePositiveInt(process.env.AUTH_COOKIE_MAX_AGE_MS, 7 * 24 * 60 * 60 * 1000);

const getRefreshCookieMaxAgeMs = (): number =>
  parsePositiveInt(process.env.REFRESH_COOKIE_MAX_AGE_MS, 7 * 24 * 60 * 60 * 1000);

const authCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test',
  sameSite: 'strict' as const,
  path: '/',
});

export const setAuthCookie = (res: Response, token: string): void => {
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...authCookieOptions(),
    maxAge: getAuthCookieMaxAgeMs(),
  });
};

export const clearAuthCookie = (res: Response): void => {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());
};

export const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...authCookieOptions(),
    maxAge: getRefreshCookieMaxAgeMs(),
  });
};

export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, authCookieOptions());
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

