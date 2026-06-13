import { describe, expect, it, vi } from 'vitest';
import { signToken } from '../../../src/auth/jwt';
import { attachSocketAuth, type ChatServer } from '../../../src/realtime/authSocket';

vi.mock('../../../src/db', () => ({
  default: { query: vi.fn().mockResolvedValue({ rows: [{}] }) },
}));

describe('attachSocketAuth', () => {
  it('rejects connections without a token', () => {
    let middleware: any;
    const io = { use: vi.fn((fn) => { middleware = fn; }) } as unknown as ChatServer;
    attachSocketAuth(io);

    const next = vi.fn();
    middleware({ handshake: { auth: {} } }, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('verifies tokens with the shared JWT helper and stores socket data user', async () => {
    let middleware: any;
    const io = { use: vi.fn((fn) => { middleware = fn; }) } as unknown as ChatServer;
    const socket = {
      handshake: { auth: { token: signToken({ userId: 'user-1', name: 'Alice' }) } },
      data: {},
    };
    attachSocketAuth(io);

    const next = vi.fn();
    await middleware(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data).toMatchObject({
      user: { userId: 'user-1', name: 'Alice' },
    });
  });
});
