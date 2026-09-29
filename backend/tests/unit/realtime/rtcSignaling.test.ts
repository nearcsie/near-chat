import { describe, it, expect, mock } from 'bun:test';
import type { RtcSignalAck, RtcSignalEvent } from '../../../../shared/types';
import {
  createRtcSignaling,
  RTC_CANDIDATE_MAX_BYTES,
  RTC_INVITE_LIMIT,
  RTC_SDP_MAX_BYTES,
  RTC_SIGNAL_LIMIT,
  type RtcRelationships,
  type RtcSignalingOptions,
} from '../../../src/realtime/rtcSignaling';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CAROL = '33333333-3333-4333-8333-333333333333';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Friendships and directed blocks, answered the way `friendRepository`
 * answers them: `isBlocked` holds in either direction.
 */
const makeRelationships = (
  friends: [string, string][] = [[ALICE, BOB]],
  blocks: [blocker: string, blocked: string][] = [],
) => {
  const pairOf = (a: string, b: string) => [a, b].sort().join(':');
  const friendPairs = new Set(friends.map(([a, b]) => pairOf(a, b)));
  return {
    areFriends: mock(async (a: string, b: string) => friendPairs.has(pairOf(a, b))),
    isBlocked: mock(async (a: string, b: string) =>
      blocks.some(([blocker, blocked]) =>
        (blocker === a && blocked === b) || (blocker === b && blocked === a))),
  };
};

interface Delivery {
  room: string;
  /** The socket a `socket.to(...)` broadcast leaves out. */
  except?: string;
  event: RtcSignalEvent;
}

/** `null` stands for "no friend repository wired". */
const makeRelay = (
  relationships: RtcRelationships | null = makeRelationships(),
  options: RtcSignalingOptions = { limitsEnabled: true },
) => {
  const delivered: Delivery[] = [];
  const io = {
    to: (room: string) => ({
      emit: (_event: 'rtc_signal', event: RtcSignalEvent) => {
        delivered.push({ room, event });
      },
    }),
  };
  const rtc = createRtcSignaling(io, relationships ?? undefined, options);

  const connect = (userId: string, socketId = `${userId}-socket`) => {
    let listener!: (...args: unknown[]) => void;
    rtc.attach(
      {
        on: (_event, handler) => {
          listener = handler;
        },
        to: (room: string) => ({
          emit: (_event: 'rtc_signal', event: RtcSignalEvent) => {
            delivered.push({ room, except: socketId, event });
          },
        }),
      },
      userId,
    );
    return {
      send: (payload: unknown) =>
        new Promise<RtcSignalAck>((resolve) => listener(payload, resolve)),
      raw: (...args: unknown[]) => listener(...args),
    };
  };

  return { connect, delivered };
};

const invite = (overrides: Record<string, unknown> = {}) => ({
  kind: 'invite',
  callId: 'call-1',
  targetUserId: BOB,
  media: 'audio',
  ...overrides,
});

const sdp = (overrides: Record<string, unknown> = {}) => ({
  kind: 'sdp',
  callId: 'call-1',
  targetUserId: BOB,
  sessionTag: 'tag-1',
  description: { type: 'offer', sdp: 'v=0' },
  ...overrides,
});

const ice = (candidate: Record<string, unknown> = {}, overrides: Record<string, unknown> = {}) => ({
  kind: 'ice',
  callId: 'call-1',
  targetUserId: BOB,
  sessionTag: 'tag-1',
  candidate: { candidate: 'candidate:1 1 udp 1 192.0.2.1 5000 typ host', sdpMid: '0', sdpMLineIndex: 0, ...candidate },
  ...overrides,
});

const end = (overrides: Record<string, unknown> = {}) => ({
  kind: 'end',
  callId: 'call-1',
  targetUserId: BOB,
  reason: 'hangup',
  ...overrides,
});

describe('rtc_signal relay', () => {
  describe('delivery', () => {
    it('relays an invite between friends to the target, with a server-derived sender and nothing else', async () => {
      const { connect, delivered } = makeRelay();

      const ack = await connect(ALICE).send(invite({ fromUserId: CAROL, extra: 'dropped' }));

      expect(ack).toEqual({ ok: true });
      expect(delivered).toHaveLength(1);
      expect(delivered[0]).toStrictEqual({
        room: `user_${BOB}`,
        event: { kind: 'invite', callId: 'call-1', targetUserId: BOB, media: 'audio', fromUserId: ALICE },
      });
    });

    it('rebuilds nested objects from validated fields only', async () => {
      const { connect, delivered } = makeRelay();

      await connect(ALICE).send(ice({ foo: 'bar' }));
      await connect(ALICE).send(sdp({ description: { type: 'offer', sdp: 'v=0', injected: true } }));

      expect(delivered.map((d) => d.event)).toStrictEqual([
        {
          kind: 'ice',
          callId: 'call-1',
          targetUserId: BOB,
          sessionTag: 'tag-1',
          candidate: { candidate: 'candidate:1 1 udp 1 192.0.2.1 5000 typ host', sdpMid: '0', sdpMLineIndex: 0 },
          fromUserId: ALICE,
        },
        {
          kind: 'sdp',
          callId: 'call-1',
          targetUserId: BOB,
          sessionTag: 'tag-1',
          description: { type: 'offer', sdp: 'v=0' },
          fromUserId: ALICE,
        },
      ]);
    });

    it('mirrors accept and end to the sender\'s other sessions, leaving out the sending socket', async () => {
      const { connect, delivered } = makeRelay();
      const bob = connect(BOB, 'bob-tab-1');

      await bob.send({ kind: 'accept', callId: 'call-1', targetUserId: ALICE, sessionTag: 'tag-1' });
      await bob.send(end({ targetUserId: ALICE, sessionTag: 'tag-1', reason: 'declined' }));

      expect(delivered.map(({ room, except, event }) => [room, except, event.kind])).toEqual([
        [`user_${ALICE}`, undefined, 'accept'],
        [`user_${BOB}`, 'bob-tab-1', 'accept'],
        [`user_${ALICE}`, undefined, 'end'],
        [`user_${BOB}`, 'bob-tab-1', 'end'],
      ]);
    });

    it('does not mirror invite, sdp or ice to the sender', async () => {
      const { connect, delivered } = makeRelay();
      const alice = connect(ALICE);

      await alice.send(invite());
      await alice.send(sdp());
      await alice.send(ice());

      expect(delivered.map((d) => d.room)).toEqual([`user_${BOB}`, `user_${BOB}`, `user_${BOB}`]);
    });

    it('routes an uppercase target id to the lowercase room the target actually holds', async () => {
      const { connect, delivered } = makeRelay();

      const ack = await connect(ALICE).send(invite({ targetUserId: BOB.toUpperCase() }));

      expect(ack).toEqual({ ok: true });
      expect(delivered[0].room).toBe(`user_${BOB}`);
      expect(delivered[0].event.targetUserId).toBe(BOB);
    });

    it('relays an empty candidate, which marks end-of-candidates', async () => {
      const { connect, delivered } = makeRelay();

      const ack = await connect(ALICE).send(ice({ candidate: '', usernameFragment: null }));

      expect(ack).toEqual({ ok: true });
      expect(delivered[0].event).toMatchObject({ candidate: { candidate: '', usernameFragment: null } });
    });
  });

  describe('authorization', () => {
    it('refuses every kind aimed at the sender, in any letter case', async () => {
      const { connect, delivered } = makeRelay();
      const alice = connect(ALICE);

      for (const target of [ALICE, ALICE.toUpperCase()]) {
        expect(await alice.send(invite({ targetUserId: target }))).toEqual({
          ok: false,
          error: { statusCode: 403, message: 'Cannot signal yourself', code: 'FORBIDDEN' },
        });
        expect(await alice.send(end({ targetUserId: target }))).toMatchObject({
          ok: false,
          error: { statusCode: 403 },
        });
      }
      expect(delivered).toHaveLength(0);
    });

    it('refuses a non-friend and a block in either direction with the same generic 403', async () => {
      const relationships = makeRelationships([[ALICE, BOB], [ALICE, CAROL]], [[BOB, ALICE]]);
      const { connect, delivered } = makeRelay(relationships);
      const DAVE = '44444444-4444-4444-8444-444444444444';

      // Bob blocked Alice: Alice cannot reach Bob, and Bob cannot reach Alice.
      const blockedByTarget = await connect(ALICE).send(invite());
      const blockedByCaller = await connect(BOB).send(invite({ targetUserId: ALICE }));
      const notFriends = await connect(ALICE).send(invite({ targetUserId: DAVE }));
      const stillFriends = await connect(ALICE).send(invite({ targetUserId: CAROL }));

      const generic = { ok: false, error: { statusCode: 403, message: 'Cannot interact with this user', code: 'FORBIDDEN' } };
      expect(blockedByTarget).toEqual(generic);
      expect(blockedByCaller).toEqual(generic);
      expect(notFriends).toEqual(generic);
      expect(stillFriends).toEqual({ ok: true });
      expect(delivered.map((d) => d.room)).toEqual([`user_${CAROL}`]);
    });

    it('re-reads the relationship for every signal instead of caching it', async () => {
      const relationships = makeRelationships();
      const { connect } = makeRelay(relationships);
      const alice = connect(ALICE);

      await alice.send(invite());
      await alice.send(sdp());
      relationships.isBlocked.mockImplementation(async () => true);
      const afterBlock = await alice.send(ice());

      expect(relationships.areFriends).toHaveBeenCalledTimes(3);
      expect(relationships.isBlocked).toHaveBeenCalledTimes(3);
      expect(afterBlock).toMatchObject({ ok: false, error: { statusCode: 403 } });
    });

    it('still relays end to a user who blocked the sender, without reading the relationship', async () => {
      const relationships = makeRelationships([], [[BOB, ALICE]]);
      const { connect, delivered } = makeRelay(relationships);

      const ack = await connect(ALICE).send(end());

      expect(ack).toEqual({ ok: true });
      expect(delivered.map((d) => d.room)).toEqual([`user_${BOB}`, `user_${ALICE}`]);
      expect(relationships.areFriends).not.toHaveBeenCalled();
      expect(relationships.isBlocked).not.toHaveBeenCalled();
    });

    it('refuses a target that is not a user id without touching the database', async () => {
      const relationships = makeRelationships();
      const { connect, delivered } = makeRelay(relationships);

      const ack = await connect(ALICE).send(invite({ targetUserId: 'not-a-uuid' }));

      expect(ack).toEqual({
        ok: false,
        error: { statusCode: 403, message: 'Cannot interact with this user', code: 'FORBIDDEN' },
      });
      expect(relationships.areFriends).not.toHaveBeenCalled();
      expect(delivered).toHaveLength(0);
    });

    it('refuses gated signals when no friend repository is wired, but still relays end', async () => {
      const { connect, delivered } = makeRelay(null);
      const alice = connect(ALICE);

      expect(await alice.send(invite())).toMatchObject({ ok: false, error: { statusCode: 403 } });
      expect(await alice.send(end())).toEqual({ ok: true });
      expect(delivered.map((d) => d.event.kind)).toEqual(['end', 'end']);
    });

    it('reports a failed relationship read as a 500 and keeps relaying later signals', async () => {
      const relationships = makeRelationships();
      relationships.areFriends.mockImplementationOnce(async () => {
        throw new Error('connection lost');
      });
      const { connect, delivered } = makeRelay(relationships);
      const alice = connect(ALICE);

      const failed = await alice.send(invite());
      const next = await alice.send(invite({ callId: 'call-2' }));

      expect(failed).toMatchObject({ ok: false, error: { statusCode: 500 } });
      expect(next).toEqual({ ok: true });
      expect(delivered.map((d) => d.event.callId)).toEqual(['call-2']);
    });
  });

  describe('validation', () => {
    const rejects = async (payload: unknown) => {
      const { connect, delivered } = makeRelay();
      const ack = await connect(ALICE).send(payload);
      expect(ack).toEqual({
        ok: false,
        error: { statusCode: 400, message: 'Invalid rtc_signal payload', code: 'VALIDATION_ERROR' },
      });
      expect(delivered).toHaveLength(0);
    };

    it('rejects an sdp over 32 KiB, measured in bytes rather than characters', async () => {
      await rejects(sdp({ description: { type: 'offer', sdp: 'a'.repeat(RTC_SDP_MAX_BYTES + 1) } }));
      // 2 bytes per character: under the limit in characters, over it in bytes.
      await rejects(sdp({ description: { type: 'offer', sdp: 'é'.repeat(RTC_SDP_MAX_BYTES / 2 + 1) } }));

      const { connect } = makeRelay();
      expect(await connect(ALICE).send(sdp({ description: { type: 'answer', sdp: 'a'.repeat(RTC_SDP_MAX_BYTES) } })))
        .toEqual({ ok: true });
    });

    it('rejects a candidate over 1 KiB', async () => {
      await rejects(ice({ candidate: 'a'.repeat(RTC_CANDIDATE_MAX_BYTES + 1) }));
    });

    it('rejects an unknown kind, media or reason', async () => {
      await rejects(invite({ kind: 'ring' }));
      await rejects(invite({ media: 'screen' }));
      await rejects(end({ reason: 'bored' }));
    });

    it('rejects malformed ids and tokens', async () => {
      await rejects(invite({ callId: '' }));
      await rejects(invite({ callId: 'a'.repeat(65) }));
      await rejects(invite({ callId: 'call 1' }));
      await rejects(sdp({ sessionTag: 'tag/1' }));
      await rejects(invite({ targetUserId: 'a'.repeat(129) }));
      await rejects(end({ sessionTag: null }));
    });

    it('rejects a payload that is missing or not an object', async () => {
      await rejects(undefined);
      await rejects('invite');
      await rejects(sdp({ description: undefined }));
      await rejects(ice({ sdpMLineIndex: -1 }));
      await rejects(ice({ sdpMLineIndex: 0.5 }));
    });
  });

  describe('ordering', () => {
    it('delivers a later signal only after an earlier one still being authorized', async () => {
      const relationships = makeRelationships();
      let releaseSdp!: () => void;
      relationships.areFriends.mockImplementationOnce(
        () => new Promise<boolean>((resolve) => {
          releaseSdp = () => resolve(true);
        }),
      );
      const { connect, delivered } = makeRelay(relationships);
      const alice = connect(ALICE);

      const sdpAck = alice.send(sdp());
      const iceAck = alice.send(ice());
      await flush();
      expect(delivered).toHaveLength(0);

      releaseSdp();
      await Promise.all([sdpAck, iceAck]);
      expect(delivered.map((d) => d.event.kind)).toEqual(['sdp', 'ice']);
    });

    it('keeps that order across the socket swap a token refresh causes', async () => {
      const relationships = makeRelationships();
      let releaseSdp!: () => void;
      relationships.areFriends.mockImplementationOnce(
        () => new Promise<boolean>((resolve) => {
          releaseSdp = () => resolve(true);
        }),
      );
      const { connect, delivered } = makeRelay(relationships);

      const sdpAck = connect(ALICE, 'old-socket').send(sdp());
      const endAck = connect(ALICE, 'new-socket').send(end());
      await flush();
      releaseSdp();
      await Promise.all([sdpAck, endAck]);

      expect(delivered.filter((d) => d.room === `user_${BOB}`).map((d) => d.event.kind)).toEqual(['sdp', 'end']);
    });
  });

  describe('rate limits', () => {
    it('refuses the sixth invite from one caller to one target within a minute', async () => {
      let now = 0;
      const { connect } = makeRelay(makeRelationships([[ALICE, BOB], [ALICE, CAROL]]), {
        limitsEnabled: true,
        now: () => now,
      });
      const alice = connect(ALICE);

      for (let i = 0; i < RTC_INVITE_LIMIT.max; i++) {
        expect(await alice.send(invite({ callId: `call-${i}` }))).toEqual({ ok: true });
      }
      expect(await alice.send(invite({ callId: 'call-over' }))).toEqual({
        ok: false,
        error: { statusCode: 429, message: 'Too many call signals', code: 'TOO_MANY_REQUESTS' },
      });
      // Another target has its own budget, and the window reopens once it ends.
      expect(await alice.send(invite({ targetUserId: CAROL }))).toEqual({ ok: true });
      now += RTC_INVITE_LIMIT.windowMs;
      expect(await alice.send(invite({ callId: 'call-next' }))).toEqual({ ok: true });
    });

    it('caps every signal from one user across all of their sessions', async () => {
      const { connect } = makeRelay(makeRelationships(), { limitsEnabled: true, now: () => 0 });
      const tabs = [connect(ALICE, 'tab-1'), connect(ALICE, 'tab-2')];

      for (let i = 0; i < RTC_SIGNAL_LIMIT.max; i++) {
        tabs[i % 2].raw(ice(), () => {});
      }
      expect(await tabs[0].send(ice())).toMatchObject({ ok: false, error: { statusCode: 429 } });
      expect(await tabs[1].send(end())).toMatchObject({ ok: false, error: { statusCode: 429 } });
    });

    it('counts well-formed signals it refuses, so they cannot be sent without bound', async () => {
      const { connect } = makeRelay(makeRelationships(), { limitsEnabled: true, now: () => 0 });
      const alice = connect(ALICE);

      for (let i = 0; i < RTC_SIGNAL_LIMIT.max / 2; i++) {
        alice.raw(invite({ targetUserId: 'not-a-uuid' }), () => {});
        alice.raw(invite({ targetUserId: ALICE }), () => {});
      }
      expect(await alice.send(invite())).toMatchObject({ ok: false, error: { statusCode: 429 } });
    });

    it('counts only signals that passed validation', async () => {
      const { connect } = makeRelay(makeRelationships(), { limitsEnabled: true, now: () => 0 });
      const alice = connect(ALICE);

      for (let i = 0; i < RTC_SIGNAL_LIMIT.max; i++) alice.raw({ kind: 'bogus' }, () => {});
      expect(await alice.send(invite())).toEqual({ ok: true });
    });

    it('follows the switch the HTTP limits honour, which is off under test', async () => {
      const { connect } = makeRelay(makeRelationships(), {});
      const alice = connect(ALICE);

      for (let i = 0; i <= RTC_INVITE_LIMIT.max; i++) {
        expect(await alice.send(invite({ callId: `call-${i}` }))).toEqual({ ok: true });
      }
    });
  });

  describe('ack handling', () => {
    it('relays a signal sent without an ack and does not throw', async () => {
      const { connect, delivered } = makeRelay();
      const alice = connect(ALICE);

      expect(() => alice.raw(invite())).not.toThrow();
      expect(() => alice.raw({ kind: 'bogus' })).not.toThrow();
      await flush();

      expect(delivered.map((d) => d.event.kind)).toEqual(['invite']);
    });

    it('takes the ack from the last argument, wherever the client put it', async () => {
      const { connect } = makeRelay();
      const alice = connect(ALICE);

      const ack = await new Promise<RtcSignalAck>((resolve) => alice.raw(invite(), 'extra', resolve));
      const lone = await new Promise<RtcSignalAck>((resolve) => alice.raw(resolve));

      expect(ack).toEqual({ ok: true });
      expect(lone).toMatchObject({ ok: false, error: { statusCode: 400 } });
    });
  });
});
