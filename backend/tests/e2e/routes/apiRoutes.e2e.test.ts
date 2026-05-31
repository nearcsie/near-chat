import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../helpers/resetDb';
import { testPool } from '../../helpers/testPool';

let app: Express.Application;
let appPool: typeof import('../../../src/db').default;

const registerUser = async (name = 'E2E User') => {
  const email = `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, name, password: 'password123' })
    .expect(201);

  return {
    email,
    token: response.body.token as string,
    userId: response.body.user.userId as string,
  };
};

describe('API routes E2E', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
    const indexModule = await import('../../../src/index');
    const dbModule = await import('../../../src/db');
    app = indexModule.app;
    appPool = dbModule.default;
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await appPool.end();
    await testPool.end();
  });

  it('covers auth routes', async () => {
    const email = `auth-${Date.now()}@example.com`;

    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, name: 'Auth User', password: 'password123' })
      .expect(201);
    expect(register.headers['x-content-type-options']).toBe('nosniff');
    expect(register.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(register.headers['content-security-policy']).toContain("default-src 'self'");
    expect(register.body).toMatchObject({
      token: expect.any(String),
      user: { name: 'Auth User' },
    });
    expect(register.body.user).not.toHaveProperty('passwordHash');

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);

    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${register.body.token}`)
      .expect(204);
  });

  it('covers authenticated user routes', async () => {
    const user = await registerUser('Searchable User');

    await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ userId: user.userId, name: 'Searchable User' });
      });

    await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Updated User' })
      .expect(200)
      .expect((response) => {
        expect(response.body.name).toBe('Updated User');
      });

    await request(app)
      .get('/api/v1/users/search?query=Updated')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body[0]).toMatchObject({ name: 'Updated User' });
      });
  });

  it('covers room and message routes', async () => {
    const user = await registerUser();

    await request(app)
      .get('/api/v1/rooms')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual([]);
      });

    const roomResponse = await request(app)
      .post('/api/v1/rooms/group')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'E2E Room' })
      .expect(201);
    const roomId = roomResponse.body.roomId as string;

    await request(app)
      .get('/api/v1/rooms')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(1);
      });

    await request(app)
      .get(`/api/v1/rooms/${roomId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ roomId, name: 'E2E Room' });
      });

    await request(app)
      .patch(`/api/v1/rooms/${roomId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Renamed E2E Room' })
      .expect(200)
      .expect((response) => {
        expect(response.body.name).toBe('Renamed E2E Room');
      });

    await request(app)
      .post('/api/v1/rooms/join/not-a-code')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(404);

    await request(app)
      .delete(`/api/v1/rooms/${roomId}/leave`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(403);

    await request(app)
      .get(`/api/v1/rooms/${roomId}/messages`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual([]);
      });
  });

  it('rejects unauthenticated protected routes', async () => {
    await request(app).get('/api/v1/users/me').expect(401);
    await request(app).get('/api/v1/rooms').expect(401);
    await request(app).get('/api/v1/rooms/room-1/messages').expect(401);
  });
});
