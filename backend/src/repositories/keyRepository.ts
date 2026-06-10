import { Pool } from 'pg';
import type { RoomKeyMemberStatus } from '@shared/types';
import type { IKeyRepository } from './IKeyRepository';

export class KeyRepository implements IKeyRepository {
  constructor(private db: Pool) {}

  async getPublicKeyRow(userId: string): Promise<{ publicKey: string | null } | null> {
    const res = await this.db.query(
      'SELECT public_key FROM users WHERE user_id = $1 AND deleted_at IS NULL',
      [userId],
    );
    if (res.rows.length === 0) return null;
    return { publicKey: res.rows[0].public_key ?? null };
  }

  async setPublicKey(userId: string, publicKey: string): Promise<void> {
    await this.db.query('UPDATE users SET public_key = $2 WHERE user_id = $1', [
      userId,
      publicKey,
    ]);
  }

  async findRoomKey(roomId: string, userId: string): Promise<string | null> {
    const res = await this.db.query(
      'SELECT encrypted_key FROM room_keys WHERE room_id = $1 AND user_id = $2',
      [roomId, userId],
    );
    return res.rows.length === 0 ? null : res.rows[0].encrypted_key;
  }

  async listMemberKeyStatus(roomId: string): Promise<RoomKeyMemberStatus[]> {
    const res = await this.db.query(
      `SELECT
         rm.user_id,
         u.public_key,
         (rk.user_id IS NOT NULL) AS has_room_key
       FROM room_members rm
       JOIN users u ON u.user_id = rm.user_id
       LEFT JOIN room_keys rk ON rk.room_id = rm.room_id AND rk.user_id = rm.user_id
       WHERE rm.room_id = $1`,
      [roomId],
    );
    return res.rows.map((row) => ({
      userId: row.user_id,
      publicKey: row.public_key ?? null,
      hasRoomKey: row.has_room_key,
    }));
  }

  async insertRoomKeys(
    roomId: string,
    entries: { userId: string; encryptedKey: string }[],
  ): Promise<string[]> {
    if (entries.length === 0) return [];

    const values = entries.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(', ');
    const params = [roomId, ...entries.flatMap((e) => [e.userId, e.encryptedKey])];
    const res = await this.db.query(
      `INSERT INTO room_keys (room_id, user_id, encrypted_key)
       VALUES ${values}
       ON CONFLICT (room_id, user_id) DO NOTHING
       RETURNING user_id`,
      params,
    );
    return res.rows.map((row) => row.user_id);
  }
}
