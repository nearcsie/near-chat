import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test';
import { Hono } from 'hono';
import type { MessageChange, MessageWithSender } from '@shared/types';
import { makeSyncRoutes } from '../../../src/routes/syncRoutes';
import { authMiddleware } from '../../../src/middlewares/authMiddleware';
import { errorHandler } from '../../../src/middlewares/errorHandler';
import { signToken } from '../../../src/utils/jwt';

const CALLER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

const mockSqlFn: any = mock().mockResolvedValue([{ user_id: CALLER_ID }]);
mockSqlFn.unsafe = mock().mockResolvedValue([{}]);
mock.module('../../../src/models/db', () => ({ default: mockSqlFn }));

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
  let token: string;

  // Mounted the way `bootstrap/httpApp.ts` mounts it: an auth-guarded sub-app
  // routed at the prefix, so the test exercises the same path the server does.
  const get = (query: string) => {
    const app = new Hono();
    app.onError(errorHandler);
    const syncApi = new Hono();
    syncApi.use('*', authMiddleware);
    syncApi.route('/', makeSyncRoutes(service));
    app.route('/api/v1/sync', syncApi);
    return app.request(`/api/v1/sync${query}`, { headers: { authorization: `Bearer ${token}` } });
  };

  beforeEach(async () => {
    token = await signToken({ userId: CALLER_ID, email: 'caller@test.com' } as any);
    service = { sync: mock().mockResolvedValue({ changes: [], resyncRequired: false }) };
  });

  afterAll(() => {
    mock.restore();
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

  it('still rejects a malformed cursor before reaching the service', async () => {
    const res = await get('?cursor=-1&limit=100');

    expect(res.status).toBe(400);
    expect(service.sync).not.toHaveBeenCalled();
  });
});
