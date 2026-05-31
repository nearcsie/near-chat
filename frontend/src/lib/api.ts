import type {
  AuthResponse,
  LoginRequest,
  MessageWithSender,
  PublicUser,
  RegisterRequest,
  Room,
  RoomSummary,
  User,
} from '@shared/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const API_PREFIX = '/api/v1';

type UpdateMeRequest = Partial<
  Pick<User, 'name' | 'bio' | 'avatarUrl' | 'warningEnabled' | 'warningDays'>
>;

type CreateGroupRequest = {
  name: string;
  avatarUrl?: string;
};

type CreatePrivateRequest = {
  targetUserId: string;
};

type ListMessagesRequest = {
  beforeId?: string;
  limit?: number;
};

type EmergencyAlertResult = {
  alerted: boolean;
  recipients: string[];
  reason?: string;
};

type RequestOptions = {
  token?: string;
};

const buildUrl = (path: string): string => `${API_BASE_URL}${API_PREFIX}${path}`;

const authHeaders = (token?: string): HeadersInit =>
  token ? { Authorization: `Bearer ${token}` } : {};

const requestJson = async <T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> => {
  const headers = {
    ...authHeaders(options.token),
    ...init.headers,
  };

  const response = await fetch(buildUrl(path), {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};

const withJsonBody = (body: unknown): Pick<RequestInit, 'body' | 'headers'> => ({
  body: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json' },
});

export const register = (data: RegisterRequest): Promise<AuthResponse> =>
  requestJson<AuthResponse>('/auth/register', {
    method: 'POST',
    ...withJsonBody(data),
  });

export const login = (data: LoginRequest): Promise<AuthResponse> =>
  requestJson<AuthResponse>('/auth/login', {
    method: 'POST',
    ...withJsonBody(data),
  });

export const logout = (token: string): Promise<void> =>
  requestJson<void>('/auth/logout', { method: 'POST' }, { token });

export const getMe = (token: string): Promise<PublicUser> =>
  requestJson<PublicUser>('/users/me', {}, { token });

export const updateMe = (token: string, data: UpdateMeRequest): Promise<PublicUser> =>
  requestJson<PublicUser>(
    '/users/me',
    {
      method: 'PATCH',
      ...withJsonBody(data),
    },
    { token },
  );

export const searchUsers = (token: string, params: { query: string }): Promise<PublicUser[]> => {
  const query = new URLSearchParams({ query: params.query });
  return requestJson<PublicUser[]>(`/users/search?${query.toString()}`, {}, { token });
};

export const listRooms = (token: string): Promise<RoomSummary[]> =>
  requestJson<RoomSummary[]>('/rooms', {}, { token });

export const createGroup = (token: string, data: CreateGroupRequest): Promise<Room> =>
  requestJson<Room>(
    '/rooms/group',
    {
      method: 'POST',
      ...withJsonBody(data),
    },
    { token },
  );

export const createPrivateRoom = (token: string, data: CreatePrivateRequest): Promise<Room> =>
  requestJson<Room>(
    '/rooms/private',
    {
      method: 'POST',
      ...withJsonBody(data),
    },
    { token },
  );

export const listMessages = (
  token: string,
  roomId: string,
  params: ListMessagesRequest = {},
): Promise<MessageWithSender[]> => {
  const query = new URLSearchParams();
  if (params.beforeId) query.set('before_id', params.beforeId);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  const suffix = query.size > 0 ? `?${query.toString()}` : '';

  return requestJson<MessageWithSender[]>(`/rooms/${roomId}/messages${suffix}`, {}, { token });
};

export const triggerEmergencyAlert = (token: string, message?: string): Promise<EmergencyAlertResult> =>
  requestJson<EmergencyAlertResult>(
    '/users/me/emergency-alert',
    {
      method: 'POST',
      ...withJsonBody(message ? { message } : {}),
    },
    { token },
  );

export const checkEmergencyInactivity = (
  token: string,
  now?: string,
): Promise<EmergencyAlertResult> =>
  requestJson<EmergencyAlertResult>(
    '/users/me/emergency-alert/check-inactivity',
    {
      method: 'POST',
      ...withJsonBody(now ? { now } : {}),
    },
    { token },
  );
