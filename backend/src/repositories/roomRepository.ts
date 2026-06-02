import { Pool } from 'pg';
import type { Room, RoomSummary } from '@shared/types';
import type { CreateRoomData, IRoomRepository, UpdateRoomData } from './IRoomRepository';

function mapRowToRoom(row: any): Room {
  return {
    roomId:          row.room_id,
    type:            row.type,
    name:            row.name ?? undefined,
    avatarUrl:       row.avatar_url ?? undefined,
    inviteCode:      row.invite_code ?? undefined,
    requireApproval: row.require_approval,
    viewHistory:     row.view_history,
    isArchived:      row.is_archived,
    createdAt:       row.created_at,
  };
}

function mapRowToRoomSummary(row: any): RoomSummary {
  const summary: RoomSummary = {
    ...mapRowToRoom(row),
    unreadCount: Number(row.unread_count ?? 0),
  };

  if (row.latest_message_id) {
    summary.latestMessage = {
      messageId: row.latest_message_id,
      senderId: row.latest_sender_id ?? null,
      content: row.latest_content,
      sentAt: row.latest_sent_at,
    };
  }

  return summary;
}

export class RoomRepository implements IRoomRepository {
  constructor(private db: Pool) {}

  async findById(roomId: string): Promise<Room | null> {
    const res = await this.db.query(
      'SELECT * FROM chat_rooms WHERE room_id = $1',
      [roomId]
    );
    return res.rows.length === 0 ? null : mapRowToRoom(res.rows[0]);
  }

  async findByInviteCode(code: string): Promise<Room | null> {
    const res = await this.db.query(
      'SELECT * FROM chat_rooms WHERE invite_code = $1',
      [code]
    );
    return res.rows.length === 0 ? null : mapRowToRoom(res.rows[0]);
  }

  async findByRoomHash(roomHash: string): Promise<Room | null> {
    const res = await this.db.query(
      'SELECT * FROM chat_rooms WHERE room_hash = $1',
      [roomHash]
    );
    return res.rows.length === 0 ? null : mapRowToRoom(res.rows[0]);
  }

  async findByMember(userId: string): Promise<RoomSummary[]> {
    const res = await this.db.query(
      `SELECT
         cr.*,
         latest.message_id AS latest_message_id,
         latest.sender_id AS latest_sender_id,
         latest.content AS latest_content,
         latest.sent_at AS latest_sent_at,
         COALESCE(unread.unread_count, 0) AS unread_count
       FROM chat_rooms cr
       JOIN room_members rm ON rm.room_id = cr.room_id
       LEFT JOIN messages last_read ON last_read.message_id = rm.last_read_id
       LEFT JOIN LATERAL (
         SELECT m.message_id, m.sender_id, m.content, m.sent_at
         FROM messages m
         WHERE m.room_id = cr.room_id
           AND (cr.view_history = true OR m.sent_at >= rm.join_time)
         ORDER BY m.sent_at DESC
         LIMIT 1
       ) latest ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS unread_count
         FROM (
           SELECT 1
           FROM messages m
           WHERE m.room_id = cr.room_id
             AND (cr.view_history = true OR m.sent_at >= rm.join_time)
             AND (last_read.sent_at IS NULL OR m.sent_at > last_read.sent_at)
           LIMIT 100
         ) _sub
       ) unread ON true
       WHERE rm.user_id = $1
       ORDER BY COALESCE(latest.sent_at, cr.created_at) DESC`,
      [userId]
    );
    return res.rows.map(mapRowToRoomSummary);
  }

  async create(data: CreateRoomData): Promise<Room> {
    const res = await this.db.query(
      `INSERT INTO chat_rooms (type, name, avatar_url, invite_code, room_hash, require_approval, view_history)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.type,
        data.name ?? null,
        data.avatarUrl ?? null,
        data.inviteCode ?? null,
        data.roomHash ?? null,
        data.requireApproval,
        data.viewHistory,
      ]
    );
    return mapRowToRoom(res.rows[0]);
  }

  async update(
    roomId: string,
    data: UpdateRoomData
  ): Promise<Room> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined)            { fields.push(`name = $${idx++}`);             values.push(data.name); }
    if (data.avatarUrl !== undefined)       { fields.push(`avatar_url = $${idx++}`);       values.push(data.avatarUrl); }
    if (data.requireApproval !== undefined) { fields.push(`require_approval = $${idx++}`); values.push(data.requireApproval); }
    if (data.viewHistory !== undefined)     { fields.push(`view_history = $${idx++}`);     values.push(data.viewHistory); }
    if (data.isArchived !== undefined)      { fields.push(`is_archived = $${idx++}`);      values.push(data.isArchived); }

    if (fields.length === 0) {
      const res = await this.db.query('SELECT * FROM chat_rooms WHERE room_id = $1', [roomId]);
      if (res.rows.length === 0) throw new Error('Room not found');
      return mapRowToRoom(res.rows[0]);
    }

    values.push(roomId);
    const res = await this.db.query(
      `UPDATE chat_rooms SET ${fields.join(', ')} WHERE room_id = $${idx} RETURNING *`,
      values
    );
    if (res.rows.length === 0) throw new Error('Room not found');
    return mapRowToRoom(res.rows[0]);
  }

  async delete(roomId: string): Promise<void> {
    await this.db.query('DELETE FROM chat_rooms WHERE room_id = $1', [roomId]);
  }
}
