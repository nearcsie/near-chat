import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'bun:test';
import { AddressInfo } from 'net';
import { request } from '../../helpers/http';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { honoApp as app, server } from '../../../src/index';
import { resetDb } from '../../helpers/resetDb';
import type { ClientToServerEvents, FriendRequestEvent, RtcSignalEvent, ServerToClientEvents } from '../../../../shared/types';
import type { AuthResponse } from '../../helpers/responseTypes';

type TestClient = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

describe('Call signaling Socket.IO E2E', () => {
  let url: string;
  let clients: TestClient[] = [];

  // The server is a process-wide singleton shared with the other socket E2E
  // file. That file closes it when it finishes, and the close drains for up to
  // ten seconds (`bootstrap/realtime.ts`), during which `listen` refuses — so
  // this file waits out such a drain if it runs second, and leaves the server
  // listening rather than starting a drain of its own if it runs first.
  beforeAll(async () => {
    for (let attempt = 0; !server.listening; attempt++) {
      try {
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      } catch (error) {
        if (attempt >= 120) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    const address = server.address() as AddressInfo;
    url = `http://127.0.0.1:${address.port}`;
  }, 15_000);

  beforeEach(async () => {
    clients.forEach((socket) => socket.disconnect());
    clients = [];
    await resetDb();
  });

  afterAll(() => {
    clients.forEach((socket) => {
      try { socket.disconnect(); } catch (e) {}
    });
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

  const register = async (name: string) => {
    const res = await request(app).post<AuthResponse>('/api/v1/auth/register').send({
      name,
      email: `${name.toLowerCase()}-rtc@example.com`,
      password: 'Password123!',
    });
    return { token: res.body.token, userId: res.body.user.userId };
  };

  const befriend = async (a: { token: string; userId: string }, b: { token: string; userId: string }) => {
    await request(app).post('/api/v1/friend-requests').set('Authorization', `Bearer ${a.token}`).send({
      target_user_id: b.userId,
    });
    await request(app).patch(`/api/v1/friend-requests/${a.userId}`).set('Authorization', `Bearer ${b.token}`).send({
      status: 'accepted',
    });
  };

  const collect = (socket: TestClient) => {
    const seen: RtcSignalEvent[] = [];
    socket.on('rtc_signal', (event) => seen.push(event));
    return seen;
  };

  it('relays an invite between friends with the sender derived by the server', async () => {
    const alice = await register('Alice');
    const bob = await register('Bob');
    await befriend(alice, bob);
    const aliceSocket = await connectClient(alice.token);
    const bobSocket = await connectClient(bob.token);
    const received = new Promise<RtcSignalEvent>((resolve) => bobSocket.once('rtc_signal', resolve));

    const ack = await aliceSocket.emitWithAck('rtc_signal', {
      kind: 'invite',
      callId: 'call-1',
      targetUserId: bob.userId,
      media: 'audio',
      fromUserId: bob.userId,
    } as Parameters<ClientToServerEvents['rtc_signal']>[0]);

    expect(ack).toEqual({ ok: true });
    expect(await received).toStrictEqual({
      kind: 'invite',
      callId: 'call-1',
      targetUserId: bob.userId,
      media: 'audio',
      fromUserId: alice.userId,
    });
  });

  it('refuses a non-friend through the ack and delivers nothing', async () => {
    const alice = await register('Alice');
    const carol = await register('Carol');
    const aliceSocket = await connectClient(alice.token);
    const carolSocket = await connectClient(carol.token);
    const seenByCarol = collect(carolSocket);

    const ack = await aliceSocket.emitWithAck('rtc_signal', {
      kind: 'invite',
      callId: 'call-1',
      targetUserId: carol.userId,
      media: 'video',
    });

    expect(ack).toEqual({
      ok: false,
      error: { statusCode: 403, message: 'Cannot interact with this user', code: 'FORBIDDEN' },
    });
    await settle();
    expect(seenByCarol).toEqual([]);
  });

  it('refuses both directions once a block lands, but still lets a hangup through', async () => {
    const alice = await register('Alice');
    const bob = await register('Bob');
    await befriend(alice, bob);
    const aliceSocket = await connectClient(alice.token);
    const bobSocket = await connectClient(bob.token);
    const seenByBob = collect(bobSocket);

    const blocked = await request(app)
      .post('/api/v1/blocks')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ targetUserId: alice.userId });
    expect(blocked.status).toBe(201);

    const fromBlocked = await aliceSocket.emitWithAck('rtc_signal', {
      kind: 'invite', callId: 'call-1', targetUserId: bob.userId, media: 'audio',
    });
    const fromBlocker = await bobSocket.emitWithAck('rtc_signal', {
      kind: 'invite', callId: 'call-2', targetUserId: alice.userId, media: 'audio',
    });
    const hangup = await aliceSocket.emitWithAck('rtc_signal', {
      kind: 'end', callId: 'call-1', targetUserId: bob.userId, reason: 'hangup',
    });

    expect(fromBlocked).toMatchObject({ ok: false, error: { statusCode: 403, message: 'Cannot interact with this user' } });
    expect(fromBlocker).toMatchObject({ ok: false, error: { statusCode: 403, message: 'Cannot interact with this user' } });
    expect(hangup).toEqual({ ok: true });
    await settle();
    expect(seenByBob.map((event) => event.kind)).toEqual(['end']);
  });

  it('tells the actor\'s other sessions when they remove a friend', async () => {
    const alice = await register('Alice');
    const bob = await register('Bob');
    await befriend(alice, bob);
    const aliceOtherTab = await connectClient(alice.token);
    const notified = new Promise<FriendRequestEvent>((resolve) => aliceOtherTab.once('friend_request', resolve));

    const removed = await request(app)
      .delete(`/api/v1/friends/${bob.userId}`)
      .set('Authorization', `Bearer ${alice.token}`);

    expect(removed.status).toBeLessThan(300);
    expect(await notified).toMatchObject({ requesterId: alice.userId, addresseeId: bob.userId, status: 'deleted' });
  });
});
