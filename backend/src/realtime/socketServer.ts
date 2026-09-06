import type { FriendResponse, RoomMember } from '@shared/types';
import { ForbiddenError, ValidationError } from '../utils/AppError';
import type { IRoomMemberRepository } from '../models/IRoomMemberRepository';
import type { ChatServer } from './authSocket';
import { trackUserConnection, trackUserDisconnection, type PresenceTracker } from './presence';
import { mapErrorToApiShape } from '../utils/mapError';
import { env } from '../config/env';

interface SocketDeps {
  roomMemberRepository: Pick<IRoomMemberRepository, 'findMember' | 'findByUser'>;
  friendRepository?: { getFriends(userId: string): Promise<FriendResponse[]> };
  withRoomSubscriptionLock?: <T>(
    userId: string,
    roomId: string,
    operation: () => Promise<T> | T,
  ) => Promise<T>;
  /** Optional injected presence tracker (defaults to process singleton). */
  presence?: Pick<PresenceTracker, 'trackUserConnection' | 'trackUserDisconnection'>;
  /**
   * Subscriber-reconnect signal from `utils/redis.ts`, when one is wired.
   *
   * Absent without `REDIS_URL`: the in-memory adapter never publishes a
   * revocation over the wire, so there is no frame for an outage to lose and
   * nothing to reconcile.
   */
  onSubscriberRestored?: (handler: () => void) => () => void;
  /**
   * First backoff before a reconciliation retries users whose membership read
   * failed. Injected only so tests need not wait out a real backoff.
   */
  reconcileRetryDelayMs?: number;
}

/** The only room prefix reconciliation may act on. */
const ROOM_PREFIX = 'room_';

/** Users whose durable membership is read at once during a reconciliation. */
const RECONCILE_CONCURRENCY = 8;

/** Passes a reconciliation makes before it stops retrying failed reads. */
const RECONCILE_ATTEMPTS = 5;

/** First backoff before retrying users whose membership read failed. */
const RECONCILE_RETRY_DELAY_MS = 2_000;

/** The socket type the namespace holds, without restating its generics. */
type LocalSocket = ReturnType<ChatServer['of']>['sockets'] extends Map<string, infer S>
  ? S
  : never;

const maxSessionsPerUser = (): number => env().realtime.maxSessionsPerUser;

const typingTtlMs = (): number => env().realtime.typingTtlMs;

/** Timeout before unestablished socket reservations are released. */
const sessionReservationTtlMs = (): number => env().realtime.sessionReservationTtlMs;

/** Attaches ephemeral Socket.IO listeners for presence and typing indicators. */
export const attachSockets = (io: ChatServer, deps: SocketDeps): void => {
  const presence = deps.presence ?? { trackUserConnection, trackUserDisconnection };
  const sessionLimit = maxSessionsPerUser();
  const sessionCounts = new Map<string, number>();

  /** Tracks active typing expiration timer and check timestamp per socket and room. */
  const typingClaims = new Map<string, { expiry: ReturnType<typeof setTimeout>; checkedAt: number }>();

  /** Maps roomId -> userId -> active socketIds claiming typing state. */
  const typingRooms = new Map<string, Map<string, Set<string>>>();

  /** Records a socket typing claim on a room. */
  const addTypingSocket = (roomId: string, userId: string, socketId: string): void => {
    let byUser = typingRooms.get(roomId);
    if (!byUser) {
      byUser = new Map();
      typingRooms.set(roomId, byUser);
    }
    let sockets = byUser.get(userId);
    if (!sockets) {
      sockets = new Set();
      byUser.set(userId, sockets);
    }
    sockets.add(socketId);
  };

  /** Drops a socket typing claim. Returns true only if it was the user's last active socket in the room. */
  const removeTypingSocket = (roomId: string, userId: string, socketId: string): boolean => {
    const byUser = typingRooms.get(roomId);
    const sockets = byUser?.get(userId);
    if (!byUser || !sockets || !sockets.delete(socketId)) return false;
    if (sockets.size > 0) return false;
    byUser.delete(userId);
    if (byUser.size === 0) typingRooms.delete(roomId);
    return true;
  };

  // Tracks reserved handshake slots to prevent race conditions during connection setup.
  const reservedSessions = new WeakSet<object>();
  const reservationTimers = new WeakMap<object, ReturnType<typeof setTimeout>>();
  const reservationTtl = sessionReservationTtlMs();

  const settleReservation = (socket: object): boolean => {
    const timer = reservationTimers.get(socket);
    if (timer) {
      clearTimeout(timer);
      reservationTimers.delete(socket);
    }
    return reservedSessions.delete(socket);
  };

  const acquireSession = (userId: string): void => {
    sessionCounts.set(userId, (sessionCounts.get(userId) ?? 0) + 1);
  };
  const releaseSession = (userId: string): void => {
    const count = (sessionCounts.get(userId) ?? 1) - 1;
    if (count > 0) sessionCounts.set(userId, count);
    else sessionCounts.delete(userId);
  };

  // Reserve session slot during handshake middleware.
  if (typeof (io as unknown as { use?: unknown }).use === 'function') {
    io.use((socket, next) => {
      const userId = socket.data.user?.userId;
      if (!userId) {
        next(new Error('Authentication error'));
        return;
      }
      if ((sessionCounts.get(userId) ?? 0) >= sessionLimit) {
        next(new Error('Session limit reached'));
        return;
      }
      acquireSession(userId);
      reservedSessions.add(socket);
      const expiry = setTimeout(() => {
        reservationTimers.delete(socket);
        if (reservedSessions.delete(socket)) releaseSession(userId);
      }, reservationTtl);
      expiry.unref?.();
      reservationTimers.set(socket, expiry);
      next();
    });
  }

  /**
   * Every socket this process holds, grouped by the user who owns it.
   *
   * `io.of('/').sockets` and not `fetchSockets()`: without `flags.local` the
   * latter is a cluster-wide round trip, and `realtime/redisAdapter.ts`
   * deliberately extends plain `ClusterAdapter` rather than the heartbeat
   * subclass that keeps the `serverCount()` it waits on accurate.
   *
   * Grouped because durable membership is per user while sockets are not: one
   * user holds up to `MAX_SESSIONS_PER_USER` of them, and they all reconcile
   * against a single read.
   */
  const localSocketsByUser = (): Map<string, LocalSocket[]> => {
    const grouped = new Map<string, LocalSocket[]>();
    const server = io as unknown as {
      of?: (name: string) => { sockets?: Map<string, LocalSocket> };
    };
    if (typeof server.of !== 'function') return grouped;
    const sockets = server.of('/').sockets;
    if (!sockets) return grouped;
    for (const socket of sockets.values()) {
      const owner = socket.data?.user?.userId;
      if (typeof owner !== 'string' || owner.length === 0) continue;
      const held = grouped.get(owner);
      if (held) held.push(socket);
      else grouped.set(owner, [socket]);
    }
    return grouped;
  };

  /** The rooms a membership read says this user's sockets may hold. */
  const permittedRooms = (members: RoomMember[]): Set<string> =>
    new Set(
      members
        .filter((member) => member.role !== 'pending')
        .map((member) => `${ROOM_PREFIX}${member.roomId}`),
    );

  /**
   * Reconcile one user's sessions. Resolves false when a membership read failed
   * and this user's rooms are therefore still unverified.
   */
  const reconcileUser = async (
    findByUser: (userId: string) => Promise<RoomMember[]>,
    userId: string,
    sockets: LocalSocket[],
  ): Promise<boolean> => {
    const read = async (): Promise<Set<string> | undefined> => {
      try {
        return permittedRooms(await findByUser(userId));
      } catch (error) {
        // Leaving nothing is the safe failure: this pass only ever removes
        // access, and guessing would drop the user out of rooms they still
        // hold. The cost is that this user stays unverified, which is why the
        // caller retries rather than treating the pass as finished.
        console.error('Failed to read membership while reconciling subscriptions:', error);
        return undefined;
      }
    };

    const permitted = await read();
    if (!permitted) return false;

    // Collected across the user's sockets before anything leaves, so the room
    // set being walked is never the one `leave` mutates — `socket.rooms` is the
    // adapter's own live Set, not a copy. `socket.id` is skipped explicitly:
    // socket ids come from an alphabet that includes `_`, so one can in
    // principle start with `room_` without ever having been a room.
    const candidates = new Set<string>();
    for (const socket of sockets) {
      for (const room of socket.rooms ?? []) {
        if (room === socket.id) continue;
        if (!room.startsWith(ROOM_PREFIX)) continue;
        if (permitted.has(room)) continue;
        candidates.add(room);
      }
    }
    if (candidates.size === 0) return true;

    // A re-read that failed leaves its room unverified too, so the pass is
    // incomplete for the same reason a failed first read is.
    let verified = true;
    const evicted = new Set<LocalSocket>();
    for (const room of candidates) {
      const roomId = room.slice(ROOM_PREFIX.length);
      const leave = async (): Promise<void> => {
        // Re-read under the lock before acting, the same shape the
        // connection-time restore uses above. The set gathered before this
        // point is a candidate filter and nothing more: a grant commits and
        // then joins the room (`services/roomService.ts`), so a membership
        // granted after the first read is already in `socket.rooms` while
        // still missing from that snapshot, and leaving on it would evict a
        // socket that was just legitimately authorized. `findByUser` and not
        // `findMember`, because its SQL is also what encodes the read-only
        // private room and mutual-block conditions — a revocation caused by a
        // block would otherwise survive the re-read.
        const current = await read();
        if (!current) {
          verified = false;
          return;
        }
        if (current.has(room)) return;
        for (const socket of sockets) {
          if (socket.connected === false) continue;
          if (socket.rooms?.has(room) !== true) continue;
          await Promise.resolve(socket.leave(room));
          evicted.add(socket);
        }
      };
      // The same lock the connection-time restore takes, so a reconciliation
      // and a reconnecting session cannot interleave on one room.
      if (deps.withRoomSubscriptionLock) {
        await deps.withRoomSubscriptionLock(userId, roomId, leave);
      } else {
        await leave();
      }
    }

    // Only the sockets that actually lost a room. `realtime_ready` puts the
    // client through `synchronize()` — a `/sync` page loop plus the room,
    // social and member reloads — and a socket that kept every room has
    // nothing to recover.
    for (const socket of evicted) socket.emit('realtime_ready');
    return verified;
  };

  /**
   * Re-derive every local socket's room subscriptions from durable membership,
   * leaving the rooms that are no longer permitted and never joining any.
   *
   * Leave-only is the point. `services/roomService.ts` revokes the subscription
   * *before* it writes the demotion, deliberately and for the reasons recorded
   * there, so a pass reading the database inside that window would find the
   * member still authorized and hand back the subscription a revocation in
   * flight had just taken away. Grants run the other way round — the
   * subscription is added after the write commits — so a pass that only leaves
   * can never remove one that was just granted. A `SOCKETS_JOIN` lost to the
   * same outage is a missed event rather than wrong access, and `/sync` plus
   * the next reconnect already cover it.
   */
  const reconcileRoomSubscriptions = async (): Promise<boolean> => {
    const repository = deps.roomMemberRepository;
    // Bound so the repository keeps its own `this`, and checked because
    // `findByUser` is optional on `IRoomMemberRepository`. Without it there is
    // no authorization source to reconcile against at all, and reading that as
    // "no rooms" would empty every socket out of every room it holds.
    const findByUser = repository.findByUser?.bind(repository);
    if (!findByUser) return true;

    let complete = true;
    const grouped = [...localSocketsByUser()];
    for (let index = 0; index < grouped.length; index += RECONCILE_CONCURRENCY) {
      const verified = await Promise.all(
        grouped
          .slice(index, index + RECONCILE_CONCURRENCY)
          .map(([userId, sockets]) => reconcileUser(findByUser, userId, sockets)),
      );
      if (verified.includes(false)) complete = false;
    }
    return complete;
  };

  /** The in-flight reconciliation, and whether one more pass is owed. */
  let reconciling: Promise<void> | undefined;
  let reconcileAgain = false;

  const pause = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      timer.unref?.();
    });

  const scheduleReconcile = (): void => {
    if (reconciling) {
      // A subscriber that flaps signals on every watchdog tick. Folding those
      // into a single trailing pass is what keeps a five-second tick from
      // restarting a scan that is still reading the database — while still
      // guaranteeing one full pass begins after the last signal.
      reconcileAgain = true;
      return;
    }
    const retryDelay = deps.reconcileRetryDelayMs ?? RECONCILE_RETRY_DELAY_MS;
    reconciling = (async () => {
      try {
        let attempt = 0;
        for (;;) {
          reconcileAgain = false;
          const complete = await reconcileRoomSubscriptions();
          // A fresh signal arrived mid-pass, so the pass just finished is
          // already stale. Start over with the retry budget reset.
          if (reconcileAgain) {
            attempt = 0;
            continue;
          }
          if (complete) return;
          // Some user's membership could not be read, so their sockets are
          // still unverified. Nothing else will ask again: the subscriber is
          // back up, so no further signal is coming, and a revoked socket would
          // otherwise sit in its room until that client happens to reconnect.
          attempt += 1;
          if (attempt >= RECONCILE_ATTEMPTS) {
            console.error(
              'Gave up reconciling room subscriptions after repeated membership read failures; '
              + 'sockets may still hold rooms that have been revoked',
            );
            return;
          }
          // Backed off, because the reason a read failed is usually that the
          // database is unavailable, and retrying at full speed would add load
          // to something already struggling.
          await pause(retryDelay * 2 ** (attempt - 1));
        }
      } catch (error) {
        console.error('Failed to reconcile room subscriptions:', error);
      } finally {
        reconciling = undefined;
      }
    })();
  };

  // Room subscriptions derived at connection time go stale when a revocation's
  // `SOCKETS_LEAVE` is published while this instance's subscriber is down:
  // pub/sub keeps no backlog, so that frame is gone for good and the revoked
  // member's socket stays in the room. Nothing unregisters this handler —
  // `attachSockets` runs once per process, and its `connection` listener is
  // never removed either.
  deps.onSubscriberRestored?.(scheduleReconcile);

  io.on('connection', (socket) => {
    const userId = socket.data.user.userId;
    let disconnected = false;
    // A reservation that already expired has given its slot back, so this
    // connection has to take one of its own — and the limit has to be tested
    // again before it does. The middleware's check cannot stand in for it: it
    // passed against a count that included this handshake's own reservation,
    // and the slot has since been returned. Other connections may have taken
    // it in the meantime, so acquiring unconditionally here is what pushes a
    // user past `MAX_SESSIONS_PER_USER`.
    if (!settleReservation(socket)) {
      if ((sessionCounts.get(userId) ?? 0) >= sessionLimit) {
        socket.emit('error', { statusCode: 429, message: 'Session limit reached', code: 'SESSION_LIMIT' });
        socket.disconnect(true);
        return;
      }
      acquireSession(userId);
    }
    socket.join(`user_${userId}`);

    const typingTimerKey = (roomId: string): string => `${socket.id}:${roomId}`;

    const emitTyping = (roomId: string, isTyping: boolean) => {
      socket.to(`room_${roomId}`).emit('user_typing', { roomId, userId, isTyping });
    };

    /**
     * Retract this socket's claim on a room, telling the room only if it was the
     * user's last one. The single exit from typing: explicit `isTyping: false`,
     * the TTL, and disconnect all come through here.
     */
    const stopTyping = (roomId: string) => {
      const key = typingTimerKey(roomId);
      const claim = typingClaims.get(key);
      if (claim) clearTimeout(claim.expiry);
      typingClaims.delete(key);
      if (removeTypingSocket(roomId, userId, socket.id)) emitTyping(roomId, false);
    };

    // Over a copy of the keys: `stopTyping` deletes from the map it walks.
    const clearTypingTimers = () => {
      for (const key of [...typingClaims.keys()]) {
        if (!key.startsWith(`${socket.id}:`)) continue;
        stopTyping(key.slice(socket.id.length + 1));
      }
    };

    // Restore room subscriptions from durable membership records.
    const restoreSubscriptions = deps.roomMemberRepository.findByUser
      ? deps.roomMemberRepository.findByUser(userId)
        .then((members) => Promise.all(
          members
            .filter((member) => member.role !== 'pending')
            .map(async (member) => {
              const join = async () => {
                const current = await deps.roomMemberRepository.findMember(member.roomId, userId);
                if (!current || current.role === 'pending') return;
                await Promise.resolve(socket.join(`room_${member.roomId}`));
              };
              if (deps.withRoomSubscriptionLock) {
                await deps.withRoomSubscriptionLock(userId, member.roomId, join);
              } else {
                await join();
              }
            }),
        ))
      : Promise.resolve();

    // Signal realtime ready only after all initial room rooms have been joined.
    void restoreSubscriptions.then(
      () => socket.emit('realtime_ready'),
      (error) => {
        console.error('Failed to restore room subscriptions:', error);
        if (typeof (socket as unknown as { disconnect?: (close?: boolean) => void }).disconnect === 'function') {
          socket.disconnect(true);
        }
      },
    );

    if (deps.friendRepository) {
      presence.trackUserConnection(io, userId, socket.id, deps.friendRepository).catch((err) => {
        console.error('trackUserConnection error:', err);
      });
    }

    socket.on('disconnect', () => {
      disconnected = true;
      clearTypingTimers();
      releaseSession(userId);

      if (deps.friendRepository) {
        presence.trackUserDisconnection(io, userId, socket.id, deps.friendRepository).catch((err) => {
          console.error('trackUserDisconnection error:', err);
        });
      }
    });

    socket.on('typing', async (payload) => {
      try {
        if (disconnected) return;
        if (
          !payload
          || typeof payload.roomId !== 'string'
          || payload.roomId.length === 0
          || payload.roomId.length > 128
          || typeof payload.isTyping !== 'boolean'
        ) {
          throw new ValidationError('Invalid typing payload');
        }
        const { roomId, isTyping } = payload;
        const key = typingTimerKey(roomId);
        const ttl = typingTtlMs();
        const prior = typingClaims.get(key);

        // Check room membership at most once per typing TTL window.
        let checkedAt = prior?.checkedAt ?? 0;
        const subscribed = socket.rooms?.has(`room_${roomId}`) === true;
        if (!subscribed || Date.now() - checkedAt >= ttl) {
          const member = await deps.roomMemberRepository.findMember(roomId, userId);
          if (disconnected) return;
          if (!member || member.role === 'pending') {
            throw new ForbiddenError('Not a member of this room');
          }
          checkedAt = Date.now();
        }

        if (!isTyping) {
          stopTyping(roomId);
          return;
        }

        // Arm or reset the typing expiration timer for this socket.
        const live = typingClaims.get(key);
        if (live) clearTimeout(live.expiry);
        const expiry: ReturnType<typeof setTimeout> = setTimeout(() => {
          if (typingClaims.get(key)?.expiry !== expiry) return;
          typingClaims.delete(key);
          if (removeTypingSocket(roomId, userId, socket.id) && !disconnected) {
            emitTyping(roomId, false);
          }
        }, ttl);
        expiry.unref?.();
        typingClaims.set(key, { expiry, checkedAt });

        addTypingSocket(roomId, userId, socket.id);
        // Broadcast typing heartbeat to the room.
        emitTyping(roomId, true);
      } catch (err) {
        socket.emit('error', mapErrorToApiShape(err));
      }
    });

  });
};
