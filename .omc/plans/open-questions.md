# Open Questions

## TDD + API-First Issue Breakdown — 2026-05-24

- [ ] **Validation library: `express-validator` vs `zod`?** — `zod`-derived types could feed `shared/types.ts` (single source of truth); `express-validator` is closer to Express idioms. Decision blocks Issues #3, #9, #10, #11.
- [ ] **Test DB strategy: ephemeral Docker `postgres` per CI run, or shared dev DB with `TRUNCATE` between tests?** — Affects CI cost vs. flake risk. Decision blocks Issue #2.
- [ ] **Password policy: keep implicit "any non-empty" or introduce minimum-length / complexity rules?** — Affects Service-level validation and test fixtures. Decision blocks Issue #6.
- [ ] **Socket.IO error channel contract: emit typed `error` events to the client or stay with server-side `console.error`?** — Must be defined in `ServerToClientEvents` so frontend can react. Decision affects Issues #1, #12, #14.
- [ ] **Existing data: is there dev data in `users`/`rooms`/`messages` that the initial migration must preserve, or is drop-and-recreate acceptable?** — Affects Issue #5 (`init.sql`).
- [ ] **Monorepo wiring for `shared/`: real `pnpm` workspace package or path-alias only?** — Workspace package gives independent versioning; alias is lighter. Decision blocks Issue #1.
- [ ] **Nested route shape for messages: `/rooms/:roomId/messages` (per PLAN.md) vs. the existing flat `/rooms/:id/messages` in `index.ts`?** — Plan assumes nested; confirm before Issue #11 so frontend/curl scripts align.
- [ ] **JWT secret handling: hard-fail when `JWT_SECRET` missing in production, or keep the silent dev default?** — Security posture decision for Issue #4.
