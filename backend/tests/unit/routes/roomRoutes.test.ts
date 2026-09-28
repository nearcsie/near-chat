import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test';
import { Hono } from 'hono';
import { makeRoomRoutes } from '../../../src/routes/roomRoutes';
import { authMiddleware } from '../../../src/middlewares/authMiddleware';
import { errorHandler } from '../../../src/middlewares/errorHandler';
import { signToken } from '../../../src/utils/jwt';
import { NotFoundError } from '../../../src/utils/AppError';

// authMiddleware looks the caller up through the shared SQL client; a non-empty
// row is all it needs to accept the signed token.
const mockSqlFn: any = mock().mockResolvedValue([{ user_id: 'caller-id' }]);
mockSqlFn.unsafe = mock().mockResolvedValue([{}]);
mock.module('../../../src/models/db', () => ({ default: mockSqlFn }));

const CALLER_ID = '11111111-1111-4111-8111-111111111111';
const NEW_OWNER_ID = 'e4c08495-e224-4a67-b6dd-5958952d3d42';
const ROOM_ID = '22222222-2222-4222-8222-222222222222';

describe('PATCH /rooms/:id', () => {
  let service: any;
  let token: string;

  const makeApp = () => {
    const app = new Hono();
    app.onError(errorHandler);
    app.use('/rooms/*', authMiddleware);
    app.route('/rooms', makeRoomRoutes(service));
    return app;
  };

  const patchRoom = (body: unknown) =>
    makeApp().request(`/rooms/${ROOM_ID}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  beforeEach(async () => {
    token = await signToken({ userId: CALLER_ID, email: 'caller@test.com' } as any);
    service = {
      transferOwnership: mock().mockResolvedValue(undefined),
      update: mock().mockResolvedValue({ roomId: ROOM_ID, name: 'Updated' }),
    };
  });

  afterAll(() => {
    mock.restore();
  });

  it('transfers ownership when ownerId is supplied', async () => {
    const res = await patchRoom({ ownerId: NEW_OWNER_ID });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Ownership transferred' });
    expect(service.transferOwnership).toHaveBeenCalledWith(ROOM_ID, CALLER_ID, NEW_OWNER_ID);
    expect(service.update).not.toHaveBeenCalled();
  });

  it('accepts the snake_case owner_id alias', async () => {
    const res = await patchRoom({ owner_id: NEW_OWNER_ID });

    expect(res.status).toBe(200);
    expect(service.transferOwnership).toHaveBeenCalledWith(ROOM_ID, CALLER_ID, NEW_OWNER_ID);
  });

  it('rejects a malformed ownerId instead of silently dropping it', async () => {
    const res = await patchRoom({ ownerId: 'not-a-uuid' });

    expect(res.status).toBe(400);
    expect(service.transferOwnership).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('updates settings and returns the room when no ownerId is supplied', async () => {
    const res = await patchRoom({ name: 'Updated' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ roomId: ROOM_ID, name: 'Updated' });
    expect(service.update).toHaveBeenCalledWith(ROOM_ID, CALLER_ID, { name: 'Updated' });
    expect(service.transferOwnership).not.toHaveBeenCalled();
  });

  it('rejects ownerId combined with settings instead of dropping them', async () => {
    const res = await patchRoom({ ownerId: NEW_OWNER_ID, name: 'Updated' });

    // The transfer branch returns immediately, so accepting this would answer 200
    // while silently discarding `name`.
    expect(res.status).toBe(400);
    expect(service.transferOwnership).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('still rejects an empty body', async () => {
    const res = await patchRoom({});

    expect(res.status).toBe(400);
    expect(service.update).not.toHaveBeenCalled();
    expect(service.transferOwnership).not.toHaveBeenCalled();
  });
});

describe('PATCH /rooms/:id/members/:targetUserId', () => {
  let service: any;
  let token: string;

  const makeApp = () => {
    const app = new Hono();
    app.onError(errorHandler);
    app.use('/rooms/*', authMiddleware);
    app.route('/rooms', makeRoomRoutes(service));
    return app;
  };

  const patchMember = (body: unknown) =>
    makeApp().request(`/rooms/${ROOM_ID}/members/${NEW_OWNER_ID}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  beforeEach(async () => {
    token = await signToken({ userId: CALLER_ID, email: 'caller@test.com' } as any);
    service = {
      approveMember: mock().mockResolvedValue(undefined),
      updateMember: mock().mockResolvedValue(undefined),
      transferOwnership: mock().mockResolvedValue(undefined),
    };
  });

  it('returns the documented message when approving', async () => {
    const res = await patchMember({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Member approved' });
    expect(service.approveMember).toHaveBeenCalledWith(ROOM_ID, CALLER_ID, NEW_OWNER_ID);
  });

  it('returns the documented message when updating', async () => {
    const res = await patchMember({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Member updated' });
  });

  it('forwards isMuted through to the service', async () => {
    const res = await patchMember({ isMuted: true });

    expect(res.status).toBe(200);
    // The old schema declared `muted`, so this arrived as an empty object and the
    // mute change was silently dropped.
    expect(service.updateMember).toHaveBeenCalledWith(ROOM_ID, CALLER_ID, NEW_OWNER_ID, { isMuted: true });
  });

  it('does not treat ownerId here as an ownership transfer', async () => {
    const res = await patchMember({ ownerId: NEW_OWNER_ID, role: 'admin' });

    expect(res.status).toBe(200);
    expect(service.transferOwnership).not.toHaveBeenCalled();
    expect(service.updateMember).toHaveBeenCalledWith(ROOM_ID, CALLER_ID, NEW_OWNER_ID, { role: 'admin' });
  });
});

describe('GET /rooms/invite/:code', () => {
  let service: any;
  let token: string;

  const makeApp = () => {
    const app = new Hono();
    app.onError(errorHandler);
    app.use('/rooms/*', authMiddleware);
    app.route('/rooms', makeRoomRoutes(service));
    return app;
  };

  const previewInvite = (code: string) =>
    makeApp().request(`/rooms/invite/${code}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    });

  beforeEach(async () => {
    token = await signToken({ userId: CALLER_ID, email: 'caller@test.com' } as any);
    service = {
      previewByCode: mock().mockResolvedValue({
        roomId: ROOM_ID,
        name: 'Study Room',
        requireApproval: false,
        isMember: false,
        isPending: false,
      }),
      joinByCode: mock(),
    };
  });

  afterAll(() => {
    mock.restore();
  });

  it('returns the preview for the caller without joining', async () => {
    const res = await previewInvite('ABC123');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      roomId: ROOM_ID,
      name: 'Study Room',
      requireApproval: false,
      isMember: false,
      isPending: false,
    });
    expect(service.previewByCode).toHaveBeenCalledWith(CALLER_ID, 'ABC123');
    expect(service.joinByCode).not.toHaveBeenCalled();
  });

  it('does not shadow the room-by-id route', async () => {
    // `invite` is a literal segment, so `/rooms/:id` must not swallow it.
    await previewInvite('ABC123');

    expect(service.previewByCode).toHaveBeenCalled();
  });

  it('surfaces an unknown invite code as 404 through the error handler', async () => {
    service.previewByCode = mock(async () => {
      throw new NotFoundError('room', 'BOGUS');
    });

    const res = await previewInvite('BOGUS');

    expect(res.status).toBe(404);
  });
});

describe('documented room route contracts', () => {
  let service: any;
  let token: string;

  const makeApp = () => {
    const app = new Hono();
    app.onError(errorHandler);
    app.use('/rooms/*', authMiddleware);
    app.route('/rooms', makeRoomRoutes(service));
    return app;
  };

  const request = (path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set('authorization', `Bearer ${token}`);
    return makeApp().request(path, { ...init, headers });
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
      list: mock().mockResolvedValue([{ roomId: ROOM_ID, name: 'Study Room' }]),
      getById: mock().mockResolvedValue({ roomId: ROOM_ID, name: 'Study Room' }),
      create: mock().mockResolvedValue({ roomId: ROOM_ID, name: 'Study Room' }),
      createPrivate: mock().mockResolvedValue({
        room: { roomId: ROOM_ID, type: 'private' },
        created: true,
      }),
      joinByCode: mock().mockResolvedValue({ roomId: ROOM_ID, name: 'Study Room' }),
      listMembers: mock().mockResolvedValue([{ userId: CALLER_ID, role: 'owner' }]),
      leave: mock().mockResolvedValue(undefined),
      kickMember: mock().mockResolvedValue(undefined),
      approveMember: mock().mockResolvedValue(undefined),
      deleteGroup: mock().mockResolvedValue(undefined),
    };
  });

  it('lists rooms and gets one room for the authenticated caller', async () => {
    const list = await request('/rooms');
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual([{ roomId: ROOM_ID, name: 'Study Room' }]);
    expect(service.list).toHaveBeenCalledWith(CALLER_ID);

    const detail = await request(`/rooms/${ROOM_ID}`);
    expect(detail.status).toBe(200);
    expect(await detail.json()).toEqual({ roomId: ROOM_ID, name: 'Study Room' });
    expect(service.getById).toHaveBeenCalledWith(ROOM_ID, CALLER_ID);
  });

  it('creates group and private rooms with the documented status', async () => {
    const group = await jsonRequest('/rooms', 'POST', { type: 'group', name: 'Study Room' });
    expect(group.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith(
      CALLER_ID,
      expect.objectContaining({ type: 'group', name: 'Study Room' }),
    );

    const privateRoom = await jsonRequest('/rooms', 'POST', {
      type: 'private',
      targetUserId: NEW_OWNER_ID,
    });
    expect(privateRoom.status).toBe(201);
    expect(service.createPrivate).toHaveBeenCalledWith(CALLER_ID, NEW_OWNER_ID);
  });

  it('joins by invite code and lists the room members', async () => {
    const join = await jsonRequest(`/rooms/${ROOM_ID}/members`, 'POST', {
      inviteCode: 'JOIN123',
    });
    expect(join.status).toBe(200);
    expect(service.joinByCode).toHaveBeenCalledWith(CALLER_ID, 'JOIN123');

    const members = await request(`/rooms/${ROOM_ID}/members`);
    expect(members.status).toBe(200);
    expect(await members.json()).toEqual([{ userId: CALLER_ID, role: 'owner' }]);
    expect(service.listMembers).toHaveBeenCalledWith(ROOM_ID, CALLER_ID);
  });

  it('lets the caller leave and lets an administrator kick another member', async () => {
    const leave = await request(`/rooms/${ROOM_ID}/members/me`, { method: 'DELETE' });
    expect(leave.status).toBe(204);
    expect(service.leave).toHaveBeenCalledWith(CALLER_ID, ROOM_ID);

    const kick = await request(`/rooms/${ROOM_ID}/members/${NEW_OWNER_ID}`, {
      method: 'DELETE',
    });
    expect(kick.status).toBe(204);
    expect(service.kickMember).toHaveBeenCalledWith(ROOM_ID, CALLER_ID, NEW_OWNER_ID);
  });

  it('approves a pending member and archives the room', async () => {
    const approve = await request(
      `/rooms/${ROOM_ID}/members/${NEW_OWNER_ID}/approve`,
      { method: 'POST' },
    );
    expect(approve.status).toBe(200);
    expect(await approve.json()).toEqual({ message: 'Member approved' });
    expect(service.approveMember).toHaveBeenCalledWith(ROOM_ID, CALLER_ID, NEW_OWNER_ID);

    const archive = await request(`/rooms/${ROOM_ID}`, { method: 'DELETE' });
    expect(archive.status).toBe(204);
    expect(service.deleteGroup).toHaveBeenCalledWith(ROOM_ID, CALLER_ID);
  });
});
