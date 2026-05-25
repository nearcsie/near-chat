<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-22 | Updated: 2026-05-24 -->

# backend

## Purpose
The Express + TypeScript API server for the chat application. Handles user authentication (JWT + bcrypt), chat room CRUD, real-time messaging via Socket.IO WebSockets, and persists all data to PostgreSQL using raw SQL via the `pg` library. The server listens on port 4000.

## Key Files

| File | Description |
|------|-------------|
| `src/index.ts` | Application entry point — registers Express middleware, inline auth/room/message REST routes, Socket.IO server with JWT middleware, and starts the HTTP server |
| `src/db.ts` | Shared `pg.Pool` instance exported for use across the app; reads `DATABASE_URL` from env |
| `package.json` | Dependencies and npm scripts; `dev` runs `ts-node-dev`; migration scripts use `node-pg-migrate` |
| `tsconfig.json` | TypeScript compiler configuration |
| `Dockerfile` | Container image definition for production/docker-compose deployment |
| `pnpm-lock.yaml` | Lockfile for deterministic installs (package manager: pnpm) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | TypeScript source code — entry point, db pool, plus routes and services subdirectories (see `src/AGENTS.md`) |
| `tests/` | Vitest integration tests for service-layer CRUD operations (see `tests/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- Database is accessed via the `pg.Pool` in `src/db.ts` — **Prisma has been removed**. All queries use raw SQL with parameterised placeholders (`$1`, `$2`, …).
- Schema migrations are managed with `node-pg-migrate`: `pnpm migrate:up` / `pnpm migrate:down` / `pnpm migrate:create`.
- The `dev` script starts the server directly with `ts-node-dev` — no schema generation step needed.
- Auth is handled inline in `src/index.ts` (register/login endpoints); the separate `src/routes/userRoutes.ts` is a CRUD-only route without hashing — do not confuse the two.
- Socket.IO uses a JWT middleware (`io.use(...)`) — all socket connections require a valid token in `handshake.auth.token`.

### Testing Requirements
- Tests require a running PostgreSQL instance matching `DATABASE_URL` in the environment.
- Run tests with: `pnpm vitest` (or `pnpm test` if script is configured).
- Tests use real database calls (integration style) — each test suite creates and tears down its own records.

### Common Patterns
- Services (`src/services/`) still exist as a CRUD layer but are not yet mounted in `index.ts`; `index.ts` uses raw `pool.query` directly.
- IDs are always integers — routes parse `parseInt(req.params.id)` and validate with `isNaN`.
- `204 No Content` is returned on successful DELETE operations.

## Dependencies

### Internal
- `src/db.ts` — shared pg pool consumed by `index.ts` and service modules
- `src/services/` — CRUD service layer (untracked, not yet wired to active routes; still references Prisma internally — needs migration to `pg` before use)

### External
- `express` ^5 — HTTP framework
- `socket.io` ^4 — WebSocket server
- `pg` ^8 — PostgreSQL client
- `node-pg-migrate` ^8 — SQL migration runner
- `jsonwebtoken` ^9 — JWT sign/verify
- `bcryptjs` ^3 — password hashing
- `cors` ^2 — cross-origin headers
- `ts-node-dev` — TypeScript dev runner with hot reload

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
