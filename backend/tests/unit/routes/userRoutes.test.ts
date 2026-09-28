import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test';
import { Hono } from 'hono';
import { makeUserRoutes } from '../../../src/routes/userRoutes';
import { errorHandler } from '../../../src/middlewares/errorHandler';
import { signToken } from '../../../src/utils/jwt';

const mockSqlFn: any = mock().mockResolvedValue([{ user_id: 'caller-id' }]);
mockSqlFn.unsafe = mock().mockResolvedValue([{}]);
mock.module('../../../src/models/db', () => ({ default: mockSqlFn }));

const CALLER_ID = '11111111-1111-4111-8111-111111111111';
const CONTACT_ID = 'e4c08495-e224-4a67-b6dd-5958952d3d42';

describe('emergency contact routes', () => {
  let service: any;
  let token: string;

  const makeApp = () => {
    const app = new Hono();
    app.onError(errorHandler);
    app.route('/users', makeUserRoutes(service));
    return app;
  };

  beforeEach(async () => {
    token = await signToken({ userId: CALLER_ID, email: 'caller@test.com' } as any);
    service = {
      getMe: mock().mockResolvedValue({ userId: CALLER_ID, name: 'Caller' }),
      getUserProfile: mock().mockResolvedValue({ userId: CONTACT_ID, name: 'Contact' }),
      updateMe: mock().mockResolvedValue({ userId: CALLER_ID, name: 'Caller', bio: 'Updated' }),
      getMySettings: mock().mockResolvedValue({ theme: 'light', notifySound: true }),
      updateMySettings: mock().mockResolvedValue({ theme: 'dark', notifySound: true }),
      deleteMe: mock().mockResolvedValue(undefined),
      search: mock().mockResolvedValue([{ userId: CONTACT_ID, name: 'Contact' }]),
      getEmergencyContacts: mock().mockResolvedValue([{ contactId: CONTACT_ID, message: 'Check in' }]),
      upsertEmergencyContact: mock().mockResolvedValue({
        contact: { contactId: CONTACT_ID, message: 'Check in' },
        isUpdate: false,
      }),
      deleteEmergencyContact: mock().mockResolvedValue(undefined),
      checkInactivity: mock().mockResolvedValue({ alerted: false, recipients: [], reason: 'BELOW_THRESHOLD' }),
    };
  });

  afterAll(() => {
    mock.restore();
  });

  describe('DELETE /users/me/emergency-contacts/:contactId', () => {
    it('answers with the documented { success: true } shape', async () => {
      const res = await makeApp().request(`/users/me/emergency-contacts/${CONTACT_ID}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      // The frontend types this as Promise<{ success: boolean }>; a { message }
      // body left callers reading `success` with undefined.
      expect(await res.json()).toEqual({ success: true });
      expect(service.deleteEmergencyContact).toHaveBeenCalledWith(CALLER_ID, CONTACT_ID);
    });
  });

  describe('POST /users/me/emergency-alert/check-inactivity', () => {
    const post = (body: unknown) =>
      makeApp().request('/users/me/emergency-alert/check-inactivity', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    it('accepts an ISO 8601 now', async () => {
      const res = await post({ now: new Date().toISOString() });

      expect(res.status).toBe(200);
      expect(service.checkInactivity).toHaveBeenCalled();
    });

    it('accepts an omitted now', async () => {
      expect((await post({})).status).toBe(200);
    });

    it('rejects a non-ISO now before it can become an Invalid Date', async () => {
      const res = await post({ now: 'invalid' });

      expect(res.status).toBe(400);
      // Reaching the service would make inactiveMs NaN and could fire a real alert.
      expect(service.checkInactivity).not.toHaveBeenCalled();
    });
  });

  describe('documented user routes', () => {
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

    it('gets and updates the authenticated profile', async () => {
      const profile = await request('/users/me');
      expect(profile.status).toBe(200);
      expect(await profile.json()).toEqual({ userId: CALLER_ID, name: 'Caller' });
      expect(service.getMe).toHaveBeenCalledWith(CALLER_ID);

      const update = await jsonRequest('/users/me', 'PATCH', { bio: 'Updated' });
      expect(update.status).toBe(200);
      expect(await update.json()).toEqual({ userId: CALLER_ID, name: 'Caller', bio: 'Updated' });
      expect(service.updateMe).toHaveBeenCalledWith(CALLER_ID, { bio: 'Updated' });
    });

    it('gets and updates user settings', async () => {
      const settings = await request('/users/me/settings');
      expect(settings.status).toBe(200);
      expect(await settings.json()).toEqual({ theme: 'light', notifySound: true });
      expect(service.getMySettings).toHaveBeenCalledWith(CALLER_ID);

      const update = await jsonRequest('/users/me/settings', 'PATCH', { theme: 'dark' });
      expect(update.status).toBe(200);
      expect(await update.json()).toEqual({ theme: 'dark', notifySound: true });
      expect(service.updateMySettings).toHaveBeenCalledWith(CALLER_ID, { theme: 'dark' });
    });

    it('deletes the authenticated account and clears its refresh cookie', async () => {
      const response = await request('/users/me', { method: 'DELETE' });

      expect(response.status).toBe(204);
      expect(service.deleteMe).toHaveBeenCalledWith(CALLER_ID);
      expect(response.headers.get('set-cookie')).toContain('refresh_token=');
    });

    it('searches all users and optionally limits the search to friends', async () => {
      const all = await request('/users?q=contact&mode=name');
      expect(all.status).toBe(200);
      expect(await all.json()).toEqual([{ userId: CONTACT_ID, name: 'Contact' }]);
      expect(service.search).toHaveBeenCalledWith('contact', 'name', undefined);

      const friends = await request('/users/search?q=contact&friendsOnly=true');
      expect(friends.status).toBe(200);
      expect(service.search).toHaveBeenCalledWith('contact', undefined, CALLER_ID);
    });

    it('returns another user public profile', async () => {
      const response = await request(`/users/${CONTACT_ID}`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ userId: CONTACT_ID, name: 'Contact' });
      expect(service.getUserProfile).toHaveBeenCalledWith(CONTACT_ID);
    });

    it('lists and creates emergency contacts', async () => {
      const list = await request('/users/me/emergency-contacts');
      expect(list.status).toBe(200);
      expect(await list.json()).toEqual([{ contactId: CONTACT_ID, message: 'Check in' }]);
      expect(service.getEmergencyContacts).toHaveBeenCalledWith(CALLER_ID);

      const create = await jsonRequest('/users/me/emergency-contacts', 'POST', {
        contactId: CONTACT_ID,
        message: 'Check in',
      });
      expect(create.status).toBe(201);
      expect(await create.json()).toEqual({ contactId: CONTACT_ID, message: 'Check in' });
      expect(service.upsertEmergencyContact).toHaveBeenCalledWith(
        CALLER_ID,
        CONTACT_ID,
        'Check in',
      );
    });
  });
});
