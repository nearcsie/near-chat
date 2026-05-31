import { Request, Response, NextFunction } from 'express';
import { updateMeSchema, searchQuerySchema, addEmergencyContactSchema } from '../validators/userSchemas';
import { ValidationError } from '../errors/AppError';
import type { PublicUser } from '../../../shared/types';

interface UserService {
  getMe(userId: string): Promise<PublicUser>;
  updateMe(userId: string, data: unknown): Promise<PublicUser>;
  search(query: string): Promise<PublicUser[]>;
  getEmergencyContacts(userId: string): Promise<any>;
  upsertEmergencyContact(userId: string, contactId: string, message: string): Promise<{ contact: any, isUpdate: boolean }>;
  deleteEmergencyContact(userId: string, contactId: string): Promise<void>;
  triggerEmergencyAlert(userId: string, message?: string): Promise<any>;
  checkInactivity(userId: string, now?: Date): Promise<any>;
}

export const makeUserController = (service: UserService) => ({
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const user = await service.getMe(userId);
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  },

  async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateMeSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid payload'));
      }
      const userId = req.user!.userId;
      const updated = await service.updateMe(userId, parsed.data);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  },

  
  async getEmergencyContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const contacts = await service.getEmergencyContacts(userId);
      res.status(200).json(contacts);
    } catch (err) {
      next(err);
    }
  },

  async addEmergencyContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = addEmergencyContactSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid payload'));
      }
      const userId = req.user!.userId;
      const { contact, isUpdate } = await service.upsertEmergencyContact(userId, parsed.data.contactId, parsed.data.message);
      res.status(isUpdate ? 200 : 201).json(contact);
    } catch (err) {
      next(err);
    }
  },

  async deleteEmergencyContact(req: Request<{ contactId: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const contactId = req.params.contactId;
      await service.deleteEmergencyContact(userId, contactId);
      res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async triggerEmergencyAlert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const message = typeof req.body?.message === 'string' && req.body.message.trim()
        ? req.body.message.trim()
        : undefined;
      const result = await service.triggerEmergencyAlert(userId, message);
      res.status(202).json(result);
    } catch (err) {
      next(err);
    }
  },

  async checkEmergencyInactivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const now = typeof req.body?.now === 'string' ? new Date(req.body.now) : undefined;
      if (now && Number.isNaN(now.getTime())) {
        return next(new ValidationError('now must be a valid ISO datetime'));
      }
      const result = await service.checkInactivity(userId, now);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = searchQuerySchema.safeParse({ query: req.query.query });
      if (!parsed.success) {
        return next(new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid query'));
      }
      const users = await service.search(parsed.data.query);
      res.status(200).json(users);
    } catch (err) {
      next(err);
    }
  },
});
