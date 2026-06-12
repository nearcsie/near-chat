import { describe, it, expect, vi } from 'vitest';
import type { Response } from 'express';
import {
  AUTH_COOKIE_NAME,
  setAuthCookie,
  clearAuthCookie,
  readCookie,
} from '../../../src/auth/cookies';

const makeRes = () =>
  ({ cookie: vi.fn(), clearCookie: vi.fn() }) as unknown as Response;

describe('cookies', () => {
  describe('setAuthCookie', () => {
    it('sets the auth cookie with httpOnly and strict sameSite', () => {
      const res = makeRes();
      setAuthCookie(res, 'token-123');
      expect(res.cookie).toHaveBeenCalledWith(
        AUTH_COOKIE_NAME,
        'token-123',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
          maxAge: expect.any(Number),
        })
      );
    });
  });

  describe('clearAuthCookie', () => {
    it('clears the auth cookie with matching options', () => {
      const res = makeRes();
      clearAuthCookie(res);
      expect(res.clearCookie).toHaveBeenCalledWith(
        AUTH_COOKIE_NAME,
        expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/' })
      );
    });
  });

  describe('readCookie', () => {
    it('returns undefined when the header is missing', () => {
      expect(readCookie(undefined, 'auth_token')).toBeUndefined();
    });

    it('reads a cookie value from the header', () => {
      expect(readCookie('auth_token=abc; other=1', 'auth_token')).toBe('abc');
    });

    it('preserves "=" characters inside the value', () => {
      expect(readCookie('auth_token=a=b=c', 'auth_token')).toBe('a=b=c');
    });

    it('decodes URI-encoded values', () => {
      expect(readCookie('auth_token=a%20b', 'auth_token')).toBe('a b');
    });

    it('returns undefined when the cookie is not present', () => {
      expect(readCookie('other=1; another=2', 'auth_token')).toBeUndefined();
    });

    it('returns undefined for a cookie with no value', () => {
      expect(readCookie('auth_token', 'auth_token')).toBeUndefined();
    });
  });
});
