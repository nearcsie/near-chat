import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeAuthController } from '../../../src/controllers/authController';
import { ValidationError } from '../../../src/errors/AppError';
import type { Request, Response, NextFunction } from 'express';

const mockRes = () => {
  const res = { status: vi.fn(), json: vi.fn(), send: vi.fn(), cookie: vi.fn(), clearCookie: vi.fn() } as any;
  res.status.mockReturnValue(res);
  return res;
};

describe('authController', () => {
  const authResult = { token: 'tok', user: { userId: 'u1', email: 'alice@example.com', name: 'Alice' } };
  const service = { register: vi.fn(), login: vi.fn() };
  const ctrl = makeAuthController(service);

  beforeEach(() => vi.clearAllMocks());

  describe('register', () => {
    it('returns 201 on valid input', async () => {
      service.register.mockResolvedValue(authResult);
      const req = { body: { email: 'alice@example.com', name: 'Alice', password: 'password123' } } as Request;
      const res = mockRes();
      const next = vi.fn();

      await ctrl.register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.cookie).toHaveBeenCalledWith(
        'auth_token',
        'tok',
        expect.objectContaining({ httpOnly: true, secure: false, sameSite: 'strict' }),
      );
      expect(res.json).toHaveBeenCalledWith(authResult);
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next with ValidationError on invalid body', async () => {
      const req = { body: { email: 'not-an-email', name: 'Alice', password: 'short' } } as Request;
      const res = mockRes();
      const next = vi.fn();

      await ctrl.register(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next with error when service throws', async () => {
      const err = new Error('conflict');
      service.register.mockRejectedValue(err);
      const req = { body: { email: 'alice@example.com', name: 'Alice', password: 'password123' } } as Request;
      const res = mockRes();
      const next = vi.fn();

      await ctrl.register(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('login', () => {
    it('returns 200 on valid input', async () => {
      service.login.mockResolvedValue(authResult);
      const req = { body: { email: 'alice@example.com', password: 'password123' } } as Request;
      const res = mockRes();
      const next = vi.fn();

      await ctrl.login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.cookie).toHaveBeenCalledWith(
        'auth_token',
        'tok',
        expect.objectContaining({ httpOnly: true, secure: false, sameSite: 'strict' }),
      );
      expect(res.json).toHaveBeenCalledWith(authResult);
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next with ValidationError on missing fields', async () => {
      const req = { body: {} } as Request;
      const res = mockRes();
      const next = vi.fn();

      await ctrl.login(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('calls next with error when service throws', async () => {
      const err = new Error('unauthorized');
      service.login.mockRejectedValue(err);
      const req = { body: { email: 'alice@example.com', password: 'password123' } } as Request;
      const res = mockRes();
      const next = vi.fn();

      await ctrl.login(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('logout', () => {
    it('returns 204', () => {
      const req = {} as Request;
      const res = mockRes();

      ctrl.logout(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith(
        'auth_token',
        expect.objectContaining({ httpOnly: true, secure: false, sameSite: 'strict' }),
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });
});
