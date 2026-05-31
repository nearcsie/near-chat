This PR resolves all open GitHub issues labeled `fix` (#64 to #73).

## Summary of Fixes

- **#73**: Extracted a shared `mapErrorToApiShape` utility in `backend/src/errors/mapError.ts` and unified error handling across Express middleware and Socket.IO.
- **#72**: Replaced fragile string-based error checking in `attachmentController` with `ValidationError` (an `AppError` subclass) to ensure type-safe error handling.
- **#71**: Extracted raw database/business logic from `friendController` into a dedicated `friendService`, adhering to the layered architecture.
- **#70**: Removed dead duck-type guard (`'resolveMentions' in roomMemberRepo`) in `messageService` and safely used the properly typed interface.
- **#69**: Fixed TOCTOU race condition in `addEmergencyContact` by leveraging PostgreSQL's `RETURNING *, (xmax != 0) AS is_update` for atomic upserts.
- **#68**: Fixed message pagination skipping messages by switching to a composite cursor `(sent_at, message_id) < ($2, $3)` and adding the necessary composite index migration.
- **#67**: Fixed message pagination cursor silently returning empty pages by adding a guard that throws a `ValidationError` if the cursor message doesn't exist or isn't in the same room.
- **#66**: Fixed `read_receipt` vulnerability where arbitrary cross-room `messageId`s could be accepted. The event now verifies the message belongs to the specified `roomId`.
- **#65**: Fixed rejecting a friend request deleting accepted friendships by creating `rejectFriendRequest` repository method that strictly limits deletion to `status = 'pending'`.
- **#64**: Fixed `join_room` allowing unauthorized eavesdropping. The socket handler now correctly verifies room membership before calling `socket.join`.

## Testing
- Unit tests added/updated for all changed behaviors.
- E2E tests updated for Socket.IO events, emergency contacts, and friendships.
- All Unit, Integration, and E2E tests pass locally.

Closes #73, Closes #72, Closes #71, Closes #70, Closes #69, Closes #68, Closes #67, Closes #66, Closes #65, Closes #64.
