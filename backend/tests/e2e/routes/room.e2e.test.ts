import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
let app: any;
import { resetDb } from '../../helpers/resetDb';

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  const indexModule = await import('../../../src/index');
  app = indexModule.app;
});

describe('Room E2E', () => {
  let token: string;
  let userId: string;
  let otherToken: string;
  let otherUserId: string;
  let thirdToken: string;

  beforeEach(async () => {
    await resetDb();
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'User',
      email: 'user@example.com',
      password: 'Password123!',
    });
    token = res.body.token;
    userId = res.body.user.userId;

    const otherRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Other User',
      email: 'other@example.com',
      password: 'Password123!',
    });
    otherToken = otherRes.body.token;
    otherUserId = otherRes.body.user.userId;

    const thirdRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Third User',
      email: 'third@example.com',
      password: 'Password123!',
    });
    thirdToken = thirdRes.body.token;
  });

  const makeFriends = async () => {
    await request(app)
      .post('/api/v1/friends/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ target_user_id: otherUserId });

    await request(app)
      .patch(`/api/v1/friends/requests/${userId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ status: 'accepted' });
  };

  it('should create a room', async () => {
    const res = await request(app)
      .post('/api/v1/rooms/group')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'group',
        name: 'Test Room',
      });
    expect(res.status).toBe(201);
    expect(res.body.roomId).toBeDefined();
    expect(res.body.type).toBe('group');
    expect(res.body.name).toBe('Test Room');
  });

  it('should list rooms', async () => {
    await request(app)
      .post('/api/v1/rooms/group')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'group',
        name: 'Test Room 1',
      });

    const res = await request(app)
      .get('/api/v1/rooms')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Test Room 1');
    expect(res.body[0].unreadCount).toBeDefined();
  });

  it('should create a group with avatar and generated invite code, then join by code', async () => {
    const createRes = await request(app)
      .post('/api/v1/rooms/group')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Invite Room',
        avatarUrl: 'https://example.com/group.png',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.avatarUrl).toBe('https://example.com/group.png');
    expect(createRes.body.inviteCode).toEqual(expect.any(String));

    const joinRes = await request(app)
      .post(`/api/v1/rooms/join/${createRes.body.inviteCode}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(joinRes.status).toBe(200);
    expect(joinRes.body.roomId).toBe(createRes.body.roomId);
  });

  it('should create an idempotent private room for accepted friends', async () => {
    await makeFriends();

    const first = await request(app)
      .post('/api/v1/rooms/private')
      .set('Authorization', `Bearer ${token}`)
      .send({ target_user_id: otherUserId });
    const second = await request(app)
      .post('/api/v1/rooms/private')
      .set('Authorization', `Bearer ${token}`)
      .send({ target_user_id: otherUserId });

    expect(first.status).toBe(200);
    expect(first.body.type).toBe('private');
    expect(first.body.roomHash).toEqual(expect.any(String));
    expect(second.status).toBe(200);
    expect(second.body.roomId).toBe(first.body.roomId);

    const ownerRooms = await request(app).get('/api/v1/rooms').set('Authorization', `Bearer ${token}`);
    const otherRooms = await request(app).get('/api/v1/rooms').set('Authorization', `Bearer ${otherToken}`);
    expect(ownerRooms.body.some((room: { roomId: string }) => room.roomId === first.body.roomId)).toBe(true);
    expect(otherRooms.body.some((room: { roomId: string }) => room.roomId === first.body.roomId)).toBe(true);

    const outsider = await request(app)
      .get(`/api/v1/rooms/${first.body.roomId}`)
      .set('Authorization', `Bearer ${thirdToken}`);
    expect(outsider.status).toBe(403);
  });

  it('should reject private room creation when users are blocked', async () => {
    await makeFriends();

    await request(app)
      .post('/api/v1/blocks')
      .set('Authorization', `Bearer ${token}`)
      .send({ target_user_id: otherUserId });

    const res = await request(app)
      .post('/api/v1/rooms/private')
      .set('Authorization', `Bearer ${token}`)
      .send({ target_user_id: otherUserId });

    expect(res.status).toBe(403);
  });
});
