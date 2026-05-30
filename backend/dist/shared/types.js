"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
