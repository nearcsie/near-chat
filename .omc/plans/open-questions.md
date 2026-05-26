# Open Questions

## TDD + API-First Issue Breakdown — 2026-05-24

- [x] **Validation library: `zod`** — Decided. `zod` selected for schema validation; Issue #11 acceptance criteria and `shared/types.ts` both assume zod. Resolves Issues #3, #9, #10, #11.
- [x] **Test DB strategy: ephemeral Docker `postgres` per CI run** — Decided. Implemented in Issue #3 (`docker-compose.test.yml`, `DATABASE_URL_TEST`). CI workflow spins up a dedicated postgres service.
- [x] **Password policy: minimum 8 characters** — Decided. Issue #11 acceptance criteria specifies `zod (min 8 chars)`.
- [x] **Socket.IO error channel: emit typed `error` events to the client** — Decided. `ServerToClientEvents['error']` defined in `shared/types.ts` accepts `ApiError` payload.
- [ ] **Existing data: is there dev data in `users`/`rooms`/`messages` that the initial migration must preserve, or is drop-and-recreate acceptable?** — Still open. Affects Issue #5 (`init.sql`).
- [x] **Monorepo wiring for `shared/`: path-alias only** — Decided. Implemented as `tsconfig` path alias `@shared → ../shared` in Issue #2. No separate pnpm workspace package.
- [x] **Nested route shape: `/rooms/:roomId/messages`** — Decided. Confirmed per PLAN.md and GH #16 issue title.
- [x] **JWT secret handling: hard-fail in production** — Decided. GH #5 acceptance criteria: "JWT_SECRET from env with hard fail when NODE_ENV === 'production'".
