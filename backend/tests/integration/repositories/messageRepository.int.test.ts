import { describe, it, expect, beforeEach } from 'vitest';
import { MessageRepository } from '../../../src/repositories/messageRepository';
import { testPool } from '../../helpers/testPool';
import { resetDb } from '../../helpers/resetDb';

describe('MessageRepository (pg)', () => {
  const repo = new MessageRepository(testPool);

  beforeEach(async () => {
    await resetDb();
  });

  async function createUser(email: string) {
    const res = await testPool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id',
      ['Message Tester', email, 'hash'],
    );
    return res.rows[0].user_id as string;
  }

  async function createRoom() {
    const res = await testPool.query(
      'INSERT INTO chat_rooms (type, name) VALUES ($1, $2) RETURNING room_id',
      ['group', 'Message Repo Room'],
    );
    return res.rows[0].room_id as string;
  }

  it('create -> findById -> findByRoom returns camelCase messages in chronological order', async () => {
    const userId = await createUser('message-user@test.com');
    const roomId = await createRoom();

    const first = await repo.create({
      roomId,
      senderId: userId,
      content: 'first message',
    });
    const second = await repo.create({
      roomId,
      senderId: userId,
      content: 'second message',
      replyToId: first.messageId,
    });

    expect(first.messageId).toBeDefined();
    expect(first.roomId).toBe(roomId);
    expect(first.senderId).toBe(userId);
    expect(first.sender).toEqual({
      userId,
      name: 'Message Tester',
      avatarUrl: undefined,
    });
    expect(first.replyToId).toBeUndefined();
    expect(first.isRecalled).toBe(false);
    expect(first.sentAt).toBeInstanceOf(Date);

    const fetched = await repo.findById(second.messageId);
    expect(fetched).toMatchObject({
      messageId: second.messageId,
      roomId,
      senderId: userId,
      content: 'second message',
    });
    expect(fetched?.replyToId).toBe(first.messageId);

    const messages = await repo.findByRoom(roomId, { limit: 10 });
    expect(messages.map((message) => message.messageId)).toEqual([
      first.messageId,
      second.messageId,
    ]);
    expect(messages[1].sender).toEqual({
      userId,
      name: 'Message Tester',
      avatarUrl: undefined,
    });
  });

  it('findByRoom respects beforeId and limit', async () => {
    const userId = await createUser('pagination-user@test.com');
    const roomId = await createRoom();

    const first = await repo.create({ roomId, senderId: userId, content: 'one' });
    const second = await repo.create({ roomId, senderId: userId, content: 'two' });
    await repo.create({ roomId, senderId: userId, content: 'three' });

    const beforeSecond = await repo.findByRoom(roomId, {
      beforeId: second.messageId,
      limit: 5,
    });
    expect(beforeSecond.map((message) => message.messageId)).toEqual([first.messageId]);

    const limited = await repo.findByRoom(roomId, { limit: 2 });
    expect(limited).toHaveLength(2);
    expect(limited[0].content).toBe('one');
    expect(limited[1].content).toBe('two');
  });

  it('markRecalled sets isRecalled and findById returns null for missing messages', async () => {
    const userId = await createUser('recall-user@test.com');
    const roomId = await createRoom();

    const message = await repo.create({ roomId, senderId: userId, content: 'recall me' });
    const recalled = await repo.markRecalled(message.messageId);

    expect(recalled.messageId).toBe(message.messageId);
    expect(recalled.isRecalled).toBe(true);
    expect(recalled.sender).toEqual({
      userId,
      name: 'Message Tester',
      avatarUrl: undefined,
    });
    await expect(repo.markRecalled('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
      'Message not found',
    );

    const missing = await repo.findById('00000000-0000-0000-0000-000000000000');
    expect(missing).toBeNull();
  });
});
