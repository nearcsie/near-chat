/**
 * Shared API contract — v1 scope only.
 *
 * In-scope entities: users, rooms, messages, room_members
 * Deferred (not in v1): Folder, Attachment, Friendship, Block, Mention, reply_to_id
 *
 * Column-naming convention:
 *   - Database: snake_case  (user_id, room_id, created_at, password_hash, joined_at)
 *   - API boundary: camelCase  (userId, roomId, createdAt, passwordHash, joinedAt)
 *   - Repositories own the snake_case → camelCase mapping; nothing above the repo layer sees snake_case
 *
 * NOTE: The convention above is the **target state** for the ongoing refactor.
 * The current `backend/src/index.ts` is the legacy monolith and still uses camelCase
 * column aliases directly in SQL — it will be replaced as each repository is implemented.
 */

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** Full internal user record — never sent to the client. */
export interface User {
  id: number;
  username: string;
  /** bcrypt hash of the password; never included in API responses. */
  passwordHash: string;
  createdAt: Date;
}

/** Safe public projection of a user — no credentials. */
export interface PublicUser {
  id: number;
  username: string;
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export interface Room {
  id: number;
  name: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface Message {
  id: number;
  roomId: number;
  userId: number;
  content: string;
  createdAt: Date;
}

/** Message enriched with the author's public profile (via JOIN). */
export interface MessageWithAuthor extends Message {
  author: PublicUser;
}

// ---------------------------------------------------------------------------
// Room membership
// ---------------------------------------------------------------------------

export type RoomMemberRole = 'owner' | 'member';

export interface RoomMember {
  roomId: number;
  userId: number;
  role: RoomMemberRole;
  joinedAt: Date;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface JwtPayload {
  userId: number;
  username: string;
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
// Socket.IO event maps
// ---------------------------------------------------------------------------

export interface ClientToServerEvents {
  join_room: (roomId: number) => void;
  send_message: (payload: { roomId: number; content: string }) => void;
}

export interface ServerToClientEvents {
  message: (payload: MessageWithAuthor) => void;
  /** Emitted on any server-side error; payload conforms to ApiError. */
  error: (payload: ApiError) => void;
}
