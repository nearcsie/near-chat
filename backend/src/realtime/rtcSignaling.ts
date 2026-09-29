import { z } from 'zod';
import type { RtcSignal, RtcSignalAck, RtcSignalEvent } from '@shared/types';
import { AppError, ForbiddenError, ValidationError } from '../utils/AppError';
import { mapErrorToApiShape } from '../utils/mapError';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/** The relationship reads every non-`end` call signal is authorized against. */
export interface RtcRelationships {
  areFriends(user1: string, user2: string): Promise<boolean>;
  isBlocked(user1: string, user2: string): Promise<boolean>;
}

/** The part of a connected socket the relay uses. */
export interface RtcSocket {
  on(event: 'rtc_signal', listener: (...args: unknown[]) => void): unknown;
  to(room: string): { emit(event: 'rtc_signal', payload: RtcSignalEvent): unknown };
}

/** The part of the server the relay uses. */
export interface RtcServer {
  to(room: string): { emit(event: 'rtc_signal', payload: RtcSignalEvent): unknown };
}

/** Bound on `callId` and `sessionTag`, which are opaque client-chosen tokens. */
export const RTC_TOKEN_MAX_LENGTH = 64;

/** The same bound `typing` puts on `roomId`. */
export const RTC_TARGET_MAX_LENGTH = 128;

export const RTC_SDP_MAX_BYTES = 32 * 1024;

export const RTC_CANDIDATE_MAX_BYTES = 1024;

/**
 * Bound on `sdpMid` and `usernameFragment`. The issue leaves both open, but an
 * unbounded string would be relayed verbatim; RFC 8839 caps `ice-ufrag` at 256
 * characters and a media id is far shorter.
 */
export const RTC_ICE_FIELD_MAX_LENGTH = 256;

interface RtcLimit {
  max: number;
  windowMs: number;
}

/** Invitations from one caller to one target. */
export const RTC_INVITE_LIMIT: RtcLimit = { max: 5, windowMs: 60_000 };

/** Every signal from one user, across all of their sessions on this instance. */
export const RTC_SIGNAL_LIMIT: RtcLimit = { max: 200, windowMs: 10_000 };

/** How often expired rate-limit windows are dropped: the longest window. */
const LIMIT_SWEEP_INTERVAL_MS = RTC_INVITE_LIMIT.windowMs;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const token = z.string().min(1).max(RTC_TOKEN_MAX_LENGTH).regex(/^[A-Za-z0-9_-]+$/);

const withinBytes = (max: number) => (value: string) => Buffer.byteLength(value, 'utf8') <= max;

const addressing = {
  callId: token,
  targetUserId: z.string().min(1).max(RTC_TARGET_MAX_LENGTH),
};

// `z.object` strips keys it does not declare, so what comes out is a fresh
// object holding only validated fields — a client-supplied `fromUserId` or any
// other extra property never reaches the peer.
const rtcSignalSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('invite'),
    ...addressing,
    media: z.enum(['audio', 'video']),
  }),
  z.object({
    kind: z.literal('accept'),
    ...addressing,
    sessionTag: token,
  }),
  z.object({
    kind: z.literal('sdp'),
    ...addressing,
    sessionTag: token,
    description: z.object({
      type: z.enum(['offer', 'answer']),
      sdp: z.string().refine(withinBytes(RTC_SDP_MAX_BYTES)),
    }),
  }),
  z.object({
    kind: z.literal('ice'),
    ...addressing,
    sessionTag: token,
    candidate: z.object({
      // Empty is valid: browsers send it to mark end-of-candidates.
      candidate: z.string().refine(withinBytes(RTC_CANDIDATE_MAX_BYTES)),
      sdpMid: z.string().max(RTC_ICE_FIELD_MAX_LENGTH).nullable(),
      sdpMLineIndex: z.number().int().min(0).max(65_535).nullable(),
      usernameFragment: z.string().max(RTC_ICE_FIELD_MAX_LENGTH).nullable().optional(),
    }),
  }),
  z.object({
    kind: z.literal('end'),
    ...addressing,
    sessionTag: token.optional(),
    reason: z.enum(['declined', 'cancelled', 'hangup', 'timeout', 'failed']),
  }),
]);

/**
 * Validates an untrusted `rtc_signal` payload and returns a fresh copy of it.
 *
 * `targetUserId` is lowercased: Postgres compares UUIDs case-insensitively, so
 * an uppercase copy of an id would pass the relationship check and then be
 * routed to a `user_<id>` room nobody is in — and an uppercase copy of the
 * sender's own id would slip past the self check.
 */
export const parseRtcSignal = (payload: unknown): RtcSignal => {
  const result = rtcSignalSchema.safeParse(payload);
  if (!result.success) throw new ValidationError('Invalid rtc_signal payload');
  return { ...result.data, targetUserId: result.data.targetUserId.toLowerCase() };
};

/** Fixed-window counters, swept lazily so the relay holds no timer of its own. */
const createWindowCounter = (now: () => number) => {
  const windows = new Map<string, { count: number; resetAt: number }>();
  let nextSweepAt = 0;

  return (key: string, { max, windowMs }: RtcLimit): boolean => {
    const at = now();
    if (at >= nextSweepAt) {
      for (const [expired, window] of windows) {
        if (window.resetAt <= at) windows.delete(expired);
      }
      nextSweepAt = at + LIMIT_SWEEP_INTERVAL_MS;
    }
    const window = windows.get(key);
    if (!window || window.resetAt <= at) {
      windows.set(key, { count: 1, resetAt: at + windowMs });
      return true;
    }
    if (window.count >= max) return false;
    window.count += 1;
    return true;
  };
};

export interface RtcSignalingOptions {
  /**
   * Defaults to the switch the HTTP rate limits honour (`RATE_LIMIT_DISABLED`,
   * and always off under `NODE_ENV=test`), so everyday development is not
   * throttled while a call UI is being built.
   */
  limitsEnabled?: boolean;
  now?: () => number;
}

const unreachable = (): ForbiddenError => new ForbiddenError('Cannot interact with this user');

const tooManySignals = (): AppError => new AppError(429, 'Too many call signals', 'TOO_MANY_REQUESTS');

/**
 * Relays WebRTC call signals between two users. Nothing is stored: a signal is
 * validated, authorized, rate limited and forwarded to the target's
 * `user_<id>` room, or it is refused through the Socket.IO ack.
 *
 * `relationships` is absent only where no friend repository is wired (some
 * tests); every relationship-gated signal is then refused rather than relayed.
 */
export const createRtcSignaling = (
  io: RtcServer,
  relationships: RtcRelationships | undefined,
  options: RtcSignalingOptions = {},
) => {
  const limitsEnabled = options.limitsEnabled ?? !env().rateLimit.disabled;
  const hit = createWindowCounter(options.now ?? Date.now);

  // One chain per user rather than per socket: it keeps a later `ice` or `end`
  // from overtaking an `sdp` whose authorization is still in flight, and it
  // keeps doing so across the socket swap every token refresh causes. Nothing
  // here is dropped on disconnect — the relay depends on who sent a signal, not
  // on the socket it came through, and `end` is the one signal that must
  // always get through.
  const chains = new Map<string, Promise<void>>();

  const enqueue = (userId: string, step: () => Promise<void>): void => {
    const next = (chains.get(userId) ?? Promise.resolve())
      .then(step)
      .catch((err) => {
        logger.error({ err }, 'rtc_signal relay step failed');
      });
    chains.set(userId, next);
    void next.then(() => {
      if (chains.get(userId) === next) chains.delete(userId);
    });
  };

  const authorize = async (userId: string, signal: RtcSignal): Promise<void> => {
    // `end` is checked for nothing but shape and rate: a hangup has to reach
    // the peer even after the two stopped being friends or one blocked the other.
    if (signal.kind === 'end') return;
    if (!relationships) throw unreachable();
    // Read on every signal, never cached: a call carries a few dozen signals,
    // and a cache would let a revoked friendship keep relaying until it expired.
    const [friends, blocked] = await Promise.all([
      relationships.areFriends(userId, signal.targetUserId),
      relationships.isBlocked(userId, signal.targetUserId),
    ]);
    // One answer for both, so a caller cannot tell a block from a non-friend.
    if (!friends || blocked) throw unreachable();
  };

  const relay = (socket: RtcSocket, userId: string, signal: RtcSignal): void => {
    const event: RtcSignalEvent = { ...signal, fromUserId: userId };
    io.to(`user_${signal.targetUserId}`).emit('rtc_signal', event);
    // The sender's other sessions learn that the call was answered or ended
    // here, so they stop ringing. `socket.to` leaves out only this socket.
    if (signal.kind === 'accept' || signal.kind === 'end') {
      socket.to(`user_${userId}`).emit('rtc_signal', event);
    }
  };

  return {
    /** Registers the `rtc_signal` listener on one connected socket. */
    attach(socket: RtcSocket, userId: string): void {
      const self = userId.toLowerCase();

      // Untyped on purpose: the payload is whatever the client sent. Socket.IO
      // appends the ack as the last argument, wherever that falls.
      socket.on('rtc_signal', (...args: unknown[]) => {
        const last = args[args.length - 1];
        const ack = typeof last === 'function' ? (last as (result: RtcSignalAck) => void) : undefined;
        const reply = (result: RtcSignalAck): void => {
          ack?.(result);
        };
        const refuse = (err: unknown): void => {
          reply({ ok: false, error: mapErrorToApiShape(err) });
        };

        // Socket.IO calls listeners from `process.nextTick` without a catch,
        // so a throw from this synchronous half would be uncaught.
        try {
          const signal = parseRtcSignal(ack && args.length === 1 ? undefined : args[0]);
          if (limitsEnabled && !hit(`all:${self}`, RTC_SIGNAL_LIMIT)) throw tooManySignals();
          if (signal.targetUserId === self) throw new ForbiddenError('Cannot signal yourself');
          // Checked before anything reaches the database: the id columns are
          // UUIDs, so any other string would fail inside Postgres as a 500.
          if (!UUID_PATTERN.test(signal.targetUserId)) throw unreachable();
          if (
            limitsEnabled
            && signal.kind === 'invite'
            && !hit(`invite:${self}:${signal.targetUserId}`, RTC_INVITE_LIMIT)
          ) {
            throw tooManySignals();
          }

          enqueue(self, async () => {
            try {
              await authorize(self, signal);
              relay(socket, self, signal);
              reply({ ok: true });
            } catch (err) {
              refuse(err);
            }
          });
        } catch (err) {
          refuse(err);
        }
      });
    },
  };
};
