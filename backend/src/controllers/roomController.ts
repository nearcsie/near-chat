import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../errors/AppError';
import type { Room, RoomMember } from '../../../shared/types';
import type { UpdateRoomInput } from '../validators/roomSchemas';

interface RoomService {
  list(userId: string): Promise<Room[]>;
  create(creatorId: string, data: { type: 'group'; name: string; requireApproval?: boolean; viewHistory?: boolean }): Promise<Room>;
  getById(roomId: string, callerId: string): Promise<Room>;
  listMembers(roomId: string, callerId: string): Promise<RoomMember[]>;
  update(roomId: string, callerId: string, data: UpdateRoomInput): Promise<Room>;
  joinByCode(userId: string, inviteCode: string): Promise<Room>;
  leave(userId: string, roomId: string): Promise<void>;
  approveMember(roomId: string, callerId: string, targetUserId: string): Promise<void>;
  updateMember(roomId: string, callerId: string, targetUserId: string, data: { role?: string; nickname?: string; isMuted?: boolean }): Promise<void>;
  kickMember(roomId: string, callerId: string, targetUserId: string): Promise<void>;
}

export const makeRoomController = (service: RoomService) => ({
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rooms = await service.list(req.user!.userId);
      res.status(200).json(rooms);
    } catch (err) {
      next(err);
    }
  },

  async createGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, avatarUrl, requireApproval, viewHistory } = req.body;
      if (!name || !name.trim()) {
        return next(new ValidationError('Room name cannot be empty'));
      }
      const room = await service.create(req.user!.userId, { type: 'group', name, requireApproval, viewHistory });
      res.status(201).json(room);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const room = await service.getById(req.params.id, req.user!.userId);
      res.status(200).json(room);
    } catch (err) {
      next(err);
    }
  },

  async listMembers(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const members = await service.listMembers(req.params.id, req.user!.userId);
      res.status(200).json(members);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const room = await service.update(req.params.id, req.user!.userId, req.body);
      res.status(200).json(room);
    } catch (err) {
      next(err);
    }
  },

  async joinByCode(req: Request<{ code: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const room = await service.joinByCode(req.user!.userId, req.params.code);
      res.status(200).json(room);
    } catch (err) {
      next(err);
    }
  },

  async leave(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.leave(req.user!.userId, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async approveMember(req: Request<{ id: string; userId: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.approveMember(req.params.id, req.user!.userId, req.params.userId);
      res.status(200).json({ message: 'Member approved' });
    } catch (err) {
      next(err);
    }
  },

  async updateMember(req: Request<{ id: string; userId: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.updateMember(req.params.id, req.user!.userId, req.params.userId, req.body);
      res.status(200).json({ message: 'Member updated' });
    } catch (err) {
      next(err);
    }
  },

  async kickMember(req: Request<{ id: string; userId: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.kickMember(req.params.id, req.user!.userId, req.params.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
});
