import { Pool } from 'pg';
import type { Message, MessageWithSender } from '@shared/types';
import type { IMessageRepository } from './IMessageRepository';
import { ValidationError } from '../errors/AppError';

function mapRowToMessage(row: any): Message {
  const msg: Message = {
    messageId: row.message_id,
    roomId: row.room_id,
    senderId: row.sender_id,
    content: row.content,
    replyToId: row.reply_to_id ?? undefined,
    isRecalled: row.is_recalled,
    sentAt: row.sent_at,
  };
  if (row.attachments && row.attachments.length > 0) {
    msg.attachments = row.attachments.filter((id: string | null) => id !== null).map((id: string) => `/api/v1/attachments/${id}`);
  }
  return msg;
}

function mapRowToMessageWithSender(row: any): MessageWithSender {
  const isDeleted = row.sender_deleted_at !== null && row.sender_deleted_at !== undefined;

  const msg: MessageWithSender = {
    ...mapRowToMessage(row),
    sender: row.sender_user_id
      ? isDeleted 
        ? { userId: row.sender_user_id, name: 'Deleted User', avatarUrl: undefined }
        : {
            userId: row.sender_user_id,
            name: row.sender_name,
            avatarUrl: row.sender_avatar_url ?? undefined,
          }
      : null,
  };
  if (row.mentions) {
    msg.mentions = row.mentions;
  }
  return msg;
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

  async findByRoom(roomId: string, opts: { beforeId?: string; limit: number; after?: Date }): Promise<MessageWithSender[]> {
    const limit = Math.max(1, opts.limit);

    if (opts.beforeId) {
      const cursorRes = await this.db.query(
        'SELECT sent_at, message_id FROM messages WHERE message_id = $1 AND room_id = $2',
        [opts.beforeId, roomId]
      );
      if (cursorRes.rows.length === 0) {
        throw new ValidationError('Cursor message not found in this room');
      }
      const cursor = cursorRes.rows[0];

      const res = await this.db.query(
        `SELECT
           m.*,
           u.user_id AS sender_user_id,
           u.name AS sender_name,
           u.avatar_url AS sender_avatar_url,
           u.deleted_at AS sender_deleted_at,
           (SELECT array_agg(user_id) FROM message_mentions WHERE message_id = m.message_id) AS mentions,
           (SELECT array_agg(attachment_id) FROM attachments WHERE message_id = m.message_id) AS attachments
         FROM messages m
         LEFT JOIN users u ON u.user_id = m.sender_id
         WHERE m.room_id = $1
           AND ($5::timestamptz IS NULL OR m.sent_at >= $5)
           AND (m.sent_at, m.message_id) < ($2, $3)
         ORDER BY m.sent_at DESC, m.message_id DESC
         LIMIT $4`,
        [roomId, cursor.sent_at, cursor.message_id, limit, opts.after ?? null],
      );
      return res.rows.map(mapRowToMessageWithSender);
    }

    const res = await this.db.query(
      `SELECT
         m.*,
         u.user_id AS sender_user_id,
         u.name AS sender_name,
         u.avatar_url AS sender_avatar_url,
         u.deleted_at AS sender_deleted_at,
         (SELECT array_agg(user_id) FROM message_mentions WHERE message_id = m.message_id) AS mentions,
         (SELECT array_agg(attachment_id) FROM attachments WHERE message_id = m.message_id) AS attachments
       FROM messages m
       LEFT JOIN users u ON u.user_id = m.sender_id
       WHERE m.room_id = $1
         AND ($3::timestamptz IS NULL OR m.sent_at >= $3)
       ORDER BY m.sent_at DESC, m.message_id DESC
       LIMIT $2`,
      [roomId, limit, opts.after ?? null],
    );
    return res.rows.map(mapRowToMessageWithSender);
  }

  async create(data: Pick<Message, 'roomId' | 'senderId' | 'content' | 'replyToId'> & { mentions?: string[], attachments?: string[] }): Promise<MessageWithSender> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `WITH inserted AS (
           INSERT INTO messages (room_id, sender_id, content, reply_to_id)
           VALUES ($1, $2, $3, $4)
           RETURNING *
         )
         SELECT
           inserted.*,
           u.user_id AS sender_user_id,
           u.name AS sender_name,
           u.avatar_url AS sender_avatar_url,
           u.deleted_at AS sender_deleted_at,
           ARRAY[]::uuid[] AS attachments
         FROM inserted
         LEFT JOIN users u ON u.user_id = inserted.sender_id`,
        [data.roomId, data.senderId, data.content, data.replyToId ?? null],
      );
      
      const msg = mapRowToMessageWithSender(res.rows[0]);
      
      if (data.mentions && data.mentions.length > 0) {
        const values = data.mentions.map((_, i) => `($1, $${i + 2})`).join(', ');
        const params = [msg.messageId, ...data.mentions];
        await client.query(`INSERT INTO message_mentions (message_id, user_id) VALUES ${values}`, params);
        msg.mentions = data.mentions;
      }
      
      if (data.attachments && data.attachments.length > 0) {
        await client.query('UPDATE attachments SET message_id = $1 WHERE attachment_id = ANY($2::uuid[])', [msg.messageId, data.attachments]);
        msg.attachments = data.attachments.map(id => `/api/v1/attachments/${id}`);
      }
      
      await client.query('COMMIT');
      return msg;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
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
         u.avatar_url AS sender_avatar_url,
         u.deleted_at AS sender_deleted_at,
         (SELECT array_agg(user_id) FROM message_mentions WHERE message_id = updated.message_id) AS mentions,
         (SELECT array_agg(attachment_id) FROM attachments WHERE message_id = updated.message_id) AS attachments
       FROM updated
       LEFT JOIN users u ON u.user_id = updated.sender_id`,
      [messageId],
    );
    if (res.rows.length === 0) throw new Error('Message not found');
    return mapRowToMessageWithSender(res.rows[0]);
  }
}
