import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test';
import { Hono } from 'hono';
import {
  makeBlockRoutes,
  makeFriendRequestRoutes,
  makeFriendRoutes,
} from '../../../src/routes/friendRoutes';
import { errorHandler } from '../../../src/middlewares/errorHandler';
import { signToken } from '../../../src/utils/jwt';

const mockSqlFn: any = mock().mockResolvedValue([{ user_id: 'caller-id' }]);
mockSqlFn.unsafe = mock().mockResolvedValue([{}]);
mock.module('../../../src/models/db', () => ({ default: mockSqlFn }));

const CALLER_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_ID = 'e4c08495-e224-4a67-b6dd-5958952d3d42';
const BLOCKED_USER = {
  userId: TARGET_ID,
  name: 'Blocked User',
  email: 'blocked@test.com',
  avatarUrl: '/uploads/avatars/blocked.png',
};

describe('GET /blocks', () => {
  let service: any;
  let token: string;

  const listBlocks = () => {
    const app = new Hono();
    app.onError(errorHandler);
    app.route('/blocks', makeBlockRoutes(service));
    return app.request('/blocks', { headers: { authorization: `Bearer ${token}` } });
  };

  beforeEach(async () => {
    token = await signToken({ userId: CALLER_ID, email: 'caller@test.com' } as any);
    service = { getBlockedUsers: mock().mockResolvedValue([BLOCKED_USER]) };
  });

  afterAll(() => {
    mock.restore();
  });

  it('returns the flat user array the service produced', async () => {
    const res = await listBlocks();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([BLOCKED_USER]);
    expect(service.getBlockedUsers).toHaveBeenCalledWith(CALLER_ID);
  });

  it('exposes userId on each entry rather than nesting it under `blocked`', async () => {
    const body = await (await listBlocks()).json() as any[];

    expect(body[0].userId).toBe(BLOCKED_USER.userId);
    expect(body[0].name).toBe(BLOCKED_USER.name);
    expect(body[0]).not.toHaveProperty('blocked');
  });

  it('returns an empty array when nothing is blocked', async () => {
    service.getBlockedUsers = mock().mockResolvedValue([]);

    const res = await listBlocks();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('tolerates a nullish service result', async () => {
    service.getBlockedUsers = mock().mockResolvedValue(null);

    const res = await listBlocks();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe('friend and block route contracts', () => {
  let service: any;
  let token: string;

  const request = (path: string, init?: RequestInit) => {
    const app = new Hono();
    app.onError(errorHandler);
    app.route('/friends', makeFriendRoutes(service));
    app.route('/blocks', makeBlockRoutes(service));
    app.route('/friend-requests', makeFriendRequestRoutes(service));
    const headers = new Headers(init?.headers);
    headers.set('authorization', `Bearer ${token}`);
    return app.request(path, { ...init, headers });
  };

  const jsonRequest = (path: string, method: string, body: unknown) =>
    request(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  beforeEach(async () => {
    token = await signToken({ userId: CALLER_ID, email: 'caller@test.com' } as any);
    service = {
      getFriends: mock().mockResolvedValue([{ friend: { userId: TARGET_ID } }]),
      removeFriend: mock().mockResolvedValue(undefined),
      getPendingRequests: mock().mockResolvedValue([{ requesterId: TARGET_ID }]),
      sendFriendRequest: mock().mockResolvedValue({ requesterId: CALLER_ID, addresseeId: TARGET_ID }),
      respondFriendRequest: mock().mockResolvedValue({ requesterId: TARGET_ID, status: 'accepted' }),
      getBlockedUsers: mock().mockResolvedValue([BLOCKED_USER]),
      blockUser: mock().mockResolvedValue(BLOCKED_USER),
      unblockUser: mock().mockResolvedValue(undefined),
    };
  });

  it('lists and removes friends for the authenticated caller', async () => {
    const list = await request('/friends');
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual([{ friend: { userId: TARGET_ID } }]);
    expect(service.getFriends).toHaveBeenCalledWith(CALLER_ID);

    const remove = await request(`/friends/${TARGET_ID}`, { method: 'DELETE' });
    expect(remove.status).toBe(204);
    expect(service.removeFriend).toHaveBeenCalledWith(CALLER_ID, TARGET_ID);
  });

  it('blocks and unblocks the target user', async () => {
    const block = await jsonRequest('/blocks', 'POST', { targetUserId: TARGET_ID });
    expect(block.status).toBe(201);
    expect(await block.json()).toEqual(BLOCKED_USER);
    expect(service.blockUser).toHaveBeenCalledWith(CALLER_ID, TARGET_ID);

    const unblock = await request(`/blocks/${TARGET_ID}`, { method: 'DELETE' });
    expect(unblock.status).toBe(204);
    expect(service.unblockUser).toHaveBeenCalledWith(CALLER_ID, TARGET_ID);
  });

  it('lists and creates pending friend requests', async () => {
    const pending = await request('/friend-requests');
    expect(pending.status).toBe(200);
    expect(await pending.json()).toEqual([{ requesterId: TARGET_ID }]);
    expect(service.getPendingRequests).toHaveBeenCalledWith(CALLER_ID);

    const create = await jsonRequest('/friend-requests', 'POST', { targetUserId: TARGET_ID });
    expect(create.status).toBe(201);
    expect(await create.json()).toEqual({ requesterId: CALLER_ID, addresseeId: TARGET_ID });
    expect(service.sendFriendRequest).toHaveBeenCalledWith(CALLER_ID, TARGET_ID);
  });

  it('returns an existing friendship as 200 when the request auto-accepts', async () => {
    service.sendFriendRequest = mock().mockResolvedValue({
      autoAccepted: true,
      request: { requesterId: TARGET_ID, addresseeId: CALLER_ID, status: 'accepted' },
    });

    const response = await jsonRequest('/friend-requests', 'POST', { targetUserId: TARGET_ID });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      requesterId: TARGET_ID,
      addresseeId: CALLER_ID,
      status: 'accepted',
    });
  });

  it('maps the documented response status to the service status', async () => {
    const response = await jsonRequest(`/friend-requests/${TARGET_ID}`, 'PATCH', {
      status: 'accepted',
    });

    expect(response.status).toBe(200);
    expect(service.respondFriendRequest).toHaveBeenCalledWith(
      CALLER_ID,
      TARGET_ID,
      'accepted',
    );
  });
});
