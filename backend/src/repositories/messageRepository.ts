import { Pool } from 'pg';
import type { Message, MessageWithSender } from '@shared/types';
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

function mapRowToMessageWithSender(row: any): MessageWithSender {
  return {
    ...mapRowToMessage(row),
    sender: row.sender_user_id
      ? {
          userId: row.sender_user_id,
          name: row.sender_name,
          avatarUrl: row.sender_avatar_url ?? undefined,
        }
      : null,
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

  async findByRoom(roomId: string, opts: { beforeId?: string; limit: number }): Promise<MessageWithSender[]> {
    const limit = Math.max(1, opts.limit);

    if (opts.beforeId) {
      const res = await this.db.query(
        `SELECT
           m.*,
           u.user_id AS sender_user_id,
           u.name AS sender_name,
           u.avatar_url AS sender_avatar_url
         FROM messages m
         LEFT JOIN users u ON u.user_id = m.sender_id
         WHERE m.room_id = $1
           AND m.sent_at < (
             SELECT sent_at
             FROM messages
             WHERE message_id = $2 AND room_id = $1
           )
         ORDER BY m.sent_at ASC
         LIMIT $3`,
        [roomId, opts.beforeId, limit],
      );
      return res.rows.map(mapRowToMessageWithSender);
    }

    const res = await this.db.query(
      `SELECT
         m.*,
         u.user_id AS sender_user_id,
         u.name AS sender_name,
         u.avatar_url AS sender_avatar_url
       FROM messages m
       LEFT JOIN users u ON u.user_id = m.sender_id
       WHERE m.room_id = $1
       ORDER BY m.sent_at ASC
       LIMIT $2`,
      [roomId, limit],
    );
    return res.rows.map(mapRowToMessageWithSender);
  }

  async create(data: Pick<Message, 'roomId' | 'senderId' | 'content' | 'replyToId'>): Promise<MessageWithSender> {
    const res = await this.db.query(
      `WITH inserted AS (
         INSERT INTO messages (room_id, sender_id, content, reply_to_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *
       )
       SELECT
         inserted.*,
         u.user_id AS sender_user_id,
         u.name AS sender_name,
         u.avatar_url AS sender_avatar_url
       FROM inserted
       LEFT JOIN users u ON u.user_id = inserted.sender_id`,
      [data.roomId, data.senderId, data.content, data.replyToId ?? null],
    );
    return mapRowToMessageWithSender(res.rows[0]);
  }

  async markRecalled(messageId: string): Promise<MessageWithSender> {
    const res = await this.db.query(
      `WITH updated AS (
         UPDATE messages
         SET is_recalled = true
         WHERE message_id = $1
         RETURNING *
       )
       SELECT
         updated.*,
         u.user_id AS sender_user_id,
         u.name AS sender_name,
         u.avatar_url AS sender_avatar_url
       FROM updated
       LEFT JOIN users u ON u.user_id = updated.sender_id`,
      [messageId],
    );
    if (res.rows.length === 0) throw new Error('Message not found');
    return mapRowToMessageWithSender(res.rows[0]);
  }
}
