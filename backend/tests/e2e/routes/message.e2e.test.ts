import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/index';
import { resetDb } from '../../helpers/resetDb';
import { testPool } from '../../helpers/testPool';

describe('Message E2E', () => {
  let token: string;
  let userId: string;
  let roomId: string;

  beforeEach(async () => {
    await resetDb();
    const authRes = await request(app).post('/auth/register').send({
      name: 'User',
      email: 'user@example.com',
      password: 'Password123!',
    });
    token = authRes.body.token;
    userId = authRes.body.user.userId;

    const roomRes = await request(app)
      .post('/rooms/group')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'group',
        name: 'Message Test Room',
      });
    roomId = roomRes.body.roomId;
  });

  it('should list messages for a room', async () => {
    // Insert a dummy message directly into DB for testing the GET endpoint
    // (since send_message is handled via Socket.IO, not HTTP)
    await testPool.query(
      "INSERT INTO messages (room_id, sender_id, content) VALUES ($1, $2, 'Hello E2E!')",
      [roomId, userId]
    );

    const res = await request(app)
      .get(`/rooms/${roomId}/messages`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].content).toBe('Hello E2E!');
  });
});
