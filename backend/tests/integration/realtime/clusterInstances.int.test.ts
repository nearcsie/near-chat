import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { startCluster, call, type Cluster } from '../../helpers/clusterHarness';
import { testPool } from '../../helpers/testPool';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  MessageWithSender,
  FriendRequestEvent,
} from '../../../../shared/types';
import type { AuthResponse, RoomResponse, MessageResponse } from '../../helpers/responseTypes';

/**
 * Two backend instances, and the one thing neither existing tier can claim.
 *
 * `realtime/redisAdapter.int.test.ts` already proves a frame survives a real
 * `PUBLISH`/`SUBSCRIBE` between two `RedisManager`s — but it constructs bare
 * `Server`s and seats stand-in sockets straight into `nsp.sockets`, so nothing
 * between a REST call and a delivered frame is exercised. `tests/e2e` is the
 * opposite trade: the whole stack, but imported as `src/index`'s module
 * singleton, so there can only ever be one instance in it.
 *
 * What is under test here is the seam those two leave uncovered: a real HTTP
 * request to instance A goes through the real service and publisher, crosses
 * the cluster adapter, and arrives at a websocket client holding a session on
 * instance B — with both instances assembled by `bootstrap/*` under the
 * `require.main === module` gate, as a deployment assembles them.
 *
 * Instance B reaches Redis through a proxy the harness can sever, which is the
 * only way to reproduce what `redisAdapter.ts` documents: one instance losing
 * its subscriber while another keeps publishing. Redis pub/sub has no backlog,
 * so a frame published into that gap is gone for good; the contract being
 * pinned is that the subscription comes back, not that the frame does.
 */

type TestClient = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

/** Resolve on the next `event`, or reject once `timeoutMs` passes. */
const nextEvent = <K extends keyof ServerToClientEvents>(
  socket: TestClient,
  event: K,
  timeoutMs = 15_000,
): Promise<Parameters<ServerToClientEvents[K]>[0]> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler as never);
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for "${String(event)}"`));
    }, timeoutMs);
    const handler = (payload: unknown) => {
      clearTimeout(timer);
      resolve(payload as Parameters<ServerToClientEvents[K]>[0]);
    };
    socket.once(event, handler as never);
  });

interface Watch {
  /** Whatever arrived on the watched event, still undefined if nothing has. */
  received(): unknown;
  stop(): void;
}

/**
 * Start recording `event` now.
 *
 * Separate from the wait on purpose: a recorder attached *after* the call that
 * publishes has already missed a frame that was delivered promptly, so an
 * "it never arrived" assertion written that way can only ever pass.
 */
const watch = <K extends keyof ServerToClientEvents>(socket: TestClient, event: K): Watch => {
  let seen: unknown;
  const handler = (payload: unknown) => {
    if (seen === undefined) seen = payload;
  };
  socket.on(event, handler as never);
  return {
    received: () => seen,
    stop: () => socket.off(event, handler as never),
  };
};

describe('two backend instances over a real Redis', () => {
  // Namespaced per run so a crashed previous run's rows cannot be mistaken for
  // this one's, and so nothing here depends on `resetDb()` — truncating the
  // shared database while two child processes hold live pools would take out
  // whichever suite ran before this one.
  const run = `cluster-${Math.random().toString(36).slice(2, 10)}`;
  const email = (name: string): string => `${run}-${name}@example.com`;

  let cluster: Cluster;
  let alice: { token: string; userId: string };
  let bob: { token: string; userId: string };
  let roomId: string;
  let bobOnBeta: TestClient;

  const connect = (url: string, token: string): Promise<TestClient> =>
    new Promise((resolve, reject) => {
      const socket: TestClient = createClient(url, {
        auth: { token },
        forceNew: true,
        transports: ['websocket'],
        // A reconnect would re-run `restoreSubscriptions` on the server and
        // silently repair the subscription state this suite severs on purpose.
        reconnection: false,
      });
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });

  const register = async (name: string): Promise<{ token: string; userId: string }> => {
    const response = await call<AuthResponse>(cluster.alpha, 'POST', '/api/v1/auth/register', {
      body: { name, email: email(name), password: 'Password123!' },
    });
    expect(response.status).toBe(201);
    return { token: response.body.token, userId: response.body.user.userId };
  };

  const sendMessage = async (content: string): Promise<void> => {
    const response = await call<MessageResponse>(
      cluster.alpha,
      'POST',
      `/api/v1/rooms/${roomId}/messages`,
      {
        token: alice.token,
        body: { content },
        // Mandatory on this route; without it the call is a 400 that would look
        // like a delivery failure.
        headers: { 'Idempotency-Key': `${run}-${content}` },
      },
    );
    expect(response.status).toBe(201);
  };

  beforeAll(async () => {
    cluster = await startCluster();

    alice = await register('alice');
    bob = await register('bob');

    const room = await call<RoomResponse>(cluster.alpha, 'POST', '/api/v1/rooms', {
      token: alice.token,
      // `requireApproval` defaults to false, so joining by code makes bob a
      // full member. A pending member is filtered out of the room subscription
      // by `socketServer.ts`, and every room assertion here would fail with no
      // indication that membership was the reason.
      body: { type: 'group', name: `${run}-room` },
    });
    expect(room.status).toBe(201);
    roomId = room.body.roomId;

    const joined = await call<RoomResponse>(cluster.alpha, 'POST', '/api/v1/rooms/join', {
      token: bob.token,
      body: { inviteCode: room.body.inviteCode },
    });
    expect(joined.status).toBe(200);

    bobOnBeta = await connect(cluster.beta.url, bob.token);
    // Not `connect`: the server derives room subscriptions from durable
    // membership after the handshake and announces `realtime_ready` once they
    // are in place. Publishing before that races the join.
    await nextEvent(bobOnBeta, 'realtime_ready');
  }, 120_000);

  afterAll(async () => {
    bobOnBeta?.disconnect();
    await cluster?.stop();
    // Best effort, and scoped to this run's users; the room, membership and
    // messages follow by cascade.
    await testPool`DELETE FROM users WHERE email LIKE ${`${run}-%`}`.catch(() => {});
    // Two processes draining their HTTP servers and releasing presence leases
    // does not fit in the runner's 5s hook default.
  }, 60_000);

  it('delivers a room-targeted event published on the other instance', async () => {
    const delivered = nextEvent(bobOnBeta, 'new_message');

    await sendMessage('room event crosses');

    const message = (await delivered) as MessageWithSender;
    expect(message.content).toBe('room event crosses');
    expect(message.roomId).toBe(roomId);
  }, 60_000);

  it('delivers a user-targeted event published on the other instance', async () => {
    const delivered = nextEvent(bobOnBeta, 'friend_request');

    const request = await call(cluster.alpha, 'POST', '/api/v1/friend-requests', {
      token: alice.token,
      body: { targetUserId: bob.userId },
    });
    expect(request.status).toBe(201);

    const event = (await delivered) as FriendRequestEvent;
    expect(event.requesterId).toBe(alice.userId);
    expect(event.addresseeId).toBe(bob.userId);
  }, 60_000);

  it('rebuilds the subscription after its Redis link is cut and restored', async () => {
    // The subscriber count on this run's own channel is the fact itself, rather
    // than an inference from a delivery that could have been slow.
    expect(await cluster.subscriberCount()).toBe(2);

    cluster.proxy.cut();
    // Dropping to one is what makes the rest of this case non-vacuous: without
    // it, a "recovered" assertion would pass on a link that never broke.
    await cluster.waitForSubscribers(1);

    // Armed before the publish, so a frame that does arrive is caught. This is
    // also what keeps the whole suite honest: were bob's session actually on
    // the publishing instance, this delivery would be local, unaffected by the
    // cut, and recorded here.
    const duringCut = watch(bobOnBeta, 'new_message');
    await sendMessage('published into the gap');
    // Redis pub/sub keeps no backlog, so this frame is lost rather than
    // deferred. Pinned so that a future replay buffer has to be a deliberate
    // contract change rather than a silent one.
    await Bun.sleep(1_000);
    expect(duringCut.received()).toBeUndefined();
    duringCut.stop();

    cluster.proxy.heal();
    await cluster.waitForSubscribers(2);

    const delivered = nextEvent(bobOnBeta, 'new_message');
    await sendMessage('published after recovery');
    const message = (await delivered) as MessageWithSender;
    expect(message.content).toBe('published after recovery');
  }, 120_000);
});

