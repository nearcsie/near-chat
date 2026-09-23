import { describe, it, expect, mock } from 'bun:test';
import { createRealtimePublisher } from '../../../src/realtime/publisher';
import type { ChatServer } from '../../../src/realtime/authSocket';

/**
 * A Socket.IO server stand-in that records which operator each call went
 * through.
 *
 * The distinction this pins did not exist before the cluster adapter: with the
 * in-memory adapter every disconnect was local by construction, so `local` was
 * a no-op and nothing could tell the two apart. Now the reach of a disconnect
 * is a deliberate choice per call site, and the wrong one is not visible in
 * this module's own behaviour — it only shows up as other instances dropping
 * their clients.
 */
const createStubServer = () => {
  const calls: { scope: string; force: boolean }[] = [];
  const events: { scope: string; event: string; payload: unknown }[] = [];
  const joins: { scope: string; room: string }[] = [];
  const leaves: { scope: string; room: string }[] = [];
  const operator = (scope: string) => ({
    disconnectSockets: (force: boolean) => calls.push({ scope, force }),
    socketsJoin: (room: string) => joins.push({ scope, room }),
    socketsLeave: (room: string) => leaves.push({ scope, room }),
    emit: (event: string, payload: unknown) => events.push({ scope, event, payload }),
  });

  const io = {
    get local() {
      return operator('local');
    },
    in: (room: string) => operator(`in:${room}`),
    to: (room: string) => operator(`to:${room}`),
    disconnectSockets: (force: boolean) => calls.push({ scope: 'cluster', force }),
  } as unknown as ChatServer;

  return { io, calls, events, joins, leaves };
};

describe('realtime publisher', () => {
  it('keeps shutdown to this instance, so a rolling restart is not a cluster outage', () => {
    const { io, calls } = createStubServer();
    const publisher = createRealtimePublisher();
    publisher.bind(io);

    publisher.shutdown('SIGTERM');

    // Not the bare `disconnectSockets`: with a cross-instance adapter that
    // publishes the request to every other node, so stopping one container
    // during a rolling restart would drop every client in the cluster.
    expect(calls).toEqual([{ scope: 'local', force: true }]);
  });

  it('revokes one user across every instance, which is the opposite intent', () => {
    const { io, calls } = createStubServer();
    const publisher = createRealtimePublisher();
    publisher.bind(io);

    publisher.disconnectUser('user-1', 'account deleted');

    // Deliberately not local: the sessions being revoked may be held anywhere.
    expect(calls).toEqual([{ scope: 'in:user_user-1', force: true }]);
  });

  it('does nothing at all before a server is bound', () => {
    const publisher = createRealtimePublisher();

    expect(() => publisher.shutdown('SIGTERM')).not.toThrow();
    expect(() => publisher.disconnectUser('user-1', 'account deleted')).not.toThrow();
  });

  it('publishes room and user events through their scoped operators', () => {
    const { io, events } = createStubServer();
    const publisher = createRealtimePublisher();
    publisher.bind(io);

    publisher.publishRoomEvent('room-1', 'message_updated', { revision: 2 });
    publisher.publishUserEvent('user-1', 'friend_request', { requestId: 'request-1' });

    expect(events).toEqual([
      { scope: 'to:room_room-1', event: 'message_updated', payload: { revision: 2 } },
      { scope: 'to:user_user-1', event: 'friend_request', payload: { requestId: 'request-1' } },
    ]);
  });

  it('joins and leaves all sessions for a user', async () => {
    const { io, joins, leaves } = createStubServer();
    const publisher = createRealtimePublisher();
    publisher.bind(io);

    await publisher.addUserToRoom('user-1', 'room-1');
    await publisher.removeUserFromRoom('user-1', 'room-1');

    expect(joins).toEqual([{ scope: 'in:user_user-1', room: 'room_room-1' }]);
    expect(leaves).toEqual([{ scope: 'in:user_user-1', room: 'room_room-1' }]);
  });

  it('serializes subscription changes for the same user and room', async () => {
    const publisher = createRealtimePublisher();
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = publisher.withRoomSubscriptionLock('user-1', 'room-1', async () => {
      order.push('first-start');
      await firstGate;
      order.push('first-end');
    });
    const second = publisher.withRoomSubscriptionLock('user-1', 'room-1', () => {
      order.push('second');
    });
    await Promise.resolve();

    expect(order).toEqual(['first-start']);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(['first-start', 'first-end', 'second']);
  });
});
