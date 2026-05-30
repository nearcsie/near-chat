const fs = require('fs');

fs.writeFileSync('backend/src/validators/folderSchemas.ts', `import { z } from 'zod';

export const createFolderSchema = z.object({
  name: z.string().min(1).max(50),
});

export const updateFolderRoomsSchema = z.object({
  roomIds: z.array(z.string().uuid()),
});
`);

fs.writeFileSync('backend/src/repositories/folderRepository.ts', `import { Pool } from 'pg';
import type { Folder } from '../../../shared/types';

export interface IFolderRepository {
  create(userId: string, name: string): Promise<Folder>;
  findByUserId(userId: string): Promise<Folder[]>;
  delete(folderId: string, userId: string): Promise<void>;
  updateRooms(folderId: string, userId: string, roomIds: string[]): Promise<void>;
}

export class FolderRepository implements IFolderRepository {
  constructor(private db: Pool) {}

  async create(userId: string, name: string): Promise<Folder> {
    const res = await this.db.query(
      \`INSERT INTO folders (user_id, name) VALUES ($1, $2) RETURNING *\`,
      [userId, name]
    );
    return {
      folderId: res.rows[0].folder_id,
      userId: res.rows[0].user_id,
      name: res.rows[0].name,
      createdAt: res.rows[0].created_at,
      roomIds: [],
    };
  }

  async findByUserId(userId: string): Promise<Folder[]> {
    const res = await this.db.query(
      \`SELECT f.*, COALESCE(json_agg(fr.room_id) FILTER (WHERE fr.room_id IS NOT NULL), '[]') as room_ids
       FROM folders f
       LEFT JOIN folder_rooms fr ON f.folder_id = fr.folder_id
       WHERE f.user_id = $1
       GROUP BY f.folder_id
       ORDER BY f.created_at ASC\`,
      [userId]
    );
    return res.rows.map(row => ({
      folderId: row.folder_id,
      userId: row.user_id,
      name: row.name,
      createdAt: row.created_at,
      roomIds: row.room_ids,
    }));
  }

  async delete(folderId: string, userId: string): Promise<void> {
    await this.db.query(
      \`DELETE FROM folders WHERE folder_id = $1 AND user_id = $2\`,
      [folderId, userId]
    );
  }

  async updateRooms(folderId: string, userId: string, roomIds: string[]): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      
      const checkRes = await client.query('SELECT 1 FROM folders WHERE folder_id = $1 AND user_id = $2', [folderId, userId]);
      if (checkRes.rowCount === 0) {
          throw new Error('Folder not found');
      }

      await client.query(\`DELETE FROM folder_rooms WHERE folder_id = $1\`, [folderId]);
      
      if (roomIds.length > 0) {
        const values = roomIds.map((_, i) => \`($1, $\${i + 2}, $\${roomIds.length + 2})\`).join(', ');
        const params = [folderId, ...roomIds, userId];
        await client.query(\`INSERT INTO folder_rooms (folder_id, room_id, user_id) VALUES \${values}\`, params);
      }
      
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
`);

fs.writeFileSync('backend/src/services/folderService.ts', `import { IFolderRepository } from '../repositories/folderRepository';
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
`);

fs.writeFileSync('backend/src/controllers/folderController.ts', `import { Request, Response, NextFunction } from 'express';
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
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.deleteFolder(req.params.id, req.user!.userId);
      res.status(204).send();
    } catch (err) { next(err); }
  },
  async updateRooms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateFolderRoomsSchema.safeParse(req.body);
      if (!parsed.success) return next(new ValidationError('Invalid roomIds'));
      await service.updateFolderRooms(req.params.id, req.user!.userId, parsed.data.roomIds);
      res.status(200).json({ success: true });
    } catch (err) { next(err); }
  }
});
`);

fs.writeFileSync('backend/src/routes/folderRoutes.ts', `import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import type { makeFolderController } from '../controllers/folderController';

export const makeFolderRoutes = (ctrl: ReturnType<typeof makeFolderController>): Router => {
  const router = Router();
  router.use(authMiddleware);
  router.get('/', ctrl.list.bind(ctrl));
  router.post('/', ctrl.create.bind(ctrl));
  router.delete('/:id', ctrl.remove.bind(ctrl));
  router.put('/:id/rooms', ctrl.updateRooms.bind(ctrl));
  return router;
};
`);

// update index.ts
let index = fs.readFileSync('backend/src/index.ts', 'utf8');
index = index.replace(
  'import { MessageRepository } from "./repositories/messageRepository";',
  'import { MessageRepository } from "./repositories/messageRepository";\nimport { FolderRepository } from "./repositories/folderRepository";'
);
index = index.replace(
  'import { makeMessageService } from "./services/messageService";',
  'import { makeMessageService } from "./services/messageService";\nimport { makeFolderService } from "./services/folderService";'
);
index = index.replace(
  'import { makeMessageController } from "./controllers/messageController";',
  'import { makeMessageController } from "./controllers/messageController";\nimport { makeFolderController } from "./controllers/folderController";'
);
index = index.replace(
  'import { makeMessageRoutes } from "./routes/messageRoutes";',
  'import { makeMessageRoutes } from "./routes/messageRoutes";\nimport { makeFolderRoutes } from "./routes/folderRoutes";'
);
index = index.replace(
  'const messageRepo = new MessageRepository(pool);',
  'const messageRepo = new MessageRepository(pool);\nconst folderRepo = new FolderRepository(pool);'
);
index = index.replace(
  'const messageService = makeMessageService(messageRepo, roomRepo, roomMemberRepo);',
  'const messageService = makeMessageService(messageRepo, roomRepo, roomMemberRepo);\nconst folderService = makeFolderService(folderRepo);'
);
index = index.replace(
  'const messageController = makeMessageController(messageService);',
  'const messageController = makeMessageController(messageService);\nconst folderController = makeFolderController(folderService);'
);
index = index.replace(
  'app.use("/api/v1/rooms", makeMessageRoutes(messageController));',
  'app.use("/api/v1/rooms", makeMessageRoutes(messageController));\napp.use("/api/v1/folders", makeFolderRoutes(folderController));'
);
fs.writeFileSync('backend/src/index.ts', index);

// update shared/types.ts
let types = fs.readFileSync('shared/types.ts', 'utf8');
types += `\nexport interface Folder {
  folderId: string;
  userId: string;
  name: string;
  createdAt: Date;
  roomIds: string[];
}\n`;
fs.writeFileSync('shared/types.ts', types);
