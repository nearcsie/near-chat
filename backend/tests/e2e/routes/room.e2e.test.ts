import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/index';
import { resetDb } from '../../helpers/resetDb';

describe('Room E2E', () => {
  let token: string;

  beforeEach(async () => {
    await resetDb();
    const res = await request(app).post('/auth/register').send({
      name: 'User',
      email: 'user@example.com',
      password: 'Password123!',
    });
    token = res.body.token;
  });

  it('should create a room', async () => {
    const res = await request(app)
      .post('/rooms/group')
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
      .post('/rooms/group')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'group',
        name: 'Test Room 1',
      });

    const res = await request(app)
      .get('/rooms')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Test Room 1');
  });
});
