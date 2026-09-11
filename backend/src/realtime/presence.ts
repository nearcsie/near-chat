import type pino from 'pino';
import type { ChatServer } from './authSocket';
import type { PresenceStore } from './presenceStore';
import { DEFAULT_PRESENCE_REFRESH_DIVISOR, env } from '../config/env';
import { logger as defaultLogger } from '../utils/logger';

interface FriendPresenceDeps {
  getFriends(userId: string): Promise<{ friend: { userId: string } }[]>;
}

/** Max time allowed for releasing presence leases during shutdown. */
export const DEFAULT_PRESENCE_STOP_TIMEOUT_MS = 2_000;

/** Races a promise against a timeout deadline. */
const withDeadline = async (work: Promise<unknown>, ms: number): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
  try {
    await Promise.race([work.then(() => undefined, () => undefined), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export type PresenceStatus = 'online' | 'offline';

/**
 * Presence state with tri-state support.
 * 'unknown' is returned when Redis is unreachable, preventing false offline escalations.
 */
export type PresenceState = PresenceStatus | 'unknown';

export interface PresenceTracker {
  trackUserConnection(
    io: ChatServer,
    userId: string,
    socketId: string,
    friendRepo: FriendPresenceDeps,
  ): Promise<void>;
  trackUserDisconnection(
    io: ChatServer,
    userId: string,
    socketId: string,
    friendRepo: FriendPresenceDeps,
  ): Promise<void>;
  /** Returns true if user has an active connection locally or in Redis. */
  isUserOnline(userId: string): Promise<boolean>;
  /** Returns 'online', 'offline', or 'unknown' if Redis cannot be reached. */
  presenceOf(userId: string): Promise<PresenceState>;
  /** Returns the subset of user IDs currently online in a single check. */
  onlineAmong(userIds: string[]): Promise<Set<string>>;
  getOnlineUsers(): Promise<string[]>;
  /** Clears local presence state and releases held leases. */
  clearPresence(): Promise<void>;
  /** Releases held leases and stops heartbeat. Idempotent. */
  stop(): Promise<void>;
}

export interface CreatePresenceTrackerOptions {
  /** Optional distributed presence store; absent runs in single-node mode. */
  store?: PresenceStore;
  /** Reconnect grace period in milliseconds before broadcasting offline. */
  graceMs?: () => number;
  /** Lease TTL and heartbeat period. */
  ttlMs?: number;
  /** Number of heartbeats within one lease TTL window. */
  refreshDivisor?: number;
  /** Max time allowed for releasing leases during stop(). */
  stopTimeoutMs?: number;
  logger?: pino.Logger;
  setIntervalFn?: (handler: () => void, ms: number) => ReturnType<typeof setInterval> | number;
  clearIntervalFn?: (handle: ReturnType<typeof setInterval> | number) => void;
}

export const createPresenceTracker = ({
  store,
  graceMs = () => env().realtime.presenceGraceMs,
  ttlMs = env().realtime.presenceTtlMs,
  refreshDivisor = DEFAULT_PRESENCE_REFRESH_DIVISOR,
  stopTimeoutMs = DEFAULT_PRESENCE_STOP_TIMEOUT_MS,
  logger = defaultLogger,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
}: CreatePresenceTrackerOptions = {}): PresenceTracker => {
  // This instance's own connections. Still a local map with Redis in play, and
  // not a cache of it: the reconnect grace period, the "which socket left"
  // bookkeeping and the answer to "is this user on *this* box" are all local
  // questions, and the only thing another instance needs to know is the single
  // bit the lease carries.
  const userSockets = new Map<string, Set<string>>();
  // Keep a disconnected user online during the short reconnect grace period.
  // This prevents a mobile network handoff from producing offline/online
  // flicker. The Redis lease is deliberately held for the whole window too, so
  // a reconnect that lands on a different instance also sees no transition.
  const pendingDisconnects = new Map<string, ReturnType<typeof setTimeout>>();

  let heartbeat: ReturnType<typeof setInterval> | number | undefined;
  let stopped = false;
  // The `io` and `friendRepo` this instance took its leases through, kept so
  // that the instance *itself* leaving can announce the users it was the last
  // to hold. Every other announcement is driven by a socket, which carries the
  // pair as arguments (`realtime/socketServer.ts`); an instance leaving is not,
  // and nothing else in this module can reach a socket.
  let boundIo: ChatServer | undefined;
  let boundFriendRepo: FriendPresenceDeps | undefined;
  // Releases already under way, which `stop()` has to wait for.
  //
  // `releaseUser` empties both maps *before* its first await, and
  // `realtime/socketServer.ts` never awaits the disconnect it starts. With
  // `PRESENCE_GRACE_MS` at 0 — a value the config parser accepts — the
  // disconnects `index.ts` triggers on its way down therefore leave
  // `heldUsers()` empty while their `store.release` and announcement are still
  // in flight, and a `stop()` that only looked at `heldUsers()` would return
  // straight away and let `redis.close()` cut them off.
  const inflightReleases = new Set<Promise<void>>();

  const trackRelease = (work: Promise<void>): Promise<void> => {
    inflightReleases.add(work);
    // `catch` before `finally`: a rejected `work` reaches its own handler at
    // the call site, and a bare `finally` here would re-raise it as an
    // unhandled rejection.
    void work.catch(() => undefined).finally(() => inflightReleases.delete(work));
    return work;
  };

  const localSocketCount = (userId: string): number => userSockets.get(userId)?.size ?? 0;

  /**
   * Users this instance is currently holding a lease for.
   *
   * A pending disconnect counts: the grace period is a promise that the user
   * still reads as online, and dropping the lease at the start of it would
   * break that promise for every other instance.
   */
  const heldUsers = (): string[] =>
    Array.from(new Set([...userSockets.keys(), ...pendingDisconnects.keys()]));

  const isLocallyOnline = (userId: string): boolean =>
    localSocketCount(userId) > 0 || pendingDisconnects.has(userId);

  /**
   * Broadcasts an online/offline transition to the user's friends.
   *
   * Addressed to the friends' personal rooms and left to the adapter, rather
   * than filtered against who this instance can see. `user_<id>` is joined the
   * moment the socket is (`realtime/socketServer.ts`), so room membership is
   * the transport's own answer to "is there a session to deliver to" — and
   * since #475 it is a cluster-wide answer. Asking presence instead would
   * re-derive it from leases that lag a live socket by up to their refresh
   * period, and would drop every remote friend whenever the command connection
   * is down while the publisher that carries the frame is fine.
   *
   * One `emit` for the whole list, not one per friend: `to()` unions the rooms
   * into a single broadcast, so the cluster adapter publishes one frame however
   * many friends it names, and each instance discards the rooms it holds no
   * sockets for.
   */
  const broadcastStatus = async (
    io: ChatServer,
    userId: string,
    status: PresenceStatus,
    friendRepo: FriendPresenceDeps,
  ): Promise<void> => {
    try {
      const friends = await friendRepo.getFriends(userId);
      const rooms = friends.map((f) => `user_${f.friend.userId}`);
      // No rooms is not an empty audience: `Adapter#apply` reads an empty room
      // set as *every* socket in the namespace, so emitting here would announce
      // a friendless user's presence to the whole deployment.
      if (rooms.length === 0) return;
      io.to(rooms).emit('user_status', { userId, status });
    } catch (err) {
      console.error(`Failed to broadcast ${status} status for user ${userId}:`, err);
    }
  };

  /**
   * Refreshes presence leases in Redis for all currently held users, and
   * announces anyone whose lease had lapsed before this beat took it back.
   *
   * A lapsed lease is not hypothetical. `utils/redis.ts` supervises the command,
   * publisher and subscriber connections separately, so the command connection
   * can stay down past `PRESENCE_TTL_MS` while this instance's sockets — and the
   * publisher that would carry a frame — are perfectly healthy. Every lease then
   * expires under its own `HPEXPIRE` with the users still connected, and the
   * first beat after recovery takes them all back. Handing them back silently
   * was invisible only because nothing watches for the expiry yet; #665 adds a
   * reconciler that announces offline on exactly that signal, and without the
   * announcement here one Redis blip would strand every user of this instance as
   * offline until each friend's next `GET /api/v1/friends` (#664).
   *
   * `before === 0` is a single-winner latch rather than merely "the lease was
   * gone": `HOLD_SCRIPT` reads `HLEN` and writes the field inside one `EVAL`
   * (`realtime/presenceStore.ts`), so Redis serialises it and exactly one caller
   * observes zero per zero-to-nonzero transition, across every instance and
   * every overlapping beat. Suppressing duplicates therefore costs nothing. It
   * is the same latch `trackUserConnection` reads for `firstAnywhere`, which
   * stops being the only announcer of `online`: a beat landing between
   * `startHeartbeat()` and the `store.hold` below it wins the latch instead, and
   * the connection path then correctly stays quiet.
   *
   * Two phases, like `releaseHeldUsers`: every `store.hold` is issued before the
   * first `friendRepo.getFriends`, because the renewal is a Redis round trip and
   * the announcement is a Postgres one. Renewing is the reason the heartbeat
   * exists, so it must never queue behind an announcement.
   *
   * Only an acknowledged reply counts as a lapse. `!result.ok` means this
   * instance knows nothing about the cluster, and #653 owns that fail-open /
   * fail-closed policy for every path at once.
   */
  const refreshLeases = async (): Promise<void> => {
    if (!store || stopped) return;
    const users = heldUsers();
    if (users.length === 0) return;

    const refreshed = await Promise.all(
      users.map(async (userId) => ({
        userId,
        result: isLocallyOnline(userId)
          ? await store.hold(userId, localSocketCount(userId))
          : undefined,
      })),
    );

    if (stopped) return;
    const io = boundIo;
    const friendRepo = boundFriendRepo;
    if (!io || !friendRepo) return;

    // One at a time, not `Promise.all`: an outage that outlived the TTL expired
    // *every* lease, so on the first beat after recovery this list is the whole
    // instance. `getFriends` is two statements per user, and issuing them
    // together would queue the shared `Bun.SQL` pool behind presence just as the
    // deployment is recovering — with every statement that crosses
    // `DEFAULT_SLOW_QUERY_THRESHOLD_MS` logging a warning, enough of them to
    // evict the 200-record recent-log buffer holding the outage's own
    // diagnostics. A cap would be worse than a queue: it would silently drop the
    // corrections this exists to deliver.
    for (const { userId, result } of refreshed) {
      if (!result?.ok || result.value !== 0) continue;
      // Re-checked after the await: the user can disconnect while their own hold
      // is in flight, and `releaseUser` will already have announced them
      // offline. An `online` landing after that would outlive it on every
      // friend's screen.
      if (!isLocallyOnline(userId)) continue;
      await broadcastStatus(io, userId, 'online', friendRepo);
    }
  };

  const startHeartbeat = (): void => {
    if (!store || heartbeat !== undefined) return;
    const period = Math.max(1, Math.floor(ttlMs / Math.max(1, refreshDivisor)));
    // The round is returned, not dropped on the floor: `setInterval` discards it
    // either way, but an injected `setIntervalFn` can hand it to a test, which
    // now announces as well as renews and so no longer settles within a single
    // turn of the microtask queue. `catch` keeps the returned promise settled, so
    // nothing here can float a rejection.
    heartbeat = setIntervalFn(
      () =>
        refreshLeases().catch((err) => {
          logger.debug({ err }, 'Presence heartbeat failed');
        }),
      period,
    );
    (heartbeat as { unref?: () => void }).unref?.();
  };

  /** Drops local presence and releases the Redis lease for a disconnected user. */
  const releaseUser = async (
    io: ChatServer,
    userId: string,
    friendRepo: FriendPresenceDeps,
  ): Promise<void> => {
    userSockets.delete(userId);
    pendingDisconnects.delete(userId);

    if (!store) {
      await broadcastStatus(io, userId, 'offline', friendRepo);
      return;
    }

    const result = await store.release(userId);
    const goneEverywhere = !result.ok || result.value === 0;
    if (goneEverywhere) await broadcastStatus(io, userId, 'offline', friendRepo);
  };

  /**
   * Hands back every lease this instance holds, announcing the users it turns
   * out to have been the last holder of.
   *
   * Releasing without announcing is what left a friend on another instance
   * reading a departed user as online until their next `GET /api/v1/friends`
   * (#654): the lease is gone, so `isUserOnline` is right everywhere, but a
   * correct answer nobody asks for changes nothing on screen.
   *
   * Two phases on purpose. Every `store.release` is issued before the first
   * `friendRepo.getFriends`, because the handback is a Redis round trip and the
   * announcement is a Postgres one, and `stop()` runs both under a single
   * deadline. Handing the leases back is the reason `stop()` exists — one kept
   * here reads as an online user for the rest of its TTL — so when the deadline
   * wins, it has to cost announcements rather than handbacks.
   */
  const releaseHeldUsers = async (users: string[]): Promise<void> => {
    // No store is no cluster: `bootstrap/realtime.ts` gates the cluster adapter
    // on the same `REDIS_URL`, so `io.to()` would reach only this process's own
    // sockets — and `index.ts` has already disconnected those before it gets
    // here. Nothing to tell, and two Postgres queries per user to tell it.
    if (!store || users.length === 0) return;

    const released = await Promise.all(
      users.map(async (userId) => ({ userId, result: await store.release(userId) })),
    );

    const io = boundIo;
    const friendRepo = boundFriendRepo;
    if (!io || !friendRepo) return;

    // Only an acknowledged release that emptied the hash means the user is gone
    // from the cluster. A release Redis never confirmed left the lease in place
    // to expire on its own TTL, so there is no departure to announce yet —
    // announcing one would report every user this instance holds offline at
    // once during a command outage, and the surviving lease would then swallow
    // their next arrival, since `hold` returns a non-zero `before`.
    // `releaseUser` above does read `!result.ok` as gone everywhere; #653
    // tracks reconciling the two under one policy.
    const goneEverywhere = released.filter(({ result }) => result.ok && result.value === 0);
    await Promise.all(
      goneEverywhere.map(({ userId }) => broadcastStatus(io, userId, 'offline', friendRepo)),
    );
  };

  const presenceOf = async (userId: string): Promise<PresenceState> => {
    if (isLocallyOnline(userId)) return 'online';
    if (!store) return 'offline';
    const result = await store.isOnline(userId);
    if (!result.ok) return 'unknown';
    return result.value ? 'online' : 'offline';
  };

  return {
    async trackUserConnection(io, userId, socketId, friendRepo) {
      boundIo = io;
      boundFriendRepo = friendRepo;
      if (stopped) return;

      const pending = pendingDisconnects.get(userId);
      const wasGracefullyReconnecting = pending !== undefined;
      if (pending) {
        clearTimeout(pending);
        pendingDisconnects.delete(userId);
      }

      let sockets = userSockets.get(userId);
      const wasLocallyOffline = !sockets || sockets.size === 0;
      if (!sockets) {
        sockets = new Set<string>();
        userSockets.set(userId, sockets);
      }
      sockets.add(socketId);

      if (!store) {
        if (wasLocallyOffline && !wasGracefullyReconnecting) {
          await broadcastStatus(io, userId, 'online', friendRepo);
        }
        return;
      }

      startHeartbeat();
      const result = await store.hold(userId, sockets.size);
      const firstAnywhere = result.ok
        ? result.value === 0
        : wasLocallyOffline && !wasGracefullyReconnecting;
      if (firstAnywhere) await broadcastStatus(io, userId, 'online', friendRepo);
    },

    async trackUserDisconnection(io, userId, socketId, friendRepo) {
      // Captured here too, not only on connect: `index.ts` disconnects every
      // local socket before it stops presence, so on the shutdown path this is
      // the last writer, and a tracker that only ever saw disconnects still has
      // a way to announce.
      boundIo = io;
      boundFriendRepo = friendRepo;
      const sockets = userSockets.get(userId);
      if (!sockets || !sockets.has(socketId)) return;

      sockets.delete(socketId);
      if (sockets.size > 0) return;

      const delay = graceMs();
      if (delay === 0) {
        await trackRelease(releaseUser(io, userId, friendRepo));
        return;
      }

      // Delay offline broadcast during the reconnect grace period.
      const prior = pendingDisconnects.get(userId);
      if (prior) clearTimeout(prior);
      const timer = setTimeout(() => {
        pendingDisconnects.delete(userId);
        if (localSocketCount(userId) > 0) return;
        void trackRelease(releaseUser(io, userId, friendRepo)).catch((err) => {
          logger.debug({ err, userId }, 'Failed to release a presence lease after the grace period');
        });
      }, delay);
      timer.unref?.();
      pendingDisconnects.set(userId, timer);
    },

    presenceOf,

    async isUserOnline(userId) {
      return (await presenceOf(userId)) === 'online';
    },

    async onlineAmong(userIds) {
      const online = new Set<string>();
      const unresolved: string[] = [];
      for (const userId of new Set(userIds)) {
        if (isLocallyOnline(userId)) online.add(userId);
        else unresolved.push(userId);
      }
      if (!store || unresolved.length === 0) return online;

      const result = await store.areOnline(unresolved);
      if (result.ok) for (const userId of result.value) online.add(userId);
      return online;
    },

    async getOnlineUsers() {
      const local = heldUsers();
      if (!store) return local;
      const result = await store.onlineUsers();
      return result.ok ? [...new Set([...local, ...result.value])] : local;
    },

    async clearPresence() {
      for (const timer of pendingDisconnects.values()) clearTimeout(timer);
      const users = heldUsers();
      pendingDisconnects.clear();
      userSockets.clear();
      await releaseHeldUsers(users);
    },

    async stop() {
      stopped = true;
      if (heartbeat !== undefined) {
        clearIntervalFn(heartbeat);
        heartbeat = undefined;
      }
      for (const timer of pendingDisconnects.values()) clearTimeout(timer);
      const users = heldUsers();
      pendingDisconnects.clear();
      userSockets.clear();
      // Each already settles on its own; awaiting them here is only about not
      // exiting first, so a rejected one must not abort the wait for the rest.
      const inflight = [...inflightReleases].map((work) => work.catch(() => undefined));
      if (!store || (users.length === 0 && inflight.length === 0)) return;
      // One deadline for the handbacks and the announcements together. A second
      // one for the announcements would let a slow friend lookup push shutdown
      // past the budget `docker-compose.release.yml` is built around.
      await withDeadline(
        Promise.all([releaseHeldUsers(users), ...inflight]),
        stopTimeoutMs,
      );
    },
  };
};

/** Default process-wide presence tracker singleton. */
let current: PresenceTracker = createPresenceTracker();

export const configurePresence = (options: CreatePresenceTrackerOptions): PresenceTracker => {
  const previous = current;
  current = createPresenceTracker(options);
  // Safe to leave unawaited only because `previous` is always the import-time
  // singleton above: `bootstrap/presence.ts` is the sole caller and runs once,
  // so the tracker being stopped holds no leases and has never been handed an
  // `io` to announce through. Call this a second time on a tracker that has
  // served sockets and this stop would announce offline for users who are still
  // connected, after the new tracker has already announced them online.
  void previous.stop();
  return current;
};

export const trackUserConnection = (
  io: ChatServer,
  userId: string,
  socketId: string,
  friendRepo: FriendPresenceDeps,
): Promise<void> => current.trackUserConnection(io, userId, socketId, friendRepo);

export const trackUserDisconnection = (
  io: ChatServer,
  userId: string,
  socketId: string,
  friendRepo: FriendPresenceDeps,
): Promise<void> => current.trackUserDisconnection(io, userId, socketId, friendRepo);

export const isUserOnline = (userId: string): Promise<boolean> => current.isUserOnline(userId);

export const presenceOf = (userId: string): Promise<PresenceState> => current.presenceOf(userId);

export const onlineAmong = (userIds: string[]): Promise<Set<string>> =>
  current.onlineAmong(userIds);

export const getOnlineUsers = (): Promise<string[]> => current.getOnlineUsers();

export const clearPresence = (): Promise<void> => current.clearPresence();
