<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-31 -->

# src

## Purpose
TypeScript source code for the Express backend. Contains the application entry point (`index.ts`) and implements a structured layered architecture: Routes -> Controllers -> Services -> Repositories.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Application entry point — initializes Express, Socket.IO; imports `db.ts` pool; instantiates repositories, services, controllers, and mounts routes. All DB calls use raw SQL via `pool.query` from Repositories. |
| `db.ts` | Exports a single shared `pg.Pool` instance configured from `DATABASE_URL` — import this instead of creating new pool instances |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `routes/` | Express Routers that define HTTP endpoints and mount Controller methods. |
| `controllers/` | Handles HTTP request parsing, calls Service methods, and formats HTTP responses. |
| `services/` | Contains core business logic and throws `AppError` on violations. Calls Repositories. |
| `repositories/` | Handles all raw SQL queries to PostgreSQL using `pg` module. Prisma has been completely removed. |
| `middlewares/` | Express middlewares such as `authMiddleware` and `errorHandler`. |
| `realtime/` | Socket.IO server setup, auth, and event handlers. |

## For AI Agents

### Working In This Directory
- The application uses a strict 4-tier architecture. Do not write inline route handlers in `index.ts`. Add your route to the specific file in `routes/`, then the logic to `controllers/`, `services/`, and `repositories/`.
- All endpoints must return standard responses or throw `AppError` which is caught by the global error handler.
- The Socket.IO JWT middleware runs via `io.use(...)` — it attaches `decoded` JWT payload as `socket.user`. Access it in handlers as `(socket as any).user`.

### Common Patterns
- The four-layer pattern: routes parse/validate HTTP input → call service functions → services call repository interfaces → repositories execute raw SQL via `pg`. Prisma has been fully removed.
- Keep `index.ts` focused on wiring (dependency injection, route mounting, socket setup); business logic belongs in `services/`.
- Database operations often use standard raw queries with parameterized inputs. Ensure you do not introduce SQL injection vulnerabilities.

## Dependencies

### Internal
- `migrations/` — SQL migrations managed by `node-pg-migrate`

### External
- `express`, `socket.io`, `pg`, `jsonwebtoken`, `bcryptjs`, `cors`
