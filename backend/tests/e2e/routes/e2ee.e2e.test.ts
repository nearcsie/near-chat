import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { resetDb } from '../../helpers/resetDb';
import { testPool } from '../../helpers/testPool';

let app: any;

const PUBLIC_KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A'.repeat(4);
const ENCRYPTED_KEY = 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo'.repeat(2);

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  const indexModule = await import('../../../src/index');
  app = indexModule.app;
});

describe('E2EE key exchange E2E', () => {
  let tokenA: string;
  let userA: string;
  let tokenB: string;
  let userB: string;
  let roomId: string;

  beforeEach(async () => {
    await resetDb();

    const resA = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'Password123!',
    });
    tokenA = resA.body.token;
    userA = resA.body.user.userId;

    const resB = await request(app).post('/api/v1/auth/register').send({
      name: 'Bob',
      email: 'bob@example.com',
      password: 'Password123!',
    });
    tokenB = resB.body.token;
    userB = resB.body.user.userId;

    const roomRes = await request(app)
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ type: 'group', name: 'E2EE Room' });
    roomId = roomRes.body.roomId;

    await testPool.query(
      "INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, 'member')",
      [roomId, userB],
    );
  });

  it('uploads and fetches a public key', async () => {
    const putRes = await request(app)
      .put('/api/v1/users/me/public-key')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ publicKey: PUBLIC_KEY });

    expect(putRes.status).toBe(200);
    expect(putRes.body.publicKey).toBe(PUBLIC_KEY);

    const getRes = await request(app)
      .get(`/api/v1/users/${userA}/public-key`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual({ userId: userA, publicKey: PUBLIC_KEY });
  });

  it('returns null publicKey for users that have not enrolled', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${userB}/public-key`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.publicKey).toBeNull();
  });

  it('rejects malformed public keys', async () => {
    const res = await request(app)
      .put('/api/v1/users/me/public-key')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ publicKey: 'not base64 !!!' });

    expect(res.status).toBe(400);
  });

  it('distributes room keys to members and lets each member fetch their own', async () => {
    const distRes = await request(app)
      .post(`/api/v1/rooms/${roomId}/keys`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        keys: [
          { userId: userA, encryptedKey: ENCRYPTED_KEY },
          { userId: userB, encryptedKey: `${ENCRYPTED_KEY}aa==` },
        ],
      });

    expect(distRes.status).toBe(201);
    expect(distRes.body.distributed.sort()).toEqual([userA, userB].sort());

    const myKeyRes = await request(app)
      .get(`/api/v1/rooms/${roomId}/keys/me`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(myKeyRes.status).toBe(200);
    expect(myKeyRes.body.encryptedKey).toBe(`${ENCRYPTED_KEY}aa==`);
  });

  it('never overwrites an already-distributed room key', async () => {
    await request(app)
      .post(`/api/v1/rooms/${roomId}/keys`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ keys: [{ userId: userB, encryptedKey: ENCRYPTED_KEY }] });

    const second = await request(app)
      .post(`/api/v1/rooms/${roomId}/keys`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ keys: [{ userId: userB, encryptedKey: `${ENCRYPTED_KEY}aa==` }] });

    expect(second.status).toBe(201);
    expect(second.body.distributed).toEqual([]);

    const myKeyRes = await request(app)
      .get(`/api/v1/rooms/${roomId}/keys/me`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(myKeyRes.body.encryptedKey).toBe(ENCRYPTED_KEY);
  });

  it('reports member key status for distribution', async () => {
    await request(app)
      .put('/api/v1/users/me/public-key')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ publicKey: PUBLIC_KEY });

    await request(app)
      .post(`/api/v1/rooms/${roomId}/keys`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ keys: [{ userId: userA, encryptedKey: ENCRYPTED_KEY }] });

    const res = await request(app)
      .get(`/api/v1/rooms/${roomId}/keys`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const byUser = Object.fromEntries(res.body.map((row: any) => [row.userId, row]));
    expect(byUser[userA]).toMatchObject({ hasRoomKey: true, publicKey: null });
    expect(byUser[userB]).toMatchObject({ hasRoomKey: false, publicKey: PUBLIC_KEY });
  });

  it('returns 404 when no room key has been distributed to the caller', async () => {
    const res = await request(app)
      .get(`/api/v1/rooms/${roomId}/keys/me`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it('rejects key access from non-members', async () => {
    const outsider = await request(app).post('/api/v1/auth/register').send({
      name: 'Eve',
      email: 'eve@example.com',
      password: 'Password123!',
    });

    const res = await request(app)
      .get(`/api/v1/rooms/${roomId}/keys/me`)
      .set('Authorization', `Bearer ${outsider.body.token}`);
    expect(res.status).toBe(403);

    const distRes = await request(app)
      .post(`/api/v1/rooms/${roomId}/keys`)
      .set('Authorization', `Bearer ${outsider.body.token}`)
      .send({ keys: [{ userId: outsider.body.user.userId, encryptedKey: ENCRYPTED_KEY }] });
    expect(distRes.status).toBe(403);
  });

  it('rejects distributing keys to non-members', async () => {
    const outsider = await request(app).post('/api/v1/auth/register').send({
      name: 'Eve',
      email: 'eve@example.com',
      password: 'Password123!',
    });

    const res = await request(app)
      .post(`/api/v1/rooms/${roomId}/keys`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ keys: [{ userId: outsider.body.user.userId, encryptedKey: ENCRYPTED_KEY }] });

    expect(res.status).toBe(400);
  });

  it('stores ciphertext envelopes untouched in the messages table', async () => {
    const envelope = 'E2E.v1:aXZpdml2aXZpdml2:Y2lwaGVydGV4dGNpcGhlcnRleHQ=';
    await testPool.query('INSERT INTO messages (room_id, sender_id, content) VALUES ($1, $2, $3)', [
      roomId,
      userA,
      envelope,
    ]);

    const res = await request(app)
      .get(`/api/v1/rooms/${roomId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body[0].content).toBe(envelope);

    const dbRow = await testPool.query('SELECT content FROM messages WHERE room_id = $1', [roomId]);
    expect(dbRow.rows[0].content).toBe(envelope);
  });
});
