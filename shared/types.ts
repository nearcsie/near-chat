/**
 * Shared API contract — matches api-documentation.md and relation-schema.md.
 *
 * Column-naming convention:
 *   - Database:   snake_case  (user_id, room_id, sent_at, join_time)
 *   - TypeScript: camelCase  (userId, roomId, sentAt, joinTime)
 *   - Repositories own the snake_case → camelCase mapping; nothing above the
 *     repo layer sees snake_case.
 *
 * v1 implementation scope: users, rooms, messages, room_members
 * Deferred (later phases): Folder, Attachment, Friendship, Block,
 *   EmergencyContact, MessageMention
 */

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** Full internal user record — never sent to the client. */
export interface User {
  userId: string;
  name: string;
  email: string;
  /** bcrypt hash; never included in API responses. */
  passwordHash: string;
  bio?: string;
  avatarUrl?: string;
  warningEnabled: boolean;
  warningDays: number;
  lastActivity: Date;
  createdAt: Date;
}

/** Safe public projection of a user — no credentials. */
export interface PublicUser {
  userId: string;
  name: string;
  avatarUrl?: string;
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export type RoomType = 'private' | 'group';

export interface Room {
  roomId: string;
  type: RoomType;
  /** Required when type === 'group'. */
  name?: string;
  avatarUrl?: string;
  inviteCode?: string;
  requireApproval: boolean;
  viewHistory: boolean;
  isArchived: boolean;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface Message {
  messageId: string;
  roomId: string;
  /** null when the sender's account has been deleted (SET NULL on FK). */
  senderId: string | null;
  content: string;
  replyToId?: string;
  isRecalled: boolean;
  sentAt: Date;
}

/** Message enriched with the sender's public profile (via JOIN). */
export interface MessageWithSender extends Message {
  sender: PublicUser | null;
}

// ---------------------------------------------------------------------------
// Room membership
// ---------------------------------------------------------------------------

export type RoomMemberRole = 'owner' | 'admin' | 'member' | 'pending';

export interface RoomMember {
  roomId: string;
  userId: string;
  role: RoomMemberRole;
  nickname?: string;
  isMuted: boolean;
  lastReadId?: string;
  joinTime: Date;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface JwtPayload {
  userId: string;
  name: string;
}

// ---------------------------------------------------------------------------
// API error shape (used by REST responses and Socket.IO error events)
// ---------------------------------------------------------------------------

export interface ApiError {
  statusCode: number;
  message: string;
  /** Optional machine-readable error code, e.g. "NOT_FOUND", "CONFLICT". */
  code?: string;
}

// ---------------------------------------------------------------------------
// Socket.IO event maps — matches api-documentation.md Section 2
// ---------------------------------------------------------------------------

export interface ClientToServerEvents {
  join_room:      (payload: { roomId: string }) => void;
  leave_room:     (payload: { roomId: string }) => void;
  send_message:   (payload: { roomId: string; content: string; replyTo?: string; attachments?: string[] }) => void;
  recall_message: (payload: { messageId: string }) => void;
  typing:         (payload: { roomId: string; isTyping: boolean }) => void;
  read_receipt:   (payload: { roomId: string; messageId: string }) => void;
}

export interface ServerToClientEvents {
  new_message:      (payload: MessageWithSender) => void;
  message_recalled: (payload: { messageId: string }) => void;
  user_typing:      (payload: { roomId: string; userId: string; isTyping: boolean }) => void;
  read_update:      (payload: { roomId: string; userId: string; messageId: string }) => void;
  room_update:      (payload: { type: string; data: unknown }) => void;
  friend_request:   (payload: FriendRequest) => void;
  emergency_alert:  (payload: { userId: string; message: string }) => void;
  error:            (payload: ApiError) => void;
}

// ---------------------------------------------------------------------------
// Deferred entities — not in v1 implementation scope
// Defined here for full API contract coverage; their repositories, services,
// and routes will be implemented in later phases.
// ---------------------------------------------------------------------------

export type FriendshipStatus = 'pending' | 'accepted';

/** Payload for the `friend_request` Socket.IO server event. */
export interface FriendRequest {
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: Date;
}
