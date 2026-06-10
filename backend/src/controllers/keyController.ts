import { Request, Response, NextFunction } from 'express';
import type { RoomKeyMemberStatus } from '@shared/types';

interface KeyService {
  setMyPublicKey(userId: string, publicKey: string): Promise<{ userId: string; publicKey: string }>;
  getPublicKey(userId: string): Promise<{ userId: string; publicKey: string | null }>;
  getMyRoomKey(
    userId: string,
    roomId: string,
  ): Promise<{ roomId: string; userId: string; encryptedKey: string }>;
  listRoomKeyStatus(userId: string, roomId: string): Promise<RoomKeyMemberStatus[]>;
  distributeRoomKeys(
    userId: string,
    roomId: string,
    keys: { userId: string; encryptedKey: string }[],
  ): Promise<{ distributed: string[] }>;
}

export const makeKeyController = (service: KeyService) => ({
  async setMyPublicKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await service.setMyPublicKey(req.user!.userId, req.body?.publicKey);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async getPublicKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await service.getPublicKey(req.params.id as string);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async getMyRoomKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await service.getMyRoomKey(req.user!.userId, req.params.id as string);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async listRoomKeyStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await service.listRoomKeyStatus(req.user!.userId, req.params.id as string);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async distributeRoomKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await service.distributeRoomKeys(
        req.user!.userId,
        req.params.id as string,
        req.body?.keys ?? [],
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
});
