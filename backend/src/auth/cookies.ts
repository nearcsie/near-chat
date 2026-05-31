import type { Response } from 'express';

export const AUTH_COOKIE_NAME = 'auth_token';

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getAuthCookieMaxAgeMs = (): number =>
  parsePositiveInt(process.env.AUTH_COOKIE_MAX_AGE_MS, 15 * 60 * 1000);

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
