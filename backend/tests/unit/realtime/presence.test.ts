import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { createPresenceTracker, type PresenceTracker } from '../../../src/realtime/presence';
import type { PresenceStore } from '../../../src/realtime/presenceStore';
import type { RedisOutcome } from '../../../src/utils/redis';
import type { ChatServer } from '../../../src/realtime/authSocket';

/**
 * One shared lease table, viewed through as many instances as a test needs.
 *
 * Modelled as intentions rather than as Redis commands, which is the point of
 * the `PresenceStore` seam: the fake has to be faithful about *who holds a
 * lease*, and nothing else. Expiry, hash-field TTLs and the atomicity of the
 * transitions are Redis's semantics, and they are pinned against a real server
 * in `tests/integration/realtime/presenceStore.test.ts` rather than guessed at
 * here.
 */
const makeSharedLeases = () => {
  const holders = new Map<string, Set<string>>();
  let failing = false;

  const down = <T>(): RedisOutcome<T> => ({ ok: false, error: new Error('redis unavailable') });

  const viewFor = (instanceId: string): PresenceStore => ({
    async hold(userId) {
      if (failing) return down<number>();
      const set = holders.get(userId) ?? new Set<string>();
      const before = set.size;
      set.add(instanceId);
      holders.set(userId, set);
      return { ok: true, value: before };
    },
    async release(userId) {
      if (failing) return down<number>();
      const set = holders.get(userId);
      if (!set) return { ok: true, value: 0 };
      set.delete(instanceId);
      if (set.size === 0) holders.delete(userId);
      return { ok: true, value: set.size };
    },
    async isOnline(userId) {
      if (failing) return down<boolean>();
      return { ok: true, value: (holders.get(userId)?.size ?? 0) > 0 };
    },
    async areOnline(userIds) {
      if (failing) return down<Set<string>>();
      return {
        ok: true,
        value: new Set(userIds.filter((id) => (holders.get(id)?.size ?? 0) > 0)),
      };
    },
    async onlineUsers() {
      if (failing) return down<string[]>();
      return { ok: true, value: [...holders.keys()] };
    },
  });

  return {
    holders,
    viewFor,
    breakRedis: () => {
      failing = true;
    },
    healRedis: () => {
      failing = false;
    },
  };
};

const makeIo = () => {
  const roomEmit = mock();
  const io = { to: mock(() => ({ emit: roomEmit })) } as unknown as ChatServer;
  return { io, roomEmit };
};

describe('presence tracker', () => {
  let io: ChatServer;
  let roomEmit: ReturnType<typeof mock>;
  let friendRepo: { getFriends: ReturnType<typeof mock> };
  let tracker: PresenceTracker;

  beforeEach(() => {
    ({ io, roomEmit } = makeIo());
    friendRepo = {
      getFriends: mock().mockResolvedValue([
        { friend: { userId: 'friend-1' } },
        { friend: { userId: 'friend-2' } },
      ]),
    };
    tracker = createPresenceTracker({ graceMs: () => 0 });
  });

  describe('without a store (single node)', () => {
    it('tracks connection, reports online status, and notifies online friends', async () => {
      expect(await tracker.isUserOnline('user-1')).toBe(false);

      await tracker.trackUserConnection(io, 'friend-1', 'socket-friend', friendRepo);
      expect(await tracker.isUserOnline('friend-1')).toBe(true);

      await tracker.trackUserConnection(io, 'user-1', 'socket-1', friendRepo);
      expect(await tracker.isUserOnline('user-1')).toBe(true);
      expect(await tracker.getOnlineUsers()).toContain('user-1');

      // Both friends are addressed in one broadcast, friend-2 included: whether
      // a session exists for a room is the adapter's question, not this
      // module's, and answering it here is what used to lose the friends
      // connected to another instance.
      expect(io.to).toHaveBeenCalledWith(['user_friend-1', 'user_friend-2']);
      expect(roomEmit).toHaveBeenCalledWith('user_status', { userId: 'user-1', status: 'online' });
    });

    it('handles trackUserDisconnection gracefully when userId was never tracked', async () => {
      await expect(
        tracker.trackUserDisconnection(io, 'unknown-user', 'socket-1', friendRepo),
      ).resolves.toBeUndefined();
    });

    it('suppresses and logs errors from getFriends during trackUserConnection', async () => {
      const errorRepo = { getFriends: mock().mockRejectedValue(new Error('DB down')) };
      const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        tracker.trackUserConnection(io, 'user-x', 'socket-1', errorRepo),
      ).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('suppresses and logs errors from getFriends during trackUserDisconnection', async () => {
      await tracker.trackUserConnection(io, 'user-y', 'socket-1', friendRepo);
      const errorRepo = { getFriends: mock().mockRejectedValue(new Error('DB down')) };
      const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        tracker.trackUserDisconnection(io, 'user-y', 'socket-1', errorRepo),
      ).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('handles multiple socket connections per user and tracks disconnection', async () => {
      await tracker.trackUserConnection(io, 'user-1', 'socket-tab-1', friendRepo);
      await tracker.trackUserConnection(io, 'user-1', 'socket-tab-2', friendRepo);

      expect(await tracker.isUserOnline('user-1')).toBe(true);

      await tracker.trackUserDisconnection(io, 'user-1', 'socket-tab-1', friendRepo);
      expect(await tracker.isUserOnline('user-1')).toBe(true);
      expect(roomEmit).not.toHaveBeenCalledWith('user_status', {
        userId: 'user-1',
        status: 'offline',
      });

      await tracker.trackUserConnection(io, 'friend-1', 'socket-friend', friendRepo);
      roomEmit.mockClear();

      await tracker.trackUserDisconnection(io, 'user-1', 'socket-tab-2', friendRepo);
      expect(await tracker.isUserOnline('user-1')).toBe(false);
      expect(io.to).toHaveBeenCalledWith(['user_friend-1', 'user_friend-2']);
      expect(roomEmit).toHaveBeenCalledWith('user_status', { userId: 'user-1', status: 'offline' });
    });

    /**
     * Without a store there is no cluster adapter either, so `io.to()` reaches
     * only this process's sockets — and `index.ts` disconnects those before it
     * stops presence. Nobody left to tell, and two Postgres queries per held
     * user to tell them.
     */
    it('announces nothing on shutdown, because its only audience was its own sockets', async () => {
      await tracker.trackUserConnection(io, 'user-1', 'socket-1', friendRepo);
      roomEmit.mockClear();

      await tracker.stop();

      expect(roomEmit).not.toHaveBeenCalled();
    });

    it('answers offline rather than unknown, because one process is the whole deployment', async () => {
      expect(await tracker.presenceOf('nobody')).toBe('offline');
    });
  });

  describe('across instances', () => {
    let leases: ReturnType<typeof makeSharedLeases>;
    let alpha: PresenceTracker;
    let beta: PresenceTracker;
    let betaIo: ChatServer;
    let betaEmit: ReturnType<typeof mock>;

    beforeEach(() => {
      leases = makeSharedLeases();
      alpha = createPresenceTracker({ store: leases.viewFor('alpha'), graceMs: () => 0 });
      const second = makeIo();
      betaIo = second.io;
      betaEmit = second.roomEmit;
      beta = createPresenceTracker({ store: leases.viewFor('beta'), graceMs: () => 0 });
    });

    /**
     * Seats the same friend on both instances.
     *
     * `broadcastStatus` no longer asks who is reachable — it addresses every
     * friend's room and lets the adapter deliver (#476) — so this is no longer
     * what makes the transitions observable. It stays because the transitions
     * under test here are about *which instance announces them*, and a friend
     * present on both keeps that question separate from where the audience sits.
     */
    const seatAudience = async () => {
      await alpha.trackUserConnection(io, 'friend-1', 'socket-f-a', friendRepo);
      await beta.trackUserConnection(betaIo, 'friend-1', 'socket-f-b', friendRepo);
      roomEmit.mockClear();
      betaEmit.mockClear();
    };

    it('announces online only for the first connection anywhere', async () => {
      await seatAudience();

      await alpha.trackUserConnection(io, 'user-1', 'socket-a', friendRepo);
      expect(roomEmit).toHaveBeenCalledWith('user_status', { userId: 'user-1', status: 'online' });

      // The same user arriving on a second instance is not a new arrival.
      await beta.trackUserConnection(betaIo, 'user-1', 'socket-b', friendRepo);
      expect(betaEmit).not.toHaveBeenCalledWith('user_status', {
        userId: 'user-1',
        status: 'online',
      });
    });

    it('does not announce offline while another instance still holds a connection', async () => {
      await seatAudience();
      await alpha.trackUserConnection(io, 'user-1', 'socket-a', friendRepo);
      await beta.trackUserConnection(betaIo, 'user-1', 'socket-b', friendRepo);
      roomEmit.mockClear();
      betaEmit.mockClear();

      await alpha.trackUserDisconnection(io, 'user-1', 'socket-a', friendRepo);
      expect(roomEmit).not.toHaveBeenCalledWith('user_status', {
        userId: 'user-1',
        status: 'offline',
      });
      // ...and the instance that lost the socket still reports the user online,
      // because the other one answered for them.
      expect(await alpha.isUserOnline('user-1')).toBe(true);

      await beta.trackUserDisconnection(betaIo, 'user-1', 'socket-b', friendRepo);
      expect(betaEmit).toHaveBeenCalledWith('user_status', { userId: 'user-1', status: 'offline' });
      expect(await alpha.isUserOnline('user-1')).toBe(false);
    });

    it('reports a user connected elsewhere as online', async () => {
      await beta.trackUserConnection(betaIo, 'user-1', 'socket-b', friendRepo);
      expect(await alpha.isUserOnline('user-1')).toBe(true);
      expect(await alpha.getOnlineUsers()).toContain('user-1');
    });

    /**
     * The defect #476 names: the friend's only session is on the *other*
     * instance, which is the one case the old `isLocallyOnline` gate could not
     * see. It emitted nothing at all, so the adapter had nothing to carry and
     * the friend learned of the change only on their next `GET /friends`.
     */
    it('announces to a friend whose only session is on another instance', async () => {
      // Deliberately nobody on alpha: no local socket for either friend.
      await beta.trackUserConnection(betaIo, 'friend-1', 'socket-f-b', friendRepo);
      roomEmit.mockClear();
      betaEmit.mockClear();

      await alpha.trackUserConnection(io, 'user-1', 'socket-a', friendRepo);

      expect(io.to).toHaveBeenCalledWith(['user_friend-1', 'user_friend-2']);
      expect(roomEmit).toHaveBeenCalledWith('user_status', { userId: 'user-1', status: 'online' });

      roomEmit.mockClear();
      await alpha.trackUserDisconnection(io, 'user-1', 'socket-a', friendRepo);
      expect(roomEmit).toHaveBeenCalledWith('user_status', { userId: 'user-1', status: 'offline' });
    });

    /**
     * `Adapter#apply` reads an empty room set as the whole namespace, so an
     * unguarded `io.to([])` would broadcast a friendless user's presence to
     * every connected client in the cluster. The guard is the only thing
     * standing between this change and that, so it is pinned here.
     */
    it('says nothing at all for a user with no friends', async () => {
      const friendless = { getFriends: mock().mockResolvedValue([]) };

      await alpha.trackUserConnection(io, 'loner', 'socket-a', friendless);
      await alpha.trackUserDisconnection(io, 'loner', 'socket-a', friendless);

      expect(io.to).not.toHaveBeenCalled();
      expect(roomEmit).not.toHaveBeenCalled();
    });

    /**
     * The push no longer consults Redis, so the window where the command
     * connection is down while the publisher carrying the frame is healthy —
     * two independently supervised connections — no longer costs every remote
     * friend their notification.
     */
    it('still announces when the presence store cannot be reached', async () => {
      await beta.trackUserConnection(betaIo, 'friend-1', 'socket-f-b', friendRepo);
      await alpha.trackUserConnection(io, 'user-1', 'socket-a', friendRepo);
      roomEmit.mockClear();
      leases.breakRedis();

      await alpha.trackUserDisconnection(io, 'user-1', 'socket-a', friendRepo);

      expect(io.to).toHaveBeenCalledWith(['user_friend-1', 'user_friend-2']);
      expect(roomEmit).toHaveBeenCalledWith('user_status', { userId: 'user-1', status: 'offline' });
    });

    it('resolves a whole page of users in one read', async () => {
      await beta.trackUserConnection(betaIo, 'user-1', 'socket-b', friendRepo);
      await alpha.trackUserConnection(io, 'user-2', 'socket-a', friendRepo);

      const online = await alpha.onlineAmong(['user-1', 'user-2', 'user-3']);
      expect([...online].sort()).toEqual(['user-1', 'user-2']);
    });

    it('holds the lease through the reconnect grace period, wherever the reconnect lands', async () => {
      const gracefulAlpha = createPresenceTracker({
        store: leases.viewFor('alpha'),
        graceMs: () => 50,
      });
      await gracefulAlpha.trackUserConnection(io, 'user-1', 'socket-a', friendRepo);
      roomEmit.mockClear();

      await gracefulAlpha.trackUserDisconnection(io, 'user-1', 'socket-a', friendRepo);
      // Still leased: another instance must not see a gap during the grace window.
      expect(await beta.isUserOnline('user-1')).toBe(true);

      // The reconnect lands on the *other* instance, which is exactly the case a
      // local grace timer cannot see.
      await beta.trackUserConnection(betaIo, 'user-1', 'socket-b', friendRepo);
      expect(betaEmit).not.toHaveBeenCalledWith('user_status', {
        userId: 'user-1',
        status: 'online',
      });

      await new Promise((resolve) => setTimeout(resolve, 80));
      // The grace timer fired on alpha and dropped alpha's lease — but beta is
      // holding one, so nobody was told the user went offline.
      expect(roomEmit).not.toHaveBeenCalledWith('user_status', {
        userId: 'user-1',
        status: 'offline',
      });
      expect(await beta.isUserOnline('user-1')).toBe(true);
    });

    it('hands leases back on shutdown instead of waiting out the TTL', async () => {
      await alpha.trackUserConnection(io, 'user-1', 'socket-a', friendRepo);
      expect(leases.holders.get('user-1')?.has('alpha')).toBe(true);

      await alpha.stop();
      expect(leases.holders.has('user-1')).toBe(false);
    });

    /**
     * The defect #654 names. Handing the lease back makes `isUserOnline` right
     * on every instance, but nobody asks it: the friend's client applies what
     * it is pushed, so without an announcement it holds a stale `online` until
     * its next `GET /api/v1/friends`.
     */
    describe('when the instance itself leaves', () => {
      it('announces offline for the users it was the last to hold', async () => {
        await beta.trackUserConnection(betaIo, 'friend-1', 'socket-f-b', friendRepo);
        await alpha.trackUserConnection(io, 'user-1', 'socket-a', friendRepo);
        roomEmit.mockClear();

        await alpha.stop();

        expect(io.to).toHaveBeenCalledWith(['user_friend-1', 'user_friend-2']);
        expect(roomEmit).toHaveBeenCalledWith('user_status', {
          userId: 'user-1',
          status: 'offline',
        });
      });

      /**
       * The shape a real SIGTERM takes: `index.ts` disconnects every local
       * socket before it stops presence, so with a non-zero grace period the
       * users are in `pendingDisconnects` — held, but with no socket — by the
       * time `stop()` runs. A test that connects and stops immediately never
       * exercises this.
       */
      it('announces for a user still inside the reconnect grace period', async () => {
        const gracefulAlpha = createPresenceTracker({
          store: leases.viewFor('alpha'),
          graceMs: () => 50_000,
        });
        await gracefulAlpha.trackUserConnection(io, 'user-1', 'socket-a', friendRepo);
        await gracefulAlpha.trackUserDisconnection(io, 'user-1', 'socket-a', friendRepo);
        roomEmit.mockClear();

        await gracefulAlpha.stop();

        expect(roomEmit).toHaveBeenCalledTimes(1);
        expect(roomEmit).toHaveBeenCalledWith('user_status', {
          userId: 'user-1',
          status: 'offline',
        });
        expect(leases.holders.has('user-1')).toBe(false);
      });

      it('says nothing for a user another instance still holds', async () => {
        await alpha.trackUserConnection(io, 'user-1', 'socket-a', friendRepo);
        await beta.trackUserConnection(betaIo, 'user-1', 'socket-b', friendRepo);
        roomEmit.mockClear();

        await alpha.stop();

        expect(roomEmit).not.toHaveBeenCalledWith('user_status', {
          userId: 'user-1',
          status: 'offline',
        });
        expect(await beta.isUserOnline('user-1')).toBe(true);
      });

      /**
       * A release Redis never acknowledged left the lease in place to expire on
       * its TTL, so there is nothing to announce the end of. Announcing anyway
       * would report every held user offline at once during a command outage —
       * and the surviving lease would then swallow their next `online`.
       * `releaseUser` still reads `!result.ok` as gone everywhere; #653 owns
       * bringing the two under one policy, and this test is what a change of
       * policy has to come back and update.
       */
      it('announces nothing when Redis never confirmed the release', async () => {
        await alpha.trackUserConnection(io, 'user-1', 'socket-a', friendRepo);
        roomEmit.mockClear();
        leases.breakRedis();

        await alpha.stop();

        expect(roomEmit).not.toHaveBeenCalled();
      });

      /** The `io.to([])` guard, reached in a loop by the new path. */
      it('never addresses an empty room list', async () => {
        const friendless = { getFriends: mock().mockResolvedValue([]) };
        await alpha.trackUserConnection(io, 'loner', 'socket-a', friendless);

        await alpha.stop();

        expect(io.to).not.toHaveBeenCalled();
        expect(roomEmit).not.toHaveBeenCalled();
      });

      it('announces once however many times it is stopped', async () => {
        await alpha.trackUserConnection(io, 'user-1', 'socket-a', friendRepo);
        roomEmit.mockClear();

        await alpha.stop();
        await alpha.stop();

        expect(roomEmit).toHaveBeenCalledTimes(1);
      });

      it('resolves without announcing when it never held anything', async () => {
        await expect(alpha.stop()).resolves.toBeUndefined();
        expect(roomEmit).not.toHaveBeenCalled();
      });

      it('still hands the leases back when the friend lookup fails', async () => {
        const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});
        const errorRepo = { getFriends: mock().mockRejectedValue(new Error('DB down')) };
        await alpha.trackUserConnection(io, 'user-1', 'socket-a', errorRepo);

        await expect(alpha.stop()).resolves.toBeUndefined();

        expect(leases.holders.has('user-1')).toBe(false);
        consoleSpy.mockRestore();
      });

      /**
       * With `PRESENCE_GRACE_MS` at 0 — a value the config parser accepts —
       * `releaseUser` empties both maps before its first await, and
       * `socketServer.ts` never awaits the disconnect it starts. So the
       * disconnects `index.ts` triggers on its way down leave `heldUsers()`
       * empty while the release is still in flight; a `stop()` that only
       * consulted `heldUsers()` would return immediately and let `redis.close()`
       * cut the announcement off.
       */
      it('waits for a zero-grace release that is still in flight', async () => {
        const view = leases.viewFor('alpha');
        let openGate: (() => void) | undefined;
        const gatedStore: PresenceStore = {
          ...view,
          async release(userId) {
            await new Promise<void>((resolve) => {
              openGate = resolve;
            });
            return view.release(userId);
          },
        };
        const zeroGrace = createPresenceTracker({ store: gatedStore, graceMs: () => 0 });
        await zeroGrace.trackUserConnection(io, 'user-1', 'socket-a', friendRepo);
        roomEmit.mockClear();

        // Fire and forget, exactly as `socketServer.ts` calls it.
        void zeroGrace.trackUserDisconnection(io, 'user-1', 'socket-a', friendRepo);
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(openGate).toBeDefined();

        let settled = false;
        const stopping = zeroGrace.stop().then(() => {
          settled = true;
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(settled).toBe(false);

        openGate!();
        await stopping;

        expect(roomEmit).toHaveBeenCalledWith('user_status', {
          userId: 'user-1',
          status: 'offline',
        });
        expect(leases.holders.has('user-1')).toBe(false);
      });

      /**
       * The handback is what `stop()` exists for, so it must survive a deadline
       * the announcement loses. Asserting only that `stop()` returned would
       * still pass if a hung friend lookup had starved the releases.
       */
      it('hands the leases back within the deadline even if the friend lookup hangs', async () => {
        let lookups = 0;
        const hangingRepo = {
          getFriends: mock(() => {
            lookups += 1;
            return lookups === 1
              ? Promise.resolve([{ friend: { userId: 'friend-1' } }])
              : new Promise<never>(() => {});
          }),
        };
        const bounded = createPresenceTracker({
          store: leases.viewFor('alpha'),
          graceMs: () => 0,
          stopTimeoutMs: 20,
        });
        await bounded.trackUserConnection(io, 'user-1', 'socket-a', hangingRepo);

        await bounded.stop();

        expect(leases.holders.has('user-1')).toBe(false);
      });
    });
  });

  describe('when Redis is unreachable', () => {
    let leases: ReturnType<typeof makeSharedLeases>;

    beforeEach(() => {
      leases = makeSharedLeases();
      tracker = createPresenceTracker({ store: leases.viewFor('alpha'), graceMs: () => 0 });
    });

    it('still tracks connections and announces the local edges', async () => {
      await tracker.trackUserConnection(io, 'friend-1', 'socket-friend', friendRepo);
      roomEmit.mockClear();
      leases.breakRedis();

      await expect(
        tracker.trackUserConnection(io, 'user-1', 'socket-1', friendRepo),
      ).resolves.toBeUndefined();
      expect(roomEmit).toHaveBeenCalledWith('user_status', { userId: 'user-1', status: 'online' });

      roomEmit.mockClear();
      await tracker.trackUserDisconnection(io, 'user-1', 'socket-1', friendRepo);
      expect(roomEmit).toHaveBeenCalledWith('user_status', { userId: 'user-1', status: 'offline' });
    });

    it('says "unknown" rather than "offline" for a user it cannot ask about', async () => {
      leases.breakRedis();
      expect(await tracker.presenceOf('someone-elsewhere')).toBe('unknown');
      // The display collapse is still offline — a screen has to show something.
      expect(await tracker.isUserOnline('someone-elsewhere')).toBe(false);
    });

    it('never says "unknown" about a user connected to this instance', async () => {
      await tracker.trackUserConnection(io, 'user-1', 'socket-1', friendRepo);
      leases.breakRedis();
      expect(await tracker.presenceOf('user-1')).toBe('online');
    });
  });

  describe('lease heartbeat', () => {
    it('re-takes every lease it holds, so a live connection outlives the TTL', async () => {
      const leases = makeSharedLeases();
      let beat: (() => void) | undefined;
      const heartbeatTracker = createPresenceTracker({
        store: leases.viewFor('alpha'),
        graceMs: () => 0,
        ttlMs: 300,
        refreshDivisor: 3,
        setIntervalFn: (handler) => {
          beat = handler;
          return 0;
        },
        clearIntervalFn: () => {},
      });

      await heartbeatTracker.trackUserConnection(io, 'user-1', 'socket-1', friendRepo);
      expect(beat).toBeDefined();

      // Something else expired the lease — a Redis restart, a TTL that elapsed
      // during an outage. The next beat must put it back.
      leases.holders.delete('user-1');
      beat!();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(leases.holders.get('user-1')?.has('alpha')).toBe(true);
    });

    it('does not re-take a lease for a user who has already left', async () => {
      const leases = makeSharedLeases();
      let beat: (() => void) | undefined;
      const heartbeatTracker = createPresenceTracker({
        store: leases.viewFor('alpha'),
        graceMs: () => 0,
        ttlMs: 300,
        setIntervalFn: (handler) => {
          beat = handler;
          return 0;
        },
        clearIntervalFn: () => {},
      });

      await heartbeatTracker.trackUserConnection(io, 'user-1', 'socket-1', friendRepo);
      await heartbeatTracker.trackUserDisconnection(io, 'user-1', 'socket-1', friendRepo);
      expect(leases.holders.has('user-1')).toBe(false);

      beat!();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(leases.holders.has('user-1')).toBe(false);
    });

    /**
     * The #664 defect. A command-connection outage longer than the lease TTL
     * expires every lease this instance holds while its sockets stay up, and the
     * beat after recovery takes them back. Handing them back without a word is
     * harmless only until something watches for the expiry: #665 adds a
     * reconciler that announces offline on exactly that signal, and nothing else
     * in the module would ever take it back.
     */
    it('announces online when it re-takes a lease that had lapsed', async () => {
      const leases = makeSharedLeases();
      let beat: (() => void | Promise<void>) | undefined;
      const heartbeatTracker = createPresenceTracker({
        store: leases.viewFor('alpha'),
        graceMs: () => 0,
        ttlMs: 300,
        refreshDivisor: 3,
        setIntervalFn: (handler) => {
          beat = handler;
          return 0;
        },
        clearIntervalFn: () => {},
      });

      await heartbeatTracker.trackUserConnection(io, 'user-1', 'socket-1', friendRepo);
      roomEmit.mockClear();

      // The lease expired on its own TTL while the socket stayed up.
      leases.holders.delete('user-1');
      await beat!();

      expect(io.to).toHaveBeenCalledWith(['user_friend-1', 'user_friend-2']);
      expect(roomEmit).toHaveBeenCalledTimes(1);
      expect(roomEmit).toHaveBeenCalledWith('user_status', { userId: 'user-1', status: 'online' });
    });

    it('says nothing on the next beat, because the lease is already in hand', async () => {
      const leases = makeSharedLeases();
      let beat: (() => void | Promise<void>) | undefined;
      const heartbeatTracker = createPresenceTracker({
        store: leases.viewFor('alpha'),
        graceMs: () => 0,
        ttlMs: 300,
        refreshDivisor: 3,
        setIntervalFn: (handler) => {
          beat = handler;
          return 0;
        },
        clearIntervalFn: () => {},
      });

      await heartbeatTracker.trackUserConnection(io, 'user-1', 'socket-1', friendRepo);
      leases.holders.delete('user-1');
      await beat!();
      roomEmit.mockClear();

      // `hold` now reports `before === 1`: this instance is the holder, so there
      // is no transition to announce.
      await beat!();

      expect(roomEmit).not.toHaveBeenCalled();
    });

    /**
     * The post-await re-check. The user's `hold` is still in flight when they
     * disconnect, so the lease comes back reporting `before === 0` for someone
     * who no longer has a socket — and `releaseUser` has already announced them
     * offline. An `online` behind that would leave every friend showing a
     * disconnected user as present, with nothing to correct it.
     */
    it('does not announce online for a user who left while the hold was in flight', async () => {
      const leases = makeSharedLeases();
      const view = leases.viewFor('alpha');
      let gate: Promise<void> | undefined;
      let openGate: (() => void) | undefined;
      const gatedStore: PresenceStore = {
        ...view,
        async hold(userId, connections) {
          const outcome = await view.hold(userId, connections);
          if (gate) {
            const pending = gate;
            gate = undefined;
            await pending;
          }
          return outcome;
        },
      };
      let beat: (() => void | Promise<void>) | undefined;
      const heartbeatTracker = createPresenceTracker({
        store: gatedStore,
        graceMs: () => 0,
        ttlMs: 300,
        refreshDivisor: 3,
        setIntervalFn: (handler) => {
          beat = handler;
          return 0;
        },
        clearIntervalFn: () => {},
      });

      await heartbeatTracker.trackUserConnection(io, 'user-1', 'socket-1', friendRepo);
      leases.holders.delete('user-1');

      gate = new Promise<void>((resolve) => {
        openGate = resolve;
      });
      const round = beat!();
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(openGate).toBeDefined();

      // The socket goes while the beat is parked inside its own `hold`.
      await heartbeatTracker.trackUserDisconnection(io, 'user-1', 'socket-1', friendRepo);
      expect(roomEmit).toHaveBeenCalledWith('user_status', {
        userId: 'user-1',
        status: 'offline',
      });
      roomEmit.mockClear();

      openGate!();
      await round;

      expect(roomEmit).not.toHaveBeenCalledWith('user_status', {
        userId: 'user-1',
        status: 'online',
      });
    });

    it('starts no timer at all without a store', async () => {
      const setIntervalFn = mock(() => 0);
      const local = createPresenceTracker({ graceMs: () => 0, setIntervalFn });
      await local.trackUserConnection(io, 'user-1', 'socket-1', friendRepo);
      expect(setIntervalFn).not.toHaveBeenCalled();
    });
  });
});
