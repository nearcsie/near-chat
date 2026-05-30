import { Pool } from 'pg';
import type { Message, MessageWithSender, PublicUser } from '@shared/types';
import type { IMessageRepository } from './IMessageRepository';

function mapRowToMessage(row: any): Message {
  return {
    messageId: row.message_id,
    roomId:    row.room_id,
    senderId:  row.sender_id ?? null,
    content:   row.content,
    replyToId: row.reply_to_id ?? undefined,
    isRecalled: row.is_recalled,
    sentAt:    row.sent_at,
  };
}

function mapRowToMessageWithSender(row: any): MessageWithSender {
  const sender: PublicUser | null = row.sender_id
    ? { userId: row.sender_id, name: row.sender_name, avatarUrl: row.sender_avatar_url ?? undefined }
    : null;
  return { ...mapRowToMessage(row), sender };
}

const WITH_SENDER_JOIN = `
  SELECT m.*, u.name AS sender_name, u.avatar_url AS sender_avatar_url
  FROM messages m
  LEFT JOIN users u ON m.sender_id = u.user_id
`;

export class MessageRepository implements IMessageRepository {
  constructor(private db: Pool) {}

  async findById(messageId: string): Promise<Message | null> {
    const res = await this.db.query(
      'SELECT * FROM messages WHERE message_id = $1',
      [messageId]
    );
    return res.rows.length === 0 ? null : mapRowToMessage(res.rows[0]);
  }

  async findByRoom(
    roomId: string,
    opts: { beforeId?: string; limit: number }
  ): Promise<MessageWithSender[]> {
    if (opts.beforeId) {
      const res = await this.db.query(
        `${WITH_SENDER_JOIN}
         WHERE m.room_id = $1
           AND m.sent_at < (SELECT sent_at FROM messages WHERE message_id = $2)
         ORDER BY m.sent_at DESC
         LIMIT $3`,
        [roomId, opts.beforeId, opts.limit]
      );
      return res.rows.map(mapRowToMessageWithSender);
    }
    const res = await this.db.query(
      `${WITH_SENDER_JOIN}
       WHERE m.room_id = $1
       ORDER BY m.sent_at DESC
       LIMIT $2`,
      [roomId, opts.limit]
    );
    return res.rows.map(mapRowToMessageWithSender);
  }

  async create(
    data: Pick<Message, 'roomId' | 'senderId' | 'content' | 'replyToId'>
  ): Promise<Message> {
    const res = await this.db.query(
      `INSERT INTO messages (room_id, sender_id, content, reply_to_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.roomId, data.senderId ?? null, data.content, data.replyToId ?? null]
    );
    return mapRowToMessage(res.rows[0]);
  }

  async markRecalled(messageId: string): Promise<Message> {
    const res = await this.db.query(
      'UPDATE messages SET is_recalled = TRUE WHERE message_id = $1 RETURNING *',
      [messageId]
    );
    if (res.rows.length === 0) throw new Error('Message not found');
    return mapRowToMessage(res.rows[0]);
  }
}
