import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/index';
import { resetDb } from '../../helpers/resetDb';

describe('User E2E', () => {
  let token: string;
  let userId: string;

  beforeEach(async () => {
    await resetDb();
    const res = await request(app).post('/auth/register').send({
      name: 'User',
      email: 'user@example.com',
      password: 'Password123!',
    });
    token = res.body.token;
    userId = res.body.user.userId;
  });

  it('should get current user profile', async () => {
    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(userId);
    expect(res.body.name).toBe('User');
  });

  it('should fail without token', async () => {
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(401);
  });

  it('should fail with invalid token', async () => {
    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer invalid_token`);
    expect(res.status).toBe(401);
  });
});
