import { Pool } from 'pg';
import type { Message } from '@shared/types';
import type { IMessageRepository } from './IMessageRepository';

function mapRowToMessage(row: any): Message {
  return {
    messageId: row.message_id,
    roomId: row.room_id,
    senderId: row.sender_id,
    content: row.content,
    replyToId: row.reply_to_id ?? undefined,
    isRecalled: row.is_recalled,
    sentAt: row.sent_at,
  };
}

export class MessageRepository implements IMessageRepository {
  constructor(private db: Pool) {}

  async findById(messageId: string): Promise<Message | null> {
    const res = await this.db.query(
      'SELECT * FROM messages WHERE message_id = $1',
      [messageId],
    );
    return res.rows.length === 0 ? null : mapRowToMessage(res.rows[0]);
  }

  async findByRoom(roomId: string, opts: { beforeId?: string; limit: number }): Promise<Message[]> {
    const limit = Math.max(1, opts.limit);

    if (opts.beforeId) {
      const res = await this.db.query(
        `SELECT *
         FROM messages
         WHERE room_id = $1
           AND sent_at < (
             SELECT sent_at
             FROM messages
             WHERE message_id = $2 AND room_id = $1
           )
         ORDER BY sent_at ASC
         LIMIT $3`,
        [roomId, opts.beforeId, limit],
      );
      return res.rows.map(mapRowToMessage);
    }

    const res = await this.db.query(
      `SELECT *
       FROM messages
       WHERE room_id = $1
       ORDER BY sent_at ASC
       LIMIT $2`,
      [roomId, limit],
    );
    return res.rows.map(mapRowToMessage);
  }

  async create(data: Pick<Message, 'roomId' | 'senderId' | 'content' | 'replyToId'>): Promise<Message> {
    const res = await this.db.query(
      `INSERT INTO messages (room_id, sender_id, content, reply_to_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.roomId, data.senderId, data.content, data.replyToId ?? null],
    );
    return mapRowToMessage(res.rows[0]);
  }

  async markRecalled(messageId: string): Promise<Message> {
    const res = await this.db.query(
      `UPDATE messages
       SET is_recalled = true
       WHERE message_id = $1
       RETURNING *`,
      [messageId],
    );
    if (res.rows.length === 0) throw new Error('Message not found');
    return mapRowToMessage(res.rows[0]);
  }
}
