import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeRoomController } from '../../../src/controllers/roomController';
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

describe('roomController', () => {
  const room = {
    roomId: 'room-1',
    type: 'group',
    name: 'Study Room',
    requireApproval: false,
    viewHistory: true,
    isArchived: false,
    createdAt: new Date('2026-01-01'),
  };

  const service = {
    list: vi.fn(),
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    joinByCode: vi.fn(),
    leave: vi.fn(),
  };
  const ctrl = makeRoomController(service);

  beforeEach(() => vi.clearAllMocks());

  describe('list', () => {
    it('returns 200 with rooms', async () => {
      service.list.mockResolvedValue([room]);
      const res = mockRes();
      const next = vi.fn();

      await ctrl.list(authedReq(), res, next);

      expect(service.list).toHaveBeenCalledWith('user-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([room]);
    });

    it('calls next with error when service throws', async () => {
      service.list.mockRejectedValue(new Error('db error'));
      const res = mockRes();
      const next = vi.fn();

      await ctrl.list(authedReq(), res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('createGroup', () => {
    it('returns 201 with room on valid name', async () => {
      service.create.mockResolvedValue(room);
      const res = mockRes();
      const next = vi.fn();

      await ctrl.createGroup(authedReq({ body: { name: 'Study Room' } }), res, next);

      expect(service.create).toHaveBeenCalledWith('user-1', { type: 'group', name: 'Study Room' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(room);
    });

    it('calls next with ValidationError when name is empty', async () => {
      const res = mockRes();
      const next = vi.fn();

      await ctrl.createGroup(authedReq({ body: { name: '   ' } }), res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next with ValidationError when name is missing', async () => {
      const res = mockRes();
      const next = vi.fn();

      await ctrl.createGroup(authedReq({ body: {} }), res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('calls next with error when service throws', async () => {
      service.create.mockRejectedValue(new Error('db error'));
      const res = mockRes();
      const next = vi.fn();

      await ctrl.createGroup(authedReq({ body: { name: 'Study Room' } }), res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getById', () => {
    it('returns 200 with room', async () => {
      service.getById.mockResolvedValue(room);
      const res = mockRes();
      const next = vi.fn();

      await ctrl.getById(authedReq({ params: { id: 'room-1' } }), res, next);

      expect(service.getById).toHaveBeenCalledWith('room-1', 'user-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(room);
    });

    it('calls next with error when service throws', async () => {
      service.getById.mockRejectedValue(new Error('not found'));
      const res = mockRes();
      const next = vi.fn();

      await ctrl.getById(authedReq({ params: { id: 'room-1' } }), res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('update', () => {
    it('returns 200 with updated room', async () => {
      const updated = { ...room, name: 'New Name' };
      service.update.mockResolvedValue(updated);
      const res = mockRes();
      const next = vi.fn();

      await ctrl.update(authedReq({ params: { id: 'room-1' }, body: { name: 'New Name' } }), res, next);

      expect(service.update).toHaveBeenCalledWith('room-1', 'user-1', { name: 'New Name' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updated);
    });

    it('calls next with error when service throws', async () => {
      service.update.mockRejectedValue(new Error('forbidden'));
      const res = mockRes();
      const next = vi.fn();

      await ctrl.update(authedReq({ params: { id: 'room-1' }, body: { name: 'X' } }), res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('joinByCode', () => {
    it('returns 200 with room', async () => {
      service.joinByCode.mockResolvedValue(room);
      const res = mockRes();
      const next = vi.fn();

      await ctrl.joinByCode(authedReq({ params: { code: 'ABC123' } }), res, next);

      expect(service.joinByCode).toHaveBeenCalledWith('user-1', 'ABC123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(room);
    });

    it('calls next with error when service throws', async () => {
      service.joinByCode.mockRejectedValue(new Error('invalid code'));
      const res = mockRes();
      const next = vi.fn();

      await ctrl.joinByCode(authedReq({ params: { code: 'BAD' } }), res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('leave', () => {
    it('returns 204', async () => {
      service.leave.mockResolvedValue(undefined);
      const res = mockRes();
      const next = vi.fn();

      await ctrl.leave(authedReq({ params: { id: 'room-1' } }), res, next);

      expect(service.leave).toHaveBeenCalledWith('user-1', 'room-1');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('calls next with error when service throws', async () => {
      service.leave.mockRejectedValue(new Error('forbidden'));
      const res = mockRes();
      const next = vi.fn();

      await ctrl.leave(authedReq({ params: { id: 'room-1' } }), res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
