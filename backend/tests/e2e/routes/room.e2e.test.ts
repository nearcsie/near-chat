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
  let otherToken: string;

  beforeEach(async () => {
    await resetDb();
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'User',
      email: 'user@example.com',
      password: 'Password123!',
    });
    token = res.body.token;

    const otherRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Other User',
      email: 'other@example.com',
      password: 'Password123!',
    });
    otherToken = otherRes.body.token;
  });

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
});
