<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-22 | Updated: 2026-05-24 -->

# tests

## Purpose
Vitest integration tests for the backend service layer. Tests call the actual service functions against a real PostgreSQL database — no mocking. Each suite manages its own test data via `beforeAll`/`afterAll` setup and teardown.

## Key Files

| File | Description |
|------|-------------|
| `user.test.ts` | Integration tests for `userService` — covers create, read by ID, read non-existent, update, delete, and delete non-existent |
| `room.test.ts` | Integration tests for `roomService` — covers create, read by ID, read non-existent, update, delete, and delete non-existent |

## For AI Agents

### Working In This Directory
- Tests require a live PostgreSQL database; start the `db` container first: `docker compose up db -d`.
- Run all tests from `backend/`: `pnpm vitest` or `pnpm vitest run` for a single pass.
- Test isolation: each suite creates a unique named record in `beforeAll` and deletes it in `afterAll`. Avoid using names like "TestRoomForAPI" or "TestUserAPI" in manual DB operations to prevent conflicts.
- There are no message tests yet — `messageService` is untested.

### Testing Requirements
- `DATABASE_URL` env var must be set before running tests.
- Tests are integration tests — they mutate real data. Do not run against a production database.

### Common Patterns
- Pattern: `beforeAll` creates → tests use the created ID → `afterAll` deletes.
- Non-existent record tests use IDs `999999`/`999998` — safe to assume these don't exist in test environments.
- `expect(...).rejects.toThrow(message)` is the pattern for testing service-layer error messages.

## Dependencies

### Internal
- `../src/services/userService` — tested module
- `../src/services/roomService` — tested module

### External
- `vitest` — test runner (imported as `describe`, `it`, `expect`, `beforeAll`, `afterAll`)
- `vitest` — test runner only; Prisma is not installed, tests go through service functions which use `pg` internally

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
