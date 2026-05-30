import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/index';
import { resetDb } from '../../helpers/resetDb';

describe('Emergency Contacts E2E', () => {
  let token1: string;
  let user1Id: string;
  let user2Id: string;

  beforeEach(async () => {
    await resetDb();
    
    // Register User 1
    const res1 = await request(app).post('/api/v1/auth/register').send({
      name: 'User One',
      email: 'user1@example.com',
      password: 'Password123!',
    });
    token1 = res1.body.token;
    user1Id = res1.body.user.userId;

    // Register User 2
    const res2 = await request(app).post('/api/v1/auth/register').send({
      name: 'User Two',
      email: 'user2@example.com',
      password: 'Password123!',
    });
    user2Id = res2.body.user.userId;
  });

  it('should create an emergency contact', async () => {
    const res = await request(app)
      .post('/api/v1/users/me/emergency-contacts')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        contactId: user2Id,
        message: 'Help me!',
      });
    
    expect(res.status).toBe(201);
    expect(res.body.contactId).toBe(user2Id);
    expect(res.body.message).toBe('Help me!');
  });

  it('should get emergency contacts', async () => {
    await request(app)
      .post('/api/v1/users/me/emergency-contacts')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        contactId: user2Id,
        message: 'Help me!',
      });

    const res = await request(app)
      .get('/api/v1/users/me/emergency-contacts')
      .set('Authorization', `Bearer ${token1}`);
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].contactId).toBe(user2Id);
    expect(res.body[0].message).toBe('Help me!');
    expect(res.body[0].contact).toBeDefined();
    expect(res.body[0].contact.name).toBe('User Two');
  });

  it('should update an emergency contact if already exists', async () => {
    await request(app)
      .post('/api/v1/users/me/emergency-contacts')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        contactId: user2Id,
        message: 'Initial message',
      });

    const res = await request(app)
      .post('/api/v1/users/me/emergency-contacts')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        contactId: user2Id,
        message: 'Updated message',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Updated message');
  });

  it('should delete an emergency contact', async () => {
    await request(app)
      .post('/api/v1/users/me/emergency-contacts')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        contactId: user2Id,
        message: 'Help me!',
      });

    const delRes = await request(app)
      .delete(`/api/v1/users/me/emergency-contacts/${user2Id}`)
      .set('Authorization', `Bearer ${token1}`);
    
    expect(delRes.status).toBe(200);

    const getRes = await request(app)
      .get('/api/v1/users/me/emergency-contacts')
      .set('Authorization', `Bearer ${token1}`);
    
    expect(getRes.body).toHaveLength(0);
  });
});
