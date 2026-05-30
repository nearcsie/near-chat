import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/index';
import { resetDb } from '../../helpers/resetDb';
import { testPool } from '../../helpers/testPool';

describe('Friendships & Blocks E2E', () => {
  let tokenA: string;
  let userA: { userId: string; name: string };
  let tokenB: string;
  let userB: { userId: string; name: string };
  let tokenC: string;
  let userC: { userId: string; name: string };

  beforeEach(async () => {
    await resetDb();

    // Create User A
    const resA = await request(app).post('/api/v1/auth/register').send({
      name: 'User A',
      email: 'a@example.com',
      password: 'Password123!',
    });
    tokenA = resA.body.token;
    userA = resA.body.user;

    // Create User B
    const resB = await request(app).post('/api/v1/auth/register').send({
      name: 'User B',
      email: 'b@example.com',
      password: 'Password123!',
    });
    tokenB = resB.body.token;
    userB = resB.body.user;

    // Create User C
    const resC = await request(app).post('/api/v1/auth/register').send({
      name: 'User C',
      email: 'c@example.com',
      password: 'Password123!',
    });
    tokenC = resC.body.token;
    userC = resC.body.user;
  });

  describe('Friendships', () => {
    it('should send a friend request successfully', async () => {
      const res = await request(app)
        .post('/api/v1/friends/requests')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ target_user_id: userB.userId });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('pending');
    });

    it('should fail if sending a request to oneself', async () => {
      const res = await request(app)
        .post('/api/v1/friends/requests')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ target_user_id: userA.userId });

      expect(res.status).toBe(400);
    });

    it('should list pending friend requests', async () => {
      await request(app)
        .post('/api/v1/friends/requests')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ target_user_id: userB.userId });

      const res = await request(app)
        .get('/api/v1/friends/requests')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].requester_id).toBe(userA.userId);
    });

    it('should accept a friend request', async () => {
      // A sends request to B
      await request(app)
        .post('/api/v1/friends/requests')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ target_user_id: userB.userId });

      // B accepts
      const res = await request(app)
        .patch(`/api/v1/friends/requests/${userA.userId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ status: 'accepted' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('accepted');

      // Check friends list for B
      const listRes = await request(app)
        .get('/api/v1/friends')
        .set('Authorization', `Bearer ${tokenB}`);
      
      expect(listRes.status).toBe(200);
      expect(listRes.body.length).toBe(1);
      expect(listRes.body[0].user_id).toBe(userA.userId);
    });
  });

  describe('Blocks', () => {
    it('should block a user', async () => {
      const res = await request(app)
        .post('/api/v1/blocks')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ target_user_id: userC.userId });

      expect(res.status).toBe(201);
    });

    it('should not allow sending a friend request to a blocked user', async () => {
      // A blocks C
      await request(app)
        .post('/api/v1/blocks')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ target_user_id: userC.userId });

      // C tries to friend A
      const res = await request(app)
        .post('/api/v1/friends/requests')
        .set('Authorization', `Bearer ${tokenC}`)
        .send({ target_user_id: userA.userId });

      expect(res.status).toBe(403);
    });
  });
});
