<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-31 -->

# backend

## Purpose
The Express + TypeScript API server for the chat application. Handles user authentication (JWT + bcrypt), chat room CRUD, real-time messaging via Socket.IO WebSockets, and persists all data to PostgreSQL using raw SQL via the `pg` library. The server listens on port 4000. It implements a layered architecture: Routes -> Controllers -> Services -> Repositories.

## Key Files

| File | Description |
|------|-------------|
| `src/index.ts` | Application entry point — wires up Express middleware, instantiates Repositories, Services, Controllers, mounts Routers, and starts the Socket.IO & HTTP server |
| `src/db.ts` | Shared `pg.Pool` instance exported for use across the app; reads `DATABASE_URL` from env |
| `package.json` | Dependencies and npm scripts; `dev` runs `ts-node-dev`; migration scripts use `node-pg-migrate` |
| `tsconfig.json` | TypeScript compiler configuration |
| `Dockerfile` | Container image definition for production/docker-compose deployment |
| `pnpm-lock.yaml` | Lockfile for deterministic installs (package manager: pnpm) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | TypeScript source code — layered architecture (routes, controllers, services, repositories) (see `src/AGENTS.md`) |
| `tests/` | Vitest tests including unit tests and end-to-end integration tests using real DB |

## For AI Agents

### Working In This Directory
- Database is accessed via the `pg.Pool` in `src/db.ts` — **Prisma has been removed**. All queries use raw SQL with parameterised placeholders (`$1`, `$2`, …).
- Schema migrations are managed with `node-pg-migrate`: `pnpm migrate:up` / `pnpm migrate:down` / `pnpm migrate:create`.
- The `dev` script starts the server directly with `ts-node-dev` — no schema generation step needed.
- Express routes are defined in `src/routes/` and controllers in `src/controllers/`, then mounted in `src/index.ts`. There are NO inline route handlers in `index.ts`.
- Socket.IO uses a JWT middleware (`io.use(...)`) — all socket connections require a valid token in `handshake.auth.token`.

### Testing Requirements
- Tests require a running PostgreSQL instance; set `DATABASE_URL_TEST` (copy `.env.test.example` → `.env.test`).
- Run unit tests (no DB): `pnpm run test:unit`. Run E2E tests: `pnpm run test:db:up && pnpm run test:e2e`.
- Tests use real database calls (integration style) — each test suite creates and tears down its own records.

### Common Patterns
- The backend strictly follows a layered architecture. Repositories handle database SQL, Services handle business logic, Controllers parse HTTP inputs, Routes define endpoints.
- Error handling uses a custom `AppError` class. `ValidationError`, `NotFoundError`, etc., are thrown by Services and caught by the `errorHandler` middleware.
- `204 No Content` is returned on successful DELETE operations.

## Dependencies

### Internal
- `src/db.ts` — shared pg pool consumed by Repositories

### External
- `express` ^5 — HTTP framework
- `socket.io` ^4 — WebSocket server
- `pg` ^8 — PostgreSQL client
- `node-pg-migrate` ^8 — SQL migration runner
- `jsonwebtoken` ^9 — JWT sign/verify
- `bcryptjs` ^3 — password hashing
- `cors` ^2 — cross-origin headers
- `ts-node-dev` — TypeScript dev runner with hot reload
