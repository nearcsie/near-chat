<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-22 | Updated: 2026-05-24 -->

# services

## Purpose
Data-access layer for User, Room, and Message CRUD operations. Each service module exports typed async functions for a single entity. **These files are untracked and not wired into the running application** — they internally reference `@prisma/client`, which is no longer installed. They must be migrated to use `pool.query(...)` from `../../db.ts` before being activated.

## Key Files

| File | Description |
|------|-------------|
| `userService.ts` | CRUD for `User` — `createUser`, `getUserById`, `getAllUsers`, `updateUser`, `deleteUser`; each function has its own `PrismaClient` instance |
| `roomService.ts` | CRUD for `Room` — `createRoom`, `getRoomById`, `getAllRooms`, `updateRoom`, `deleteRoom` |
| `messageService.ts` | CRUD for `Message` scoped to a room — `createMessage`, `getMessagesByRoomId`, `getMessageById`, `updateMessage`, `deleteMessage`; `createMessage` validates room existence before inserting; `getMessagesByRoomId` includes `user.username` via relation |

## For AI Agents

### Working In This Directory
- These services still use `PrismaClient` from `@prisma/client` — however, **Prisma has been removed from the active backend** (`index.ts` now uses raw `pg` queries via `src/db.ts`). These service files are local untracked code not yet wired into the running application.
- If migrating these services to `pg`, replace `PrismaClient` calls with `pool.query(...)` imported from `../../db.ts` and remove the per-file `new PrismaClient()` instances.
- Services throw `Error` instances with human-readable messages. Route handlers use `.message.includes(keyword)` to distinguish error types — keep error message wording consistent when modifying.
- `messageService.ts` enforces room scoping by filtering on both `id` and `roomId` in update/delete operations — this is a security boundary, preserve it when rewriting to SQL.

### Testing Requirements
- Integration tests in `backend/tests/` cover `userService` and `roomService`. `messageService` has no tests yet.
- Tests import directly from these files — any export signature change requires updating the corresponding test.

### Common Patterns
- All functions are `async` and return typed objects.
- Single-record lookups check for `null` and throw a descriptive error if not found.
- `getMessagesByRoomId` includes username enrichment via a JOIN — preserve this when rewriting to raw SQL.
- `updateUser`/`updateRoom` accept partial data objects with optional fields.

## Dependencies

### Internal
- Will need to import `../../db` (pg pool) once migrated away from Prisma

### External
- `@prisma/client` — currently used but Prisma is no longer installed; migrate to `pg` to align with the rest of the backend

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
