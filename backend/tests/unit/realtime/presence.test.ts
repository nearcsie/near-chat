import { describe, expect, it, vi, beforeEach } from 'vitest';
import { trackUserConnection, trackUserDisconnection, isUserOnline, getOnlineUsers, clearPresence } from '../../../src/realtime/presence';
import type { ChatServer } from '../../../src/realtime/authSocket';

describe('presence tracker', () => {
  let io: any;
  let roomEmit: any;
  let friendRepo: any;

  beforeEach(() => {
    clearPresence();
    roomEmit = vi.fn();
    io = {
      to: vi.fn(() => ({ emit: roomEmit })),
    } as unknown as ChatServer;

    friendRepo = {
      getFriends: vi.fn().mockResolvedValue([
        { friend: { userId: 'friend-1' } },
        { friend: { userId: 'friend-2' } }
      ])
    };
  });

  it('tracks connection, reports online status, and notifies online friends', async () => {
    // Initially offline
    expect(isUserOnline('user-1')).toBe(false);

    // Friend-1 is online (has socket registered)
    await trackUserConnection(io, 'friend-1', 'socket-friend', friendRepo);
    expect(isUserOnline('friend-1')).toBe(true);

    // User-1 connects
    await trackUserConnection(io, 'user-1', 'socket-1', friendRepo);
    expect(isUserOnline('user-1')).toBe(true);
    expect(getOnlineUsers()).toContain('user-1');

    // Should broadcast status 'online' to friend-1's room, but not friend-2 (since friend-2 is offline)
    expect(io.to).toHaveBeenCalledWith('user_friend-1');
    expect(io.to).not.toHaveBeenCalledWith('user_friend-2');
    expect(roomEmit).toHaveBeenCalledWith('user_status', { userId: 'user-1', status: 'online' });
  });

  it('handles multiple socket connections per user and tracks disconnection', async () => {
    // User connects on tab 1
    await trackUserConnection(io, 'user-1', 'socket-tab-1', friendRepo);
    // User connects on tab 2
    await trackUserConnection(io, 'user-1', 'socket-tab-2', friendRepo);

    expect(isUserOnline('user-1')).toBe(true);

    // Disconnect tab 1
    await trackUserDisconnection(io, 'user-1', 'socket-tab-1', friendRepo);
    // User is still online because tab 2 is open
    expect(isUserOnline('user-1')).toBe(true);
    expect(roomEmit).not.toHaveBeenCalledWith('user_status', { userId: 'user-1', status: 'offline' });

    // Friend-1 is online
    await trackUserConnection(io, 'friend-1', 'socket-friend', friendRepo);
    roomEmit.mockClear();

    // Disconnect tab 2
    await trackUserDisconnection(io, 'user-1', 'socket-tab-2', friendRepo);
    // User is now offline
    expect(isUserOnline('user-1')).toBe(false);
    // Should broadcast offline status to friend-1
    expect(io.to).toHaveBeenCalledWith('user_friend-1');
    expect(roomEmit).toHaveBeenCalledWith('user_status', { userId: 'user-1', status: 'offline' });
  });
});
