import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { RoomRepository } from '../../src/repositories/roomRepository';
import { testPool } from '../helpers/testPool';
import { resetDb } from '../helpers/resetDb';

describe('RoomRepository (pg)', () => {
  const repo = new RoomRepository(testPool);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  it('create → findById → findByMember → update → delete', async () => {
    // create a user so we can add a room member
    const userRes = await testPool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ('Alice', 'alice@test.com', 'hash') RETURNING user_id"
    );
    const userId: string = userRes.rows[0].user_id;

    // create
    const room = await repo.create({
      type: 'group',
      name: 'Study Room',
      requireApproval: false,
      viewHistory: true,
    });

    expect(typeof room.roomId).toBe('string');
    expect(room.type).toBe('group');
    expect(room.name).toBe('Study Room');
    expect(room.requireApproval).toBe(false);
    expect(room.viewHistory).toBe(true);
    expect(room.isArchived).toBe(false);
    expect(room.createdAt).toBeInstanceOf(Date);

    // findById
    const fetched = await repo.findById(room.roomId);
    expect(fetched).toEqual(room);

    // findByMember — add membership first, then verify room appears
    await testPool.query(
      'INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, $3)',
      [room.roomId, userId, 'owner']
    );
    const rooms = await repo.findByMember(userId);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].roomId).toBe(room.roomId);

    // update
    const updated = await repo.update(room.roomId, {
      name: 'Updated Room',
      isArchived: true,
    });
    expect(updated.name).toBe('Updated Room');
    expect(updated.isArchived).toBe(true);
    expect(updated.roomId).toBe(room.roomId);

    const afterUpdate = await repo.findById(room.roomId);
    expect(afterUpdate).toEqual(updated);

    // delete
    await repo.delete(room.roomId);
    const afterDelete = await repo.findById(room.roomId);
    expect(afterDelete).toBeNull();
  });

  it('findById returns null for non-existent room', async () => {
    const result = await repo.findById('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  it('findByMember returns empty array when user has no rooms', async () => {
    const userRes = await testPool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ('Bob', 'bob@test.com', 'hash') RETURNING user_id"
    );
    const result = await repo.findByMember(userRes.rows[0].user_id);
    expect(result).toEqual([]);
  });

  it('create accepts type="private"', async () => {
    const room = await repo.create({
      type: 'private',
      name: undefined,
      requireApproval: false,
      viewHistory: false,
    });
    expect(room.type).toBe('private');
    expect(typeof room.roomId).toBe('string');
  });
});
