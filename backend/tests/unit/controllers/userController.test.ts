import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeUserController } from '../../../src/controllers/userController';
import { ValidationError } from '../../../src/errors/AppError';
import type { Request, Response, NextFunction } from 'express';

const mockRes = () => {
  const res = { status: vi.fn(), json: vi.fn(), send: vi.fn() } as any;
  res.status.mockReturnValue(res);
  return res;
};

const authedReq = (overrides: Partial<Request> = {}): any => ({
  body: {},
  params: {},
  query: {},
  user: { userId: 'user-1' },
  ...overrides,
});

describe('userController', () => {
  const publicUser = { userId: 'user-1', name: 'Alice', email: 'alice@example.com' };
  const service = { getMe: vi.fn(), updateMe: vi.fn(), search: vi.fn() };
  const ctrl = makeUserController(service);

  beforeEach(() => vi.clearAllMocks());

  describe('getMe', () => {
    it('returns 200 with user', async () => {
      service.getMe.mockResolvedValue(publicUser);
      const res = mockRes();
      const next = vi.fn();

      await ctrl.getMe(authedReq(), res, next);

      expect(service.getMe).toHaveBeenCalledWith('user-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(publicUser);
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next with error when service throws', async () => {
      const err = new Error('not found');
      service.getMe.mockRejectedValue(err);
      const res = mockRes();
      const next = vi.fn();

      await ctrl.getMe(authedReq(), res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('updateMe', () => {
    it('returns 200 with updated user on valid body', async () => {
      const updated = { ...publicUser, name: 'Bob' };
      service.updateMe.mockResolvedValue(updated);
      const res = mockRes();
      const next = vi.fn();

      await ctrl.updateMe(authedReq({ body: { name: 'Bob' } }), res, next);

      expect(service.updateMe).toHaveBeenCalledWith('user-1', { name: 'Bob' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updated);
    });

    it('calls next with ValidationError when body is empty', async () => {
      const res = mockRes();
      const next = vi.fn();

      await ctrl.updateMe(authedReq({ body: {} }), res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next with error when service throws', async () => {
      const err = new Error('db error');
      service.updateMe.mockRejectedValue(err);
      const res = mockRes();
      const next = vi.fn();

      await ctrl.updateMe(authedReq({ body: { name: 'Bob' } }), res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('search', () => {
    it('returns 200 with users on valid query', async () => {
      service.search.mockResolvedValue([publicUser]);
      const res = mockRes();
      const next = vi.fn();

      await ctrl.search(authedReq({ query: { query: 'alice' } }), res, next);

      expect(service.search).toHaveBeenCalledWith('alice');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([publicUser]);
    });

    it('calls next with ValidationError when query is missing', async () => {
      const res = mockRes();
      const next = vi.fn();

      await ctrl.search(authedReq({ query: {} }), res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('calls next with error when service throws', async () => {
      const err = new Error('db error');
      service.search.mockRejectedValue(err);
      const res = mockRes();
      const next = vi.fn();

      await ctrl.search(authedReq({ query: { query: 'alice' } }), res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
