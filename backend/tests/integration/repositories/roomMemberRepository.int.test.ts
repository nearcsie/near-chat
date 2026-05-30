import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { RoomMemberRepository } from '../../../src/repositories/roomMemberRepository';
import { testPool } from '../../helpers/testPool';
import { resetDb } from '../../helpers/resetDb';

describe('RoomMemberRepository (pg)', () => {
  const repo = new RoomMemberRepository(testPool);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  it('add (role=member) → findMember → update (role=admin, isMuted=true) → findByRoom → remove', async () => {
    const userRes = await testPool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ('Alice', 'alice@test.com', 'hash') RETURNING user_id"
    );
    const userId: string = userRes.rows[0].user_id;

    const roomRes = await testPool.query(
      "INSERT INTO chat_rooms (type, name) VALUES ('group', 'Test Room') RETURNING room_id"
    );
    const roomId: string = roomRes.rows[0].room_id;

    // add
    const member = await repo.add({ roomId, userId, role: 'member' });
    expect(member.roomId).toBe(roomId);
    expect(member.userId).toBe(userId);
    expect(member.role).toBe('member');
    expect(member.isMuted).toBe(false);
    expect(member.joinTime).toBeInstanceOf(Date);
    expect(member.nickname).toBeUndefined();
    expect(member.lastReadId).toBeUndefined();

    // findMember
    const found = await repo.findMember(roomId, userId);
    expect(found).not.toBeNull();
    expect(found!.userId).toBe(userId);
    expect(found!.role).toBe('member');

    // update role and isMuted
    const updated = await repo.update(roomId, userId, { role: 'admin', isMuted: true });
    expect(updated.role).toBe('admin');
    expect(updated.isMuted).toBe(true);
    expect(updated.roomId).toBe(roomId);
    expect(updated.userId).toBe(userId);

    // findByRoom — assert member count
    const members = await repo.findByRoom(roomId);
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe('admin');
    expect(members[0].isMuted).toBe(true);

    // remove
    await repo.remove(roomId, userId);
    const afterRemove = await repo.findMember(roomId, userId);
    expect(afterRemove).toBeNull();

    const afterRemoveList = await repo.findByRoom(roomId);
    expect(afterRemoveList).toHaveLength(0);
  });

  it('findMember returns null for non-existent member', async () => {
    const result = await repo.findMember(
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000001'
    );
    expect(result).toBeNull();
  });

  it('findByRoom returns empty array when room has no members', async () => {
    const roomRes = await testPool.query(
      "INSERT INTO chat_rooms (type, name) VALUES ('group', 'Empty Room') RETURNING room_id"
    );
    const result = await repo.findByRoom(roomRes.rows[0].room_id);
    expect(result).toEqual([]);
  });

  it('update nickname and lastReadId', async () => {
    const userRes = await testPool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ('Bob', 'bob@test.com', 'hash') RETURNING user_id"
    );
    const roomRes = await testPool.query(
      "INSERT INTO chat_rooms (type, name) VALUES ('group', 'Room') RETURNING room_id"
    );
    const { roomId, userId } = {
      roomId: roomRes.rows[0].room_id,
      userId: userRes.rows[0].user_id,
    };

    await repo.add({ roomId, userId, role: 'member' });

    // Insert a message to use as lastReadId
    const msgRes = await testPool.query(
      'INSERT INTO messages (room_id, sender_id, content) VALUES ($1, $2, $3) RETURNING message_id',
      [roomId, userId, 'hi']
    );
    const messageId: string = msgRes.rows[0].message_id;

    const updated = await repo.update(roomId, userId, {
      nickname: 'Bobby',
      lastReadId: messageId,
    });
    expect(updated.nickname).toBe('Bobby');
    expect(updated.lastReadId).toBe(messageId);
  });

  it('findByRoom returns all members in a multi-member room', async () => {
    const [u1, u2] = await Promise.all([
      testPool.query(
        "INSERT INTO users (name, email, password_hash) VALUES ('U1', 'u1@test.com', 'hash') RETURNING user_id"
      ),
      testPool.query(
        "INSERT INTO users (name, email, password_hash) VALUES ('U2', 'u2@test.com', 'hash') RETURNING user_id"
      ),
    ]);
    const roomRes = await testPool.query(
      "INSERT INTO chat_rooms (type, name) VALUES ('group', 'Multi') RETURNING room_id"
    );
    const roomId: string = roomRes.rows[0].room_id;

    await Promise.all([
      repo.add({ roomId, userId: u1.rows[0].user_id, role: 'owner' }),
      repo.add({ roomId, userId: u2.rows[0].user_id, role: 'member' }),
    ]);

    const members = await repo.findByRoom(roomId);
    expect(members).toHaveLength(2);
  });
});
