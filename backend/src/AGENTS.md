<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-22 | Updated: 2026-05-24 -->

# src

## Purpose
TypeScript source code for the Express backend. Contains the monolithic application entry point (`index.ts`) plus a structured two-layer API (routes + services) that is planned but not yet active.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Application entry point — initializes Express, Socket.IO; imports `db.ts` pool; registers inline auth endpoints (`POST /auth/register`, `POST /auth/login`), room/message REST routes, and WebSocket event handlers; all DB calls use raw SQL via `pool.query` |
| `db.ts` | Exports a single shared `pg.Pool` instance configured from `DATABASE_URL` — import this instead of creating new pool instances |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `routes/` | Express Router handlers for User, Room, and Message CRUD — responsible for HTTP parsing, validation, and response codes (see `routes/AGENTS.md`) |
| `services/` | Prisma data-access layer — each service exports typed async functions for CRUD operations (see `services/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- `index.ts` contains **inline route handlers** for auth, rooms, and messages. The `routes/` subdirectory contains a **parallel, cleaner CRUD API** — both exist simultaneously. The inline handlers in `index.ts` are the currently active API; `routes/` handlers are not yet mounted in `index.ts`.
- To wire up the new routes, import them in `index.ts` and mount with `app.use('/api/users', userRouter)` etc.
- The Socket.IO JWT middleware runs via `io.use(...)` — it attaches `decoded` JWT payload as `socket.user`. Access it in handlers as `(socket as any).user`.

### Common Patterns
- The two-layer pattern: routes parse/validate HTTP input → call service functions → services call Prisma → throw descriptive errors up the chain.
- Keep `index.ts` focused on wiring (middleware, route mounting, socket setup); business logic belongs in `services/`.

## Dependencies

### Internal
- `routes/` and `services/` — see respective AGENTS.md
- `migrations/` — SQL migrations managed by `node-pg-migrate`

### External
- `express`, `socket.io`, `pg`, `jsonwebtoken`, `bcryptjs`, `cors`

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
