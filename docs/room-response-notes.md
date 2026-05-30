# Room Response Notes

This file records the implemented backend contract for issues #54 and #59.

- `POST /api/v1/rooms/group` accepts `name`, optional `avatarUrl`, optional `requireApproval`, and optional `viewHistory`.
- Created group rooms return a generated `inviteCode`; another user can join with `POST /api/v1/rooms/join/:code`.
- `GET /api/v1/rooms` returns `RoomSummary[]`: every room field plus `latestMessage?: { messageId, senderId, content, sentAt }` and `unreadCount`.
- Pending room members cannot read or send messages.
- Muted room members cannot send messages.
- When `viewHistory` is `false`, message listing only returns messages sent after the member joined.
- `POST /api/v1/rooms/private` accepts `target_user_id` or `targetUserId` and returns the existing two-user private room when one already exists.
- Private rooms use a deterministic `roomHash` with a unique index to prevent duplicate DMs.
- Private room creation requires an accepted friendship and is blocked when either user has blocked the other.
- Accepting a friend request creates or restores the private room. Removing or blocking a friend marks the private room `isReadonly=true` to preserve history while preventing new sends.
