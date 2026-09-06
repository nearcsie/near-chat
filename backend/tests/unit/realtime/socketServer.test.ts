import { describe, it, expect, beforeEach, mock, type Mock } from 'bun:test';
import { attachSockets } from '../../../src/realtime/socketServer';
import type { ChatServer } from '../../../src/realtime/authSocket';

// Injected rather than `mock.module`'d: a module mock is process-global within
// a tier and cannot be undone, so stubbing presence here would also stub it for
// every later file in this tier. See backend/tests/CLAUDE.md and issue #467.
const presence = {
  trackUserConnection: mock().mockResolvedValue(undefined),
  trackUserDisconnection: mock().mockResolvedValue(undefined),
};

describe('attachSockets', () => {
  let connectionHandler: any;
  let handlers: Record<string, any>;
  let socket: any;
  let roomEmit: Mock<any>;
  let roomMemberRepo: {
    findByUser: Mock<any>;
    findMember: Mock<any>;
  };

  beforeEach(() => {
    handlers = {};
    roomEmit = mock();
    socket = {
      id: 'socket-1',
      data: { user: { userId: 'user-1', name: 'Alice' } },
      // A real Socket.IO socket tracks its rooms, and the typing handler reads
      // them to decide whether its cached membership check is still good.
      rooms: new Set(['user_user-1', 'room_room-active']),
      join: mock(),
      leave: mock(),
      emit: mock(),
      to: mock(() => ({ emit: roomEmit })),
      on: mock((event, handler) => {
        handlers[event] = handler;
      }),
    };
    roomMemberRepo = {
      findByUser: mock().mockResolvedValue([
        { roomId: 'room-active', role: 'member' },
        { roomId: 'room-pending', role: 'pending' },
      ]),
      findMember: mock().mockResolvedValue({ roomId: 'room-active', role: 'member' }),
    };

    const io = {
      on: mock((event, handler) => {
        if (event === 'connection') connectionHandler = handler;
      }),
      to: mock(() => ({ emit: roomEmit })),
    } as unknown as ChatServer;

    attachSockets(io, { roomMemberRepository: roomMemberRepo });
    connectionHandler(socket);
  });

  it('derives room subscriptions from active durable membership', async () => {
    await Promise.resolve();

    expect(roomMemberRepo.findByUser).toHaveBeenCalledWith('user-1');
    expect(socket.join).toHaveBeenCalledWith('room_room-active');
    expect(socket.join).not.toHaveBeenCalledWith('room_room-pending');
  });

  it('does not register durable commands or client-controlled room subscriptions', () => {
    expect(handlers.join_room).toBeUndefined();
    expect(handlers.leave_room).toBeUndefined();
    expect(handlers.send_message).toBeUndefined();
    expect(handlers.update_message).toBeUndefined();
    expect(handlers.recall_message).toBeUndefined();
    expect(handlers.read_receipt).toBeUndefined();
    expect(handlers.typing).toBeDefined();
  });

  it('broadcasts typing only after validating current membership', async () => {
    await handlers.typing({ roomId: 'room-active', isTyping: true });

    expect(roomMemberRepo.findMember).toHaveBeenCalledWith('room-active', 'user-1');
    expect(roomEmit).toHaveBeenCalledWith('user_typing', {
      roomId: 'room-active',
      userId: 'user-1',
      isTyping: true,
    });
  });

  it('rejects typing from a non-member', async () => {
    roomMemberRepo.findMember.mockResolvedValue(null);

    await handlers.typing({ roomId: 'room-hidden', isTyping: true });

    expect(roomEmit).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', {
      statusCode: 403,
      message: 'Not a member of this room',
      code: 'FORBIDDEN',
    });
  });

  it('refreshes typing without re-checking membership', async () => {
    // Let the connection's own subscription restore settle first: it calls
    // findMember once per active room, and that call is not what this pins.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const membershipChecks = () => roomMemberRepo.findMember.mock.calls.length;
    const baseline = membershipChecks();

    await handlers.typing({ roomId: 'room-active', isTyping: true });
    await handlers.typing({ roomId: 'room-active', isTyping: true });
    await handlers.typing({ roomId: 'room-active', isTyping: true });

    expect(membershipChecks() - baseline).toBe(1);
  });

  /**
   * The client arms its own removal timer only when it receives `true`
   * (`frontend/src/context/ChatContext.tsx:1593-1607`), so every refresh has to
   * reach the room. Collapsing these into a single edge event makes the
   * indicator vanish after one client timeout while the user is still typing.
   */
  it('re-broadcasts every typing refresh, which is the client heartbeat', async () => {
    await handlers.typing({ roomId: 'room-active', isTyping: true });
    await handlers.typing({ roomId: 'room-active', isTyping: true });
    await handlers.typing({ roomId: 'room-active', isTyping: true });

    expect(roomEmit).toHaveBeenCalledTimes(3);
    expect(roomEmit).toHaveBeenLastCalledWith('user_typing', {
      roomId: 'room-active',
      userId: 'user-1',
      isTyping: true,
    });
  });

  it('re-checks membership once per TTL even while a claim is refreshed', async () => {
    const previous = process.env.TYPING_TTL_MS;
    process.env.TYPING_TTL_MS = '10';
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const membershipChecks = () => roomMemberRepo.findMember.mock.calls.length;
      const baseline = membershipChecks();

      await handlers.typing({ roomId: 'room-active', isTyping: true });
      await handlers.typing({ roomId: 'room-active', isTyping: true });
      expect(membershipChecks() - baseline).toBe(1);

      // Access is revoked while the user keeps typing. The claim is refreshed
      // continuously, so only the TTL bound forces the re-check that stops them.
      roomMemberRepo.findMember.mockResolvedValue(null);
      await new Promise((resolve) => setTimeout(resolve, 25));
      await handlers.typing({ roomId: 'room-active', isTyping: true });

      expect(membershipChecks() - baseline).toBe(2);
      expect(socket.emit).toHaveBeenCalledWith('error', {
        statusCode: 403,
        message: 'Not a member of this room',
        code: 'FORBIDDEN',
      });
    } finally {
      if (previous === undefined) delete process.env.TYPING_TTL_MS;
      else process.env.TYPING_TTL_MS = previous;
    }
  });

  /**
   * `socketsLeave` removes the socket from the room but does not stop it
   * addressing that room, so losing the subscription has to invalidate the
   * cached membership check immediately rather than one TTL later.
   */
  it('stops trusting the membership cache once the socket leaves the room', async () => {
    await handlers.typing({ roomId: 'room-active', isTyping: true });
    const baseline = roomMemberRepo.findMember.mock.calls.length;
    roomEmit.mockClear();

    // What room revocation does, through publisher.removeUserFromRoom.
    socket.rooms.delete('room_room-active');
    roomMemberRepo.findMember.mockResolvedValue(null);
    await handlers.typing({ roomId: 'room-active', isTyping: true });

    expect(roomMemberRepo.findMember.mock.calls.length - baseline).toBe(1);
    expect(roomEmit).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', {
      statusCode: 403,
      message: 'Not a member of this room',
      code: 'FORBIDDEN',
    });
  });

  it('rejects a typing stop from a non-member', async () => {
    roomMemberRepo.findMember.mockResolvedValue(null);

    await handlers.typing({ roomId: 'room-hidden', isTyping: false });

    expect(roomEmit).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', {
      statusCode: 403,
      message: 'Not a member of this room',
      code: 'FORBIDDEN',
    });
  });

  it('does not broadcast a stop for a room this socket never claimed', async () => {
    await handlers.typing({ roomId: 'room-active', isTyping: false });

    expect(roomEmit).not.toHaveBeenCalled();
  });

  it('expires typing automatically at the server TTL', async () => {
    const previous = process.env.TYPING_TTL_MS;
    process.env.TYPING_TTL_MS = '10';
    try {
      await handlers.typing({ roomId: 'room-active', isTyping: true });
      await new Promise((resolve) => setTimeout(resolve, 25));

      expect(roomEmit).toHaveBeenLastCalledWith('user_typing', {
        roomId: 'room-active',
        userId: 'user-1',
        isTyping: false,
      });
    } finally {
      if (previous === undefined) delete process.env.TYPING_TTL_MS;
      else process.env.TYPING_TTL_MS = previous;
    }
  });

  describe('with friendRepository', () => {
    const friendRepo = { getFriends: mock() };

    beforeEach(() => {
      presence.trackUserConnection.mockClear();
      presence.trackUserDisconnection.mockClear();

      let frConnectionHandler: any;
      const frHandlers: Record<string, any> = {};
      const frSocket = {
        id: 'socket-fr-1',
        data: { user: { userId: 'user-1', name: 'Alice' } },
        rooms: new Set(['user_user-1', 'room_room-active']),
        join: mock(),
        leave: mock(),
        emit: mock(),
        to: mock(() => ({ emit: mock() })),
        on: mock((event, handler) => {
          frHandlers[event] = handler;
        }),
      };
      const frIo = {
        on: mock((event, handler) => {
          if (event === 'connection') frConnectionHandler = handler;
        }),
        to: mock(() => ({ emit: mock() })),
      } as unknown as ChatServer;

      attachSockets(frIo, {
        roomMemberRepository: roomMemberRepo,
        friendRepository: friendRepo,
        presence,
      });
      frConnectionHandler(frSocket);
      frHandlers.disconnect();
    });

    it('tracks a session on connect and disconnect', () => {
      expect(presence.trackUserConnection).toHaveBeenCalledWith(
        expect.anything(), 'user-1', 'socket-fr-1', friendRepo,
      );
      expect(presence.trackUserDisconnection).toHaveBeenCalledWith(
        expect.anything(), 'user-1', 'socket-fr-1', friendRepo,
      );
    });
  });
  describe('session limit', () => {
    const makeSocket = (id: string) => ({
      id,
      data: { user: { userId: 'user-1', name: 'Alice' } },
      join: mock(),
      leave: mock(),
      emit: mock(),
      to: mock(() => ({ emit: mock() })),
      on: mock(),
    });

    const attachLimited = (limit: string, reservationTtl?: string) => {
      const previous = process.env.MAX_SESSIONS_PER_USER;
      const previousTtl = process.env.SESSION_RESERVATION_TTL_MS;
      process.env.MAX_SESSIONS_PER_USER = limit;
      if (reservationTtl !== undefined) process.env.SESSION_RESERVATION_TTL_MS = reservationTtl;
      let middleware: any;
      let connect: any;
      const io = {
        use: mock((fn: any) => { middleware = fn; }),
        on: mock((event: string, handler: any) => {
          if (event === 'connection') connect = handler;
        }),
        to: mock(() => ({ emit: mock() })),
      } as unknown as ChatServer;
      attachSockets(io, { roomMemberRepository: roomMemberRepo });
      process.env.MAX_SESSIONS_PER_USER = previous;
      process.env.SESSION_RESERVATION_TTL_MS = previousTtl;
      return { middleware: middleware!, connect: connect! };
    };

    it('reserves a slot during the handshake so concurrent handshakes cannot overshoot', () => {
      const { middleware } = attachLimited('2');
      const results: Array<Error | undefined> = [];

      // Three handshakes complete their middleware before any of them reaches
      // the connection handler — the case that made the limit unenforceable.
      for (const id of ['s1', 's2', 's3']) {
        middleware(makeSocket(id), (err?: Error) => results.push(err));
      }

      expect(results[0]).toBeUndefined();
      expect(results[1]).toBeUndefined();
      expect(results[2]?.message).toBe('Session limit reached');
    });

    it('reclaims a reserved slot when the handshake never reaches connection', async () => {
      const { middleware } = attachLimited('1', '5');

      // The transport dies after the middleware runs, so the connection
      // handler — and with it the disconnect listener — never runs.
      middleware(makeSocket('aborted'), () => {});
      const whileReserved: Array<Error | undefined> = [];
      middleware(makeSocket('s2'), (err?: Error) => whileReserved.push(err));
      expect(whileReserved[0]?.message).toBe('Session limit reached');

      await new Promise((resolve) => setTimeout(resolve, 25));

      const afterExpiry: Array<Error | undefined> = [];
      middleware(makeSocket('s3'), (err?: Error) => afterExpiry.push(err));
      expect(afterExpiry[0]).toBeUndefined();
    });

    it('keeps the slot of a connection that arrived before its reservation expired', async () => {
      const { middleware, connect } = attachLimited('1', '5');
      const first = makeSocket('s1');
      const firstHandlers: Record<string, any> = {};
      first.on = mock((event: string, handler: any) => { firstHandlers[event] = handler; }) as any;

      middleware(first, () => {});
      connect(first);

      // The reservation timer must not hand this live session's slot back.
      await new Promise((resolve) => setTimeout(resolve, 25));

      const blocked: Array<Error | undefined> = [];
      middleware(makeSocket('s2'), (err?: Error) => blocked.push(err));
      expect(blocked[0]?.message).toBe('Session limit reached');

      firstHandlers.disconnect();
      const afterDisconnect: Array<Error | undefined> = [];
      middleware(makeSocket('s3'), (err?: Error) => afterDisconnect.push(err));
      expect(afterDisconnect[0]).toBeUndefined();
    });

    it('rejects a connection whose reservation expired once the limit refilled', async () => {
      const { middleware, connect } = attachLimited('1', '5');
      const late: any = { ...makeSocket('late'), disconnect: mock() };
      late.on = mock() as any;

      // The handshake reserves the only slot, then stalls past the TTL, so the
      // timer hands the slot back.
      middleware(late, () => {});
      await new Promise((resolve) => setTimeout(resolve, 25));

      // Someone else takes the freed slot and stays connected.
      const holder = makeSocket('holder');
      const holderHandlers: Record<string, any> = {};
      holder.on = mock((event: string, handler: any) => { holderHandlers[event] = handler; }) as any;
      const holderResult: Array<Error | undefined> = [];
      middleware(holder, (err?: Error) => holderResult.push(err));
      expect(holderResult[0]).toBeUndefined();
      connect(holder);

      // Now the stalled handshake finally reaches the connection handler. It no
      // longer holds a reservation, so taking a slot unconditionally would put
      // the user at two sessions against a limit of one.
      connect(late);

      expect(late.disconnect).toHaveBeenCalled();
      expect(late.join).not.toHaveBeenCalled();

      // The count must still be exactly the holder's one session.
      const after: Array<Error | undefined> = [];
      middleware(makeSocket('s3'), (err?: Error) => after.push(err));
      expect(after[0]?.message).toBe('Session limit reached');

      holderHandlers.disconnect();
      const afterRelease: Array<Error | undefined> = [];
      middleware(makeSocket('s4'), (err?: Error) => afterRelease.push(err));
      expect(afterRelease[0]).toBeUndefined();
    });

    it('frees the reserved slot when the session disconnects', () => {
      const { middleware, connect } = attachLimited('1');
      const first = makeSocket('s1');
      const firstHandlers: Record<string, any> = {};
      first.on = mock((event: string, handler: any) => { firstHandlers[event] = handler; }) as any;

      middleware(first, () => {});
      connect(first);
      const blocked: Array<Error | undefined> = [];
      middleware(makeSocket('s2'), (err?: Error) => blocked.push(err));
      expect(blocked[0]?.message).toBe('Session limit reached');

      firstHandlers.disconnect();
      const afterDisconnect: Array<Error | undefined> = [];
      middleware(makeSocket('s3'), (err?: Error) => afterDisconnect.push(err));
      expect(afterDisconnect[0]).toBeUndefined();
    });
  });

  /**
   * A revocation reaches the other instances as a `SOCKETS_LEAVE` frame, and
   * Redis pub/sub keeps no backlog: published while an instance's subscriber is
   * down, it is gone for good and that instance keeps the revoked member in the
   * room. The Sync Cursor cannot repair it — the damage is a stale local
   * subscription, not a missed durable event — so the subscription has to be
   * re-derived from the database once the subscriber is back.
   */
  describe('reconciling room subscriptions after a subscriber reconnect', () => {
    /** A socket as the namespace holds it, with the rooms it has joined. */
    const makeLive = (id: string, userId: string, rooms: string[]) => ({
      id,
      connected: true,
      data: { user: { userId } },
      rooms: new Set([id, `user_${userId}`, ...rooms]),
      join: mock(),
      leave: mock(function (this: any, room: string) {
        this.rooms.delete(room);
      }),
      emit: mock(),
      to: mock(() => ({ emit: mock() })),
      on: mock(),
    });

    /**
     * Attaches with a registration-style reconnect signal and hands back the
     * trigger, so a test fires the reconciliation without a Redis client.
     */
    const attachReconciler = (
      sockets: ReturnType<typeof makeLive>[],
      repo: { findByUser?: Mock<any>; findMember: Mock<any> },
      withRoomSubscriptionLock?: any,
      extra?: { reconcileRetryDelayMs?: number },
    ) => {
      let restored: (() => void) | undefined;
      const io = {
        on: mock(),
        to: mock(() => ({ emit: mock() })),
        of: mock(() => ({ sockets: new Map(sockets.map((s) => [s.id, s])) })),
      } as unknown as ChatServer;

      attachSockets(io, {
        roomMemberRepository: repo as any,
        withRoomSubscriptionLock,
        onSubscriberRestored: (handler: () => void) => {
          restored = handler;
          return () => {};
        },
        ...extra,
      });

      return {
        // Awaiting a macrotask lets the scan's awaited reads and leaves settle.
        trigger: async () => {
          restored?.();
          await new Promise((resolve) => setTimeout(resolve, 0));
        },
        registered: () => restored !== undefined,
      };
    };

    it('leaves the rooms membership no longer permits, and nothing else', async () => {
      const socket = makeLive('s1', 'user-1', ['room_kept', 'room_revoked']);
      const findByUser = mock().mockResolvedValue([{ roomId: 'kept', role: 'member' }]);
      const { trigger } = await attachReconciler([socket], {
        findByUser,
        findMember: mock(),
      });

      await trigger();

      expect(socket.leave).toHaveBeenCalledWith('room_revoked');
      expect(socket.leave).not.toHaveBeenCalledWith('room_kept');
      // The user's directed-event room and the socket's own room are not
      // derived from membership, so a membership scan must not touch them.
      expect(socket.leave).not.toHaveBeenCalledWith('user_user-1');
      expect(socket.leave).not.toHaveBeenCalledWith('s1');
    });

    it('leaves a room whose membership row is only pending', async () => {
      const socket = makeLive('s1', 'user-1', ['room_demoted']);
      const findByUser = mock().mockResolvedValue([{ roomId: 'demoted', role: 'pending' }]);
      const { trigger } = await attachReconciler([socket], {
        findByUser,
        findMember: mock(),
      });

      await trigger();

      expect(socket.leave).toHaveBeenCalledWith('room_demoted');
    });

    /**
     * `findByUser` is optional on `IRoomMemberRepository`. Reading its absence
     * as "this user is in no rooms" would empty every socket out of every room
     * it holds — the opposite of a repair.
     */
    it('leaves nothing at all when the repository cannot derive membership', async () => {
      const socket = makeLive('s1', 'user-1', ['room_kept', 'room_revoked']);
      const { trigger } = await attachReconciler([socket], { findMember: mock() });

      await trigger();

      expect(socket.leave).not.toHaveBeenCalled();
      expect(socket.emit).not.toHaveBeenCalled();
    });

    /** Same reasoning: a failed read is not evidence that access is gone. */
    it('leaves nothing when the membership read fails', async () => {
      const socket = makeLive('s1', 'user-1', ['room_revoked']);
      const findByUser = mock().mockRejectedValue(new Error('database is down'));
      const { trigger } = await attachReconciler(
        [socket],
        { findByUser, findMember: mock() },
        undefined,
        { reconcileRetryDelayMs: 1 },
      );

      await trigger();

      expect(socket.leave).not.toHaveBeenCalled();
    });

    /**
     * The signal fires once. If the pass that answered it skipped a user
     * because the database was briefly unavailable, nothing else will ever ask
     * again — the subscriber is back up, so no further signal is coming — and
     * that user's revoked socket would sit in its room until the client happens
     * to reconnect on its own.
     */
    it('retries a user whose membership read failed, and leaves once it succeeds', async () => {
      const socket = makeLive('s1', 'user-1', ['room_revoked']);
      const findByUser = mock()
        .mockRejectedValueOnce(new Error('database is down'))
        .mockResolvedValue([]);
      const { trigger } = await attachReconciler(
        [socket],
        { findByUser, findMember: mock() },
        undefined,
        { reconcileRetryDelayMs: 1 },
      );

      await trigger();
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(socket.leave).toHaveBeenCalledWith('room_revoked');
      expect(socket.emit).toHaveBeenCalledWith('realtime_ready');
    });

    it('stops retrying a database that stays down, rather than spinning', async () => {
      const socket = makeLive('s1', 'user-1', ['room_revoked']);
      const findByUser = mock().mockRejectedValue(new Error('database is down'));
      const { trigger } = await attachReconciler(
        [socket],
        { findByUser, findMember: mock() },
        undefined,
        { reconcileRetryDelayMs: 1 },
      );

      await trigger();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const attempts = findByUser.mock.calls.length;
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Bounded: the backoff runs out and the pass gives up loudly rather than
      // retrying against a database that is not coming back on its own.
      expect(attempts).toBeLessThanOrEqual(5);
      expect(findByUser.mock.calls.length).toBe(attempts);
      expect(socket.leave).not.toHaveBeenCalled();
    });

    it('signals recovery only to the sockets that actually lost a room', async () => {
      const evicted = makeLive('s1', 'user-1', ['room_revoked']);
      const untouched = makeLive('s2', 'user-2', ['room_kept']);
      const findByUser = mock(async (userId: string) =>
        (userId === 'user-2' ? [{ roomId: 'kept', role: 'member' }] : []));
      const { trigger } = await attachReconciler([evicted, untouched], {
        findByUser,
        findMember: mock(),
      });

      await trigger();

      // `realtime_ready` puts a client through a full `synchronize()`. A socket
      // that kept every room has nothing to recover, so broadcasting would buy
      // one wasted sync per connected client.
      expect(evicted.emit).toHaveBeenCalledWith('realtime_ready');
      expect(untouched.emit).not.toHaveBeenCalled();
    });

    it('reads membership once per user rather than once per session', async () => {
      const first = makeLive('s1', 'user-1', ['room_revoked']);
      const second = makeLive('s2', 'user-1', ['room_revoked']);
      const findByUser = mock().mockResolvedValue([]);
      const { trigger } = await attachReconciler([first, second], {
        findByUser,
        findMember: mock(),
      });

      await trigger();

      expect(first.leave).toHaveBeenCalledWith('room_revoked');
      expect(second.leave).toHaveBeenCalledWith('room_revoked');
      // One read for the candidate set, one confirming re-read under the lock —
      // not one of each per session.
      expect(findByUser.mock.calls.length).toBe(2);
    });

    /**
     * A grant commits and only then joins the room, so a membership granted
     * after the candidate set was read is already in `socket.rooms` while still
     * missing from that snapshot. Acting on the snapshot would evict a socket
     * that had just been legitimately authorized.
     */
    it('re-reads under the lock and spares a room granted mid-scan', async () => {
      const socket = makeLive('s1', 'user-1', ['room_granted']);
      const findByUser = mock()
        .mockResolvedValueOnce([])
        .mockResolvedValue([{ roomId: 'granted', role: 'member' }]);
      const withRoomSubscriptionLock = mock(
        async (_userId: string, _roomId: string, operation: () => Promise<unknown>) => operation(),
      );
      const { trigger } = await attachReconciler(
        [socket],
        { findByUser, findMember: mock() },
        withRoomSubscriptionLock,
      );

      await trigger();

      expect(withRoomSubscriptionLock).toHaveBeenCalledWith(
        'user-1', 'granted', expect.any(Function),
      );
      expect(socket.leave).not.toHaveBeenCalled();
      expect(socket.emit).not.toHaveBeenCalled();
    });

    /**
     * What makes it safe for `utils/redis.ts` to signal on the very first
     * subscription rather than only on reconnects: with no session held there
     * is nothing to check, so the pass costs one map read and no query at all.
     */
    it('queries nothing when this process holds no sockets', async () => {
      const findByUser = mock();
      const { trigger } = await attachReconciler([], {
        findByUser,
        findMember: mock(),
      });

      await trigger();

      expect(findByUser).not.toHaveBeenCalled();
    });

    it('registers nothing to reconcile when no reconnect signal is wired', () => {
      const socket = makeLive('s1', 'user-1', ['room_revoked']);
      const io = {
        on: mock(),
        to: mock(() => ({ emit: mock() })),
        of: mock(() => ({ sockets: new Map([[socket.id, socket]]) })),
      } as unknown as ChatServer;

      // Without `REDIS_URL` no revocation ever leaves the process, so there is
      // no lost frame to repair and no signal to subscribe to.
      expect(() => attachSockets(io, { roomMemberRepository: roomMemberRepo })).not.toThrow();
      expect(socket.leave).not.toHaveBeenCalled();
    });
  });
});
