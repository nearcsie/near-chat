import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';
import type { MessageChange, MessageWithSender } from '@shared/types';
import { makeSyncRoutes } from '../../../src/routes/syncRoutes';
import { errorHandler } from '../../../src/middlewares/errorHandler';

const CALLER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

const message = (senderId: string): MessageWithSender => ({
  messageId: '33333333-3333-4333-8333-333333333333',
  roomId: '44444444-4444-4444-8444-444444444444',
  senderId,
  content: 'hello',
  isRecalled: false,
  sentAt: new Date('2026-09-20T00:00:00.000Z'),
  sender: { userId: senderId, name: 'Someone' },
});

const change = (changeSequence: number, commandId?: string): MessageChange => {
  const row: MessageChange = {
    changeSequence,
    messageSequence: changeSequence,
    revision: 1,
    changeType: 'created',
    message: message(commandId ? CALLER_ID : OTHER_ID),
  };
  if (commandId) row.commandId = commandId;
  return row;
};

describe('GET /sync', () => {
  let service: any;

  // Mounted at the same prefix `bootstrap/httpApp.ts` uses, but with the auth
  // context set directly rather than through `authMiddleware`: the middleware
  // reads the shared SQL client, and stubbing that module would leak a fake
  // `models/db` into every unit file loaded after this one
  // (`backend/tests/AGENTS.md`). What is under test here is the route, and it
  // only ever reads `c.get('user')`.
  const get = (query: string) => {
    const app = new Hono();
    app.onError(errorHandler);
    const syncApi = new Hono();
    syncApi.use('*', async (c, next) => {
      c.set('user', { userId: CALLER_ID, name: 'Caller' });
      await next();
    });
    syncApi.route('/', makeSyncRoutes(service));
    app.route('/api/v1/sync', syncApi);
    return app.request(`/api/v1/sync${query}`);
  };

  beforeEach(() => {
    service = { sync: mock().mockResolvedValue({ changes: [], resyncRequired: false }) };
  });

  it('advances the cursor to the last change of the page', async () => {
    service.sync.mockResolvedValue({ changes: [change(7), change(9)], resyncRequired: false });

    const res = await get('?cursor=5&limit=100');
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.nextCursor).toBe(9);
    expect(body.hasMore).toBe(false);
    expect(body).not.toHaveProperty('resyncRequired');
    expect(service.sync).toHaveBeenCalledWith(CALLER_ID, 5, 100);
  });

  it('reports hasMore when the page filled the limit', async () => {
    service.sync.mockResolvedValue({ changes: [change(7), change(9)], resyncRequired: false });

    const body = await (await get('?cursor=0&limit=2')).json() as any;

    expect(body.hasMore).toBe(true);
  });

  it('carries the commandId of the caller own change through to the client', async () => {
    service.sync.mockResolvedValue({ changes: [change(7, 'command-abc'), change(9)], resyncRequired: false });

    const body = await (await get('?cursor=0&limit=100')).json() as any;

    expect(body.changes[0].commandId).toBe('command-abc');
    expect(body.changes[1].commandId).toBeUndefined();
  });

  it('holds the cursor still when the caller is merely caught up', async () => {
    const body = await (await get('?cursor=42&limit=100')).json() as any;

    expect(body).toEqual({ changes: [], nextCursor: 42, hasMore: false });
  });

  it('answers an unusable cursor with a resync signal instead of echoing it back', async () => {
    service.sync.mockResolvedValue({ changes: [], resyncRequired: true });

    const res = await get('?cursor=42&limit=100');
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.resyncRequired).toBe(true);
    // The distinction the client needs: not "nothing new for you at 42", but
    // "42 no longer exists; start over".
    expect(body.nextCursor).toBe(0);
    expect(body.nextCursor).not.toBe(42);
    expect(body.changes).toEqual([]);
    expect(body.hasMore).toBe(false);
  });

  it('withholds the page when the cursor it came from is unusable', async () => {
    // The changes are real, but they sit on the far side of a reset: handing
    // them over would let the client advance past the break it has to hear
    // about.
    service.sync.mockResolvedValue({ changes: [change(501)], resyncRequired: true });

    const body = await (await get('?cursor=500&limit=100')).json() as any;

    expect(body.changes).toEqual([]);
    expect(body.nextCursor).toBe(0);
    expect(body.resyncRequired).toBe(true);
  });

  it('still rejects a malformed cursor before reaching the service', async () => {
    const res = await get('?cursor=-1&limit=100');

    expect(res.status).toBe(400);
    expect(service.sync).not.toHaveBeenCalled();
  });
});
