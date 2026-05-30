import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { MessageRepository } from '../../../src/repositories/messageRepository';
import { testPool } from '../../helpers/testPool';
import { resetDb } from '../../helpers/resetDb';

describe('MessageRepository (pg)', () => {
  const repo = new MessageRepository(testPool);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  it('create → findById → findByRoom (cursor) → markRecalled', async () => {
    const userRes = await testPool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ('Alice', 'alice@test.com', 'hash') RETURNING user_id"
    );
    const userId: string = userRes.rows[0].user_id;

    const roomRes = await testPool.query(
      "INSERT INTO chat_rooms (type, name) VALUES ('group', 'Test Room') RETURNING room_id"
    );
    const roomId: string = roomRes.rows[0].room_id;

    // Insert with explicit timestamps so cursor ordering is deterministic
    const [r1, r2, r3] = await Promise.all([
      testPool.query(
        `INSERT INTO messages (room_id, sender_id, content, sent_at)
         VALUES ($1, $2, 'First', NOW() - INTERVAL '2 seconds') RETURNING message_id`,
        [roomId, userId]
      ),
      testPool.query(
        `INSERT INTO messages (room_id, sender_id, content, sent_at)
         VALUES ($1, $2, 'Second', NOW() - INTERVAL '1 second') RETURNING message_id`,
        [roomId, userId]
      ),
      testPool.query(
        `INSERT INTO messages (room_id, sender_id, content, sent_at)
         VALUES ($1, $2, 'Third', NOW()) RETURNING message_id`,
        [roomId, userId]
      ),
    ]);
    const [id1, id2, id3] = [r1.rows[0].message_id, r2.rows[0].message_id, r3.rows[0].message_id];

    // create via repo
    const created = await repo.create({ roomId, senderId: userId, content: 'Hello', replyToId: undefined });
    expect(typeof created.messageId).toBe('string');
    expect(created.roomId).toBe(roomId);
    expect(created.senderId).toBe(userId);
    expect(created.content).toBe('Hello');
    expect(created.isRecalled).toBe(false);
    expect(created.sentAt).toBeInstanceOf(Date);

    // findById
    const fetched = await repo.findById(id1);
    expect(fetched).not.toBeNull();
    expect(fetched!.messageId).toBe(id1);
    expect(fetched!.content).toBe('First');

    // findByRoom — all messages reverse-chronological; sender is joined
    const all = await repo.findByRoom(roomId, { limit: 10 });
    expect(all.length).toBeGreaterThanOrEqual(3);
    // Most recent first
    const ids = all.map((m) => m.messageId);
    expect(ids.indexOf(id3)).toBeLessThan(ids.indexOf(id2));
    expect(ids.indexOf(id2)).toBeLessThan(ids.indexOf(id1));
    // Sender profile is populated
    expect(all[0].sender).not.toBeNull();
    expect(all[0].sender!.userId).toBe(userId);
    expect(all[0].sender!.name).toBe('Alice');

    // findByRoom — cursor: messages before id3
    const page = await repo.findByRoom(roomId, { beforeId: id3, limit: 10 });
    const pageIds = page.map((m) => m.messageId);
    expect(pageIds).not.toContain(id3);
    expect(pageIds).toContain(id2);
    expect(pageIds).toContain(id1);

    // markRecalled
    const recalled = await repo.markRecalled(id1);
    expect(recalled.isRecalled).toBe(true);
    expect(recalled.messageId).toBe(id1);
    const afterRecall = await repo.findById(id1);
    expect(afterRecall!.isRecalled).toBe(true);
  });

  it('findById returns null for non-existent message', async () => {
    const result = await repo.findById('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  it('findByRoom returns empty array when room has no messages', async () => {
    const roomRes = await testPool.query(
      "INSERT INTO chat_rooms (type, name) VALUES ('group', 'Empty Room') RETURNING room_id"
    );
    const result = await repo.findByRoom(roomRes.rows[0].room_id, { limit: 10 });
    expect(result).toEqual([]);
  });

  it('create with null senderId (deleted-user scenario)', async () => {
    const roomRes = await testPool.query(
      "INSERT INTO chat_rooms (type, name) VALUES ('group', 'Room') RETURNING room_id"
    );
    const msg = await repo.create({
      roomId: roomRes.rows[0].room_id,
      senderId: null,
      content: 'System message',
      replyToId: undefined,
    });
    expect(msg.senderId).toBeNull();
  });

  it('replyToId is mapped correctly', async () => {
    const userRes = await testPool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ('Bob', 'bob@test.com', 'hash') RETURNING user_id"
    );
    const roomRes = await testPool.query(
      "INSERT INTO chat_rooms (type, name) VALUES ('group', 'Room') RETURNING room_id"
    );
    const parent = await repo.create({
      roomId: roomRes.rows[0].room_id,
      senderId: userRes.rows[0].user_id,
      content: 'parent',
      replyToId: undefined,
    });
    const reply = await repo.create({
      roomId: roomRes.rows[0].room_id,
      senderId: userRes.rows[0].user_id,
      content: 'reply',
      replyToId: parent.messageId,
    });
    expect(reply.replyToId).toBe(parent.messageId);
  });
});
