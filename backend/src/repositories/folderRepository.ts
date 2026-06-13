import { Pool } from 'pg';
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
      `INSERT INTO folders (user_id, name) VALUES ($1, $2) RETURNING *`,
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
      `SELECT f.*, COALESCE(json_agg(fr.room_id) FILTER (WHERE fr.room_id IS NOT NULL), '[]') as room_ids
       FROM folders f
       LEFT JOIN folder_rooms fr ON f.folder_id = fr.folder_id
       WHERE f.user_id = $1
       GROUP BY f.folder_id
       ORDER BY f.created_at ASC`,
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
      `DELETE FROM folders WHERE folder_id = $1 AND user_id = $2`,
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

      await client.query(`DELETE FROM folder_rooms WHERE folder_id = $1`, [folderId]);
      
      if (roomIds.length > 0) {
        const values = roomIds.map((_, i) => `($1, $${i + 2}, $${roomIds.length + 2})`).join(', ');
        const params = [folderId, ...roomIds, userId];
        await client.query(`INSERT INTO folder_rooms (folder_id, room_id, user_id) VALUES ${values}`, params);
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
