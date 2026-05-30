import { AddressInfo } from 'net';
import request from 'supertest';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app, server } from '../../../src/index';
import { resetDb } from '../../helpers/resetDb';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../../shared/types';

type TestClient = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

const waitFor = <T>(socket: TestClient, event: keyof ServerToClientEvents): Promise<T> =>
  new Promise((resolve) => {
    socket.once(event, (payload) => resolve(payload as T));
  });

describe('Emergency alert Socket.IO E2E', () => {
  let url: string;
  let clients: TestClient[] = [];

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      if (server.listening) return resolve();
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address() as AddressInfo;
    url = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(async () => {
    clients.forEach((socket) => socket.disconnect());
    clients = [];
    await resetDb();
  });

  afterAll(async () => {
    clients.forEach((socket) => socket.disconnect());
    if (server.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  const connectClient = (token: string): Promise<TestClient> =>
    new Promise((resolve, reject) => {
      const socket: TestClient = createClient(url, {
        auth: { token },
        forceNew: true,
        transports: ['websocket'],
      });
      clients.push(socket);
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });

  it('emits emergency_alert to configured emergency contacts', async () => {
    const userRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Alert User',
      email: 'alert-user@example.com',
      password: 'Password123!',
    });
    const contactRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Contact User',
      email: 'contact-user@example.com',
      password: 'Password123!',
    });

    await request(app)
      .post('/api/v1/users/me/emergency-contacts')
      .set('Authorization', `Bearer ${userRes.body.token}`)
      .send({
        contactId: contactRes.body.user.userId,
        message: 'Please check on me',
      });

    const contactSocket = await connectClient(contactRes.body.token);
    const alertPayload = waitFor<Parameters<ServerToClientEvents['emergency_alert']>[0]>(
      contactSocket,
      'emergency_alert',
    );

    const triggerRes = await request(app)
      .post('/api/v1/users/me/emergency-alert')
      .set('Authorization', `Bearer ${userRes.body.token}`)
      .send();

    expect(triggerRes.status).toBe(202);
    await expect(alertPayload).resolves.toEqual({
      userId: userRes.body.user.userId,
      message: 'Please check on me',
    });
  });
});
