import type {
  Attachment,
  AuthResponse,
  EmergencyContactResponse,
  Folder as ApiFolder,
  FriendRequestResponse,
  FriendResponse,
  LoginRequest,
  MessageWithSender,
  MyProfile,
  PublicUser,
  RegisterRequest,
  Room,
  RoomMember,
  RoomSummary,
  UserProfile,
  UserSettings,
} from '@shared/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const API_PREFIX = '/api/v1';

type UpdateMeRequest = Partial<Pick<MyProfile, 'name' | 'email' | 'bio' | 'avatarUrl'>> & {
  password?: string;
};
type UpdateMySettingsRequest = Partial<
  Pick<UserSettings, 'warningEnabled' | 'warningDays' | 'language' | 'theme' | 'notifyDesktop' | 'notifySound'>
>;

type CreateGroupRequest = {
  name: string;
  avatarUrl?: string;
};

type CreatePrivateRequest = {
  targetUserId: string;
};

type UpdateRoomRequest = Partial<
  Pick<Room, 'name' | 'avatarUrl' | 'requireApproval' | 'viewHistory' | 'isArchived'>
>;

type TransferOwnerResponse = {
  message: string;
};

type UpdateRoomMemberRequest = {
  role?: 'admin' | 'member';
  nickname?: string;
  isMuted?: boolean;
};

type RoomMemberMutationResponse = {
  message: string;
};

type ListMessagesRequest = {
  beforeId?: string;
  limit?: number;
};

type UploadAttachmentResponse = Attachment;

type EmergencyAlertResult = {
  alerted: boolean;
  recipients: string[];
  reason?: string;
};

type UpsertEmergencyContactRequest = {
  contactId: string;
  message: string;
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
    if (response.status === 401 && !path.startsWith('/auth/') && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth:token-expired'));
    }
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

export const getMe = (token: string): Promise<MyProfile> =>
  requestJson<MyProfile>('/users/me', {}, { token });

export const getUserProfile = (token: string, userId: string): Promise<UserProfile> =>
  requestJson<UserProfile>(`/users/${userId}`, {}, { token });

export const updateMe = (token: string, data: UpdateMeRequest): Promise<MyProfile> =>
  requestJson<MyProfile>(
    '/users/me',
    {
      method: 'PATCH',
      ...withJsonBody(data),
    },
    { token },
  );

export const deleteMe = (token: string): Promise<void> =>
  requestJson<void>('/users/me', { method: 'DELETE' }, { token });

export const getMySettings = (token: string): Promise<UserSettings> =>
  requestJson<UserSettings>('/users/me/settings', {}, { token });

export const updateMySettings = (
  token: string,
  data: UpdateMySettingsRequest,
): Promise<UserSettings> =>
  requestJson<UserSettings>(
    '/users/me/settings',
    {
      method: 'PATCH',
      ...withJsonBody(data),
    },
    { token },
  );

export const searchUsers = (token: string, params: { query: string }): Promise<PublicUser[]> => {
  const query = new URLSearchParams({ q: params.query });
  return requestJson<PublicUser[]>(`/users?${query.toString()}`, {}, { token });
};

export const listFriends = (token: string): Promise<FriendResponse[]> =>
  requestJson<FriendResponse[]>('/friends', {}, { token });

export const deleteFriend = (token: string, friendId: string): Promise<void> =>
  requestJson<void>(`/friends/${friendId}`, { method: 'DELETE' }, { token });

export const listFriendRequests = (token: string): Promise<FriendRequestResponse[]> =>
  requestJson<FriendRequestResponse[]>('/friend-requests', {}, { token });

export const sendFriendRequest = (
  token: string,
  targetUserId: string,
): Promise<FriendRequestResponse> =>
  requestJson<FriendRequestResponse>(
    '/friend-requests',
    {
      method: 'POST',
      ...withJsonBody({ targetUserId }),
    },
    { token },
  );

export const respondFriendRequest = (
  token: string,
  requesterId: string,
  status: 'accepted' | 'rejected',
): Promise<FriendRequestResponse | { status: 'rejected' }> =>
  requestJson<FriendRequestResponse | { status: 'rejected' }>(
    `/friend-requests/${requesterId}`,
    {
      method: 'PATCH',
      ...withJsonBody({ status }),
    },
    { token },
  );

export const getBlockedUsers = (token: string): Promise<{userId: string, name: string, email: string, avatarUrl?: string}[]> =>
  requestJson<{userId: string, name: string, email: string, avatarUrl?: string}[]>('/blocks', { method: 'GET' }, { token });

export const blockUser = (token: string, targetUserId: string): Promise<{ status: 'blocked' }> =>
  requestJson<{ status: 'blocked' }>(
    '/blocks',
    {
      method: 'POST',
      ...withJsonBody({ targetUserId }),
    },
    { token },
  );

export const unblockUser = (token: string, blockedId: string): Promise<void> =>
  requestJson<void>(`/blocks/${blockedId}`, { method: 'DELETE' }, { token });

export const listRooms = (token: string): Promise<RoomSummary[]> =>
  requestJson<RoomSummary[]>('/rooms', {}, { token });

export const createGroup = (token: string, data: CreateGroupRequest): Promise<Room> =>
  requestJson<Room>(
    '/rooms',
    {
      method: 'POST',
      ...withJsonBody({ ...data, type: 'group' }),
    },
    { token },
  );

export const createPrivateRoom = (token: string, data: CreatePrivateRequest): Promise<Room> =>
  requestJson<Room>(
    '/rooms',
    {
      method: 'POST',
      ...withJsonBody({ ...data, type: 'private' }),
    },
    { token },
  );

export const joinRoomByCode = (token: string, inviteCode: string): Promise<Room> =>
  requestJson<Room>(
    '/rooms/join',
    {
      method: 'POST',
      ...withJsonBody({ inviteCode }),
    },
    { token },
  );

export const updateRoom = (
  token: string,
  roomId: string,
  data: UpdateRoomRequest,
): Promise<Room> =>
  requestJson<Room>(
    `/rooms/${roomId}`,
    {
      method: 'PATCH',
      ...withJsonBody(data),
    },
    { token },
  );

export const deleteRoom = (token: string, roomId: string): Promise<void> =>
  requestJson<void>(`/rooms/${roomId}`, { method: 'DELETE' }, { token });

export const leaveRoom = (token: string, roomId: string): Promise<void> =>
  requestJson<void>(`/rooms/${roomId}/members/me`, { method: 'DELETE' }, { token });

export const listRoomMembers = (token: string, roomId: string): Promise<RoomMember[]> =>
  requestJson<RoomMember[]>(`/rooms/${roomId}/members`, {}, { token });

export const approveRoomMember = (
  token: string,
  roomId: string,
  userId: string,
): Promise<RoomMemberMutationResponse> =>
  requestJson<RoomMemberMutationResponse>(
    `/rooms/${roomId}/members/${userId}`,
    {
      method: 'PATCH',
      ...withJsonBody({ status: 'approved' }),
    },
    { token },
  );

export const updateRoomMember = (
  token: string,
  roomId: string,
  userId: string,
  data: UpdateRoomMemberRequest,
): Promise<RoomMemberMutationResponse> =>
  requestJson<RoomMemberMutationResponse>(
    `/rooms/${roomId}/members/${userId}`,
    {
      method: 'PATCH',
      ...withJsonBody(data),
    },
    { token },
  );

export const kickRoomMember = (token: string, roomId: string, userId: string): Promise<void> =>
  requestJson<void>(`/rooms/${roomId}/members/${userId}`, { method: 'DELETE' }, { token });

export const transferRoomOwner = (
  token: string,
  roomId: string,
  ownerId: string,
): Promise<TransferOwnerResponse> =>
  requestJson<TransferOwnerResponse>(
    `/rooms/${roomId}`,
    {
      method: 'PATCH',
      ...withJsonBody({ ownerId }),
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

export const listFolders = (token: string): Promise<ApiFolder[]> =>
  requestJson<ApiFolder[]>('/folders', {}, { token });

export const createFolder = (token: string, name: string): Promise<ApiFolder> =>
  requestJson<ApiFolder>(
    '/folders',
    {
      method: 'POST',
      ...withJsonBody({ name }),
    },
    { token },
  );

export const deleteFolder = (token: string, folderId: string): Promise<void> =>
  requestJson<void>(`/folders/${folderId}`, { method: 'DELETE' }, { token });

export const updateFolderRooms = (
  token: string,
  folderId: string,
  roomIds: string[],
): Promise<{ success: boolean }> =>
  requestJson<{ success: boolean }>(
    `/folders/${folderId}/rooms`,
    {
      method: 'PUT',
      ...withJsonBody({ roomIds }),
    },
    { token },
  );

export const uploadAttachment = async (
  token: string,
  file: File,
): Promise<UploadAttachmentResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  return requestJson<UploadAttachmentResponse>(
    '/attachments',
    {
      method: 'POST',
      body: formData,
    },
    { token },
  );
};

export const attachmentDownloadUrl = (fileUrl: string): string =>
  fileUrl.startsWith('http') ? fileUrl : `${API_BASE_URL}${fileUrl}`;

export const triggerEmergencyAlert = (token: string, message?: string): Promise<EmergencyAlertResult> =>
  requestJson<EmergencyAlertResult>(
    '/users/me/emergency-alert',
    {
      method: 'POST',
      ...withJsonBody(message ? { message } : {}),
    },
    { token },
  );

export const listEmergencyContacts = (token: string): Promise<EmergencyContactResponse[]> =>
  requestJson<EmergencyContactResponse[]>('/users/me/emergency-contacts', {}, { token });

export const upsertEmergencyContact = (
  token: string,
  data: UpsertEmergencyContactRequest,
): Promise<EmergencyContactResponse> =>
  requestJson<EmergencyContactResponse>(
    '/users/me/emergency-contacts',
    {
      method: 'POST',
      ...withJsonBody(data),
    },
    { token },
  );

export const deleteEmergencyContact = (token: string, contactId: string): Promise<{ success: boolean }> =>
  requestJson<{ success: boolean }>(
    `/users/me/emergency-contacts/${contactId}`,
    { method: 'DELETE' },
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
