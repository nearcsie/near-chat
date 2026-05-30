import { IFolderRepository } from '../repositories/folderRepository';
import type { Folder } from '../../../shared/types';
import { NotFoundError } from '../errors/AppError';

export interface FolderService {
  createFolder(userId: string, name: string): Promise<Folder>;
  getFolders(userId: string): Promise<Folder[]>;
  deleteFolder(folderId: string, userId: string): Promise<void>;
  updateFolderRooms(folderId: string, userId: string, roomIds: string[]): Promise<void>;
}

export const makeFolderService = (folderRepo: IFolderRepository): FolderService => ({
  createFolder: (userId, name) => folderRepo.create(userId, name),
  getFolders: (userId) => folderRepo.findByUserId(userId),
  deleteFolder: (folderId, userId) => folderRepo.delete(folderId, userId),
  updateFolderRooms: (folderId, userId, roomIds) => folderRepo.updateRooms(folderId, userId, roomIds),
});
