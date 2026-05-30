import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
let app: any;
import { resetDb } from '../../helpers/resetDb';

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  const indexModule = await import('../../../src/index');
  app = indexModule.app;
});

describe('Auth E2E', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('should register a new user successfully', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
    });
    if (res.status !== 201) throw new Error("RES: " + JSON.stringify(res.body));
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.name).toBe('Test User');
  });

  it('should fail registration if email is duplicate', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
    });
    
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Another User',
      email: 'test@example.com',
      password: 'Password123!',
    });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/duplicate|already exists|already in use/i);
  });

  it('should login an existing user', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
    });

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'test@example.com',
      password: 'Password123!',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('should fail login with incorrect password', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
    });

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'test@example.com',
      password: 'WrongPassword!',
    });
    expect(res.status).toBe(400);
  });
});
