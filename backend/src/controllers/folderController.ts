import { Request, Response, NextFunction } from 'express';
import { createFolderSchema, updateFolderRoomsSchema } from '../validators/folderSchemas';
import { ValidationError } from '../errors/AppError';
import { FolderService } from '../services/folderService';

export const makeFolderController = (service: FolderService) => ({
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createFolderSchema.safeParse(req.body);
      if (!parsed.success) return next(new ValidationError('Invalid folder data'));
      const folder = await service.createFolder(req.user!.userId, parsed.data.name);
      res.status(201).json(folder);
    } catch (err) { next(err); }
  },
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const folders = await service.getFolders(req.user!.userId);
      res.status(200).json(folders);
    } catch (err) { next(err); }
  },
  async remove(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.deleteFolder(req.params.id, req.user!.userId);
      res.status(204).send();
    } catch (err) { next(err); }
  },
  async updateRooms(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateFolderRoomsSchema.safeParse(req.body);
      if (!parsed.success) return next(new ValidationError('Invalid roomIds'));
      await service.updateFolderRooms(req.params.id, req.user!.userId, parsed.data.roomIds);
      res.status(200).json({ success: true });
    } catch (err) { next(err); }
  }
});
