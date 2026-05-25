# Plan: TDD + API-First Issue Breakdown for 4-Layer Refactor

> **Mode:** RALPLAN consensus — **PENDING APPROVAL** (Planner + Architect + Critic approved, Round 2)
> **Source task:** Split `PLAN.md` 4-layer architecture rollout into minimally-coupled GitHub issues
> **Stack:** Express 5 + Socket.IO 4 + `pg` 8 (no Prisma) + Vitest + Next.js (App Router) + React
> **Issue count:** 19 issues (Issue #0 pre-flight + 14 logical units, with #5 split into #5a–#5e)

---

## 1. RALPLAN-DR Summary

### Principles (governing rules)

1. **Contract-first, code-second.** Every layer below the wire is implemented against a shared TypeScript contract (`shared/types.ts`) that exists before any handler, service, or repository is written.
2. **One layer, one issue.** A single PR/issue must not cross the Routes ↔ Controllers ↔ Services ↔ Repositories boundary for the same domain in the same change set; cross-layer wiring is its own thin "integration" issue.
3. **Tests precede or accompany production code (TDD).** Service-layer issues must ship with Vitest suites that mock the Repository interface. Repository-layer issues ship with integration tests against a real `pg` pool (test DB).
4. **Mockable seams via dependency injection.** Services receive a Repository object (typed interface) rather than importing concrete `pg` modules — so Service tests never touch a database.
5. **Strangler, not rewrite.** `index.ts` Fat Handler stays alive while new layers are built behind it; cutover is a single late-stage issue with a revert path.

### Decision Drivers (top 3)

1. **Prisma is dead — but the untracked code still imports it.** All current `services/*.ts`, `routes/*.ts`, and `tests/*.test.ts` will not compile because `@prisma/client` is not in `package.json`. The dependency on Prisma is a hard blocker that must be cleared **before** the planning sequence can proceed (see new Issue #0).
2. **Coupling minimization across parallel contributors.** PLAN.md is a teaching artifact ("組員 A 寫 Repository, 組員 B 寫 Service"). The issue graph must let two devs work the same domain (e.g. messages) in parallel without merge collisions — which forces the Repository **interfaces** (Issue #5a) to land before any concrete pg implementation or any Service starts.
3. **TDD viability vs. infra cost.** Service tests must run on every PR with no DB; Repository/integration tests need Postgres. This drives the test-tier split (unit vs. integration) and the test-DB infra decision (ephemeral Docker postgres via `docker-compose.test.yml`, see Issue #2).

### Viable Options

#### Option A — **Horizontal slicing by layer** (foundation → repo → service → controller → route → cutover)

Sequence: Types/Errors/Auth foundation → all Repositories → all Services → all Controllers → all Routes → cutover.

- **Pros:** Strict layered discipline; each PR teaches one concept; reviewers stay in one mental model; conflicts across domains are minimal because all writers touch sibling files.
- **Cons:** No working end-to-end feature until very late; if Repository signatures need a tweak, every downstream layer rebases.
- **Best when:** Team is junior and benefits from the pedagogy of finishing one layer before the next.

#### Option B — **Vertical slicing by domain** (auth feature complete → rooms feature complete → messages feature complete)

Sequence: shared foundation → full `users` stack (Repo+Service+Controller+Route+Tests) → full `rooms` stack → full `messages` stack → Socket.IO.

- **Pros:** Each merged PR delivers a real working endpoint; smoke-testable via curl after every merge; bisect-friendly.
- **Cons:** One issue ends up touching all 4 layers — exactly what Principle #2 forbids. Two devs cannot parallelise on the same domain. Higher merge-conflict risk inside a domain.
- **Best when:** Solo developer or strict feature-delivery-per-week cadence.

#### Option C — **Hybrid: Foundation parallel-fan-out** (RECOMMENDED)

Sequence:
- **Phase -1 (pre-flight, blocking):** Quarantine broken untracked Prisma files (#0).
- **Phase 0 (serial, blocking):** Shared types contract → Test harness → Errors + Auth middleware (#1, #2, #3, #4).
- **Phase 1a (serial, gates Phase 1b):** Repository **interfaces** + migration file + schema-scope lock (#5a).
- **Phase 1b (parallel fan-out):** Repository pg implementations per domain (#5b, #5c, #5d, #5e) + Services that consume interfaces (#6, #7, #8). Services can run in parallel with repo impls because they mock the interfaces from #5a.
- **Phase 2 (parallel):** Controllers + Routes wiring per domain (#9, #10, #11) once matching service exists.
- **Phase 3 (serial):** Socket.IO extraction (#12), Cutover wiring in `index.ts` (#13), Frontend type consumption (#14).

- **Pros:** Maximises parallelism (3+ devs can work concurrently in Phase 1b/2); enforces Principle #2; contract-first means rebase cost is bounded; each issue still has ≤3 deps.
- **Cons:** Requires a strict freeze on `shared/types.ts` after Phase 0 and on repository interfaces after Phase 1a; coordination cost in the first week.
- **Best when:** ≥2 contributors and TDD discipline matters more than vertical delivery.

> **Recommendation:** **Option C (Hybrid)** for ≥2 contributors. **Fallback to Option B (vertical domain slicing)** for a solo developer — if Phase 1 fan-out shows merge-conflict thrash or there is only one active contributor, collapse each domain (e.g. "messages") into a single vertical slice issue. Option A is the last resort if review bandwidth is critically constrained. The key signal for switching: if Phase 0 completes with only 1 active contributor, prefer Option B.

---

## 2. Issue Breakdown (Option C)

Each issue is sized for a single PR (≤500 LOC delta) and lists explicit deps. Acceptance criteria are testable via Vitest, `curl`, or browser DevTools.

### Phase -1 — Pre-flight (must land first)

---

#### Issue #0 — Quarantine broken untracked Prisma files

- **Domain/Layer:** Cleanup / pre-flight
- **Dependencies:** none
- **Why first:** All untracked `services/*.ts`, `routes/*.ts`, and `tests/*.test.ts` import `@prisma/client`, which is not in `package.json`. They block any TypeScript compile gate the rest of the plan relies on. Removing them clears the path; the same domain logic is rewritten in #6/#7/#8/#9/#10/#11 against the new interfaces.
- **Files to delete:**
  - `backend/src/services/userService.ts`
  - `backend/src/services/roomService.ts`
  - `backend/src/services/messageService.ts`
  - `backend/tests/user.test.ts`
  - `backend/tests/room.test.ts`
  - `backend/src/routes/userRoutes.ts`
  - `backend/src/routes/roomRoutes.ts`
  - `backend/src/routes/messageRoutes.ts`
- **Acceptance criteria:**
  - `! grep -r "@prisma/client" backend/` returns zero matches.
  - `pnpm --prefix backend exec tsc --noEmit` exits 0 (no compile errors from the deleted set).
  - `backend/src/index.ts` still boots via `docker compose up -d && docker compose logs -f backend` (the Fat Handler is the only path; deleted files are not wired into it).
  - PR description notes: "These files are recreated from scratch against the new contract in Issues #6–#11; nothing of value is lost because they never compiled."

---

### Phase 0 — Foundation (serial, must land in order)

---

#### Issue #1 — Shared API contract (`shared/types.ts`)

- **Domain/Layer:** Cross-cutting (API contract)
- **Dependencies:** #0
- **Why first in Phase 0:** API-First — backend and frontend must agree on wire shapes before either is written. Locks user IDs as `number` (pg `SERIAL`), timestamps as ISO `string`, error shapes, **column-naming convention**, and **Socket.IO error event shape**.
- **Files to create:**
  - `shared/types.ts` (new) — single source of truth for wire shapes
  - `shared/types.assert.ts` — compile-time `Equals<>` type assertions (e.g. `PublicUser` must not include `password`)
  - `tsconfig.base.json` at repo root with `compilerOptions.paths: { "@shared/*": ["./shared/*"] }`
  - Update `backend/tsconfig.json` to `extends: "../tsconfig.base.json"`
  - Update `frontend/tsconfig.json` to `extends: "../tsconfig.base.json"`
- **Contents of `shared/types.ts`:** `User`, `PublicUser` (no `password`), `Room`, `Message`, `MessageWithAuthor`, `RoomMember`, `AuthRequest`, `AuthResponse`, `ApiError`, `ClientToServerEvents`, `ServerToClientEvents` (including the new `error` event).
- **Schema scope (v1 lock):** v1 entities are `users`, `rooms`, `messages`, `room_members` only. Explicitly **deferred to future issues**: `Folder`, `Attachment`, `Friendship`, `Block`, `EmergencyContact`, `Mention`, `reply_to_id`. The PR must include a JSDoc block at the top of `shared/types.ts` listing the deferred entities and pointing to PLAN.md as the source.
- **Column-naming convention (locked):** Document via JSDoc in `shared/types.ts`: **snake_case in DB** (per `docs/er_diagram.md` — `user_id`, `room_id`, `created_at`, `password_hash`), **camelCase at the API/TypeScript boundary** (e.g. `userId`, `roomId`, `createdAt`). **Repositories own the mapping** from snake_case DB rows to camelCase objects; nothing above the repository layer ever sees snake_case.
- **Socket.IO error event (locked here, consumed by #12):** Add `ServerToClientEvents.error: (payload: ApiError) => void` where `ApiError` is the same shape returned by the HTTP error middleware.
- **Acceptance criteria:**
  - `pnpm --prefix backend exec tsc --noEmit` exits 0.
  - `pnpm --prefix frontend exec tsc --noEmit` exits 0.
  - `import type { PublicUser } from '@shared/types'` resolves in both `backend/src/` and `frontend/app/`.
  - `PublicUser` does **not** include `password` field (compile-time check via `shared/types.assert.ts`).
  - No `any` types introduced.
  - **No root `package.json` or `pnpm-workspace.yaml` is created in this PR** — path-alias-only integration.
  - JSDoc in `shared/types.ts` documents both (a) v1 schema scope with deferred entity list and (b) the snake_case-DB / camelCase-API convention.
  - `ServerToClientEvents.error: (payload: ApiError) => void` is exported.

---

#### Issue #2 — Test infrastructure (Vitest + ephemeral Docker test DB)

- **Domain/Layer:** Tooling
- **Dependencies:** #0 (broken legacy tests must be gone first)
- **Files to create/modify:**
  - `backend/vitest.config.ts`
  - `backend/tests/helpers/testPool.ts` — `pg` pool bound to `DATABASE_URL_TEST`
  - `backend/tests/helpers/resetDb.ts` — `TRUNCATE users, rooms, messages, room_members RESTART IDENTITY CASCADE`
  - `backend/package.json` scripts: `test`, `test:unit`, `test:integration`, `test:db:up`, `test:db:down`
  - `backend/.env.test.example`
  - `docker-compose.test.yml` at repo root — `postgres:16` service exposing port 5433, with seeded `DATABASE_URL_TEST` template
  - Add `vitest`, `@vitest/coverage-v8` to `backend/devDependencies`
- **Acceptance criteria:**
  - `pnpm --prefix backend run test:unit` runs and reports 0 tests (no false failure) — i.e. Vitest is wired but unit suites are empty until #6.
  - `pnpm --prefix backend run test:integration` first runs `docker compose -f docker-compose.test.yml up -d`, waits for the postgres healthcheck, and then executes integration tests against `DATABASE_URL_TEST` (currently no integration tests — same "0 tests" pass acceptable).
  - `pnpm --prefix backend run test:db:down` stops the container cleanly.
  - The reset helper truncates cleanly (tested in #5b/c/d).
  - CI matrix wires both tiers (unit on every PR, integration on merge-to-main or PR label).

---

#### Issue #3 — Error model + global error middleware

- **Domain/Layer:** Cross-cutting (HTTP)
- **Dependencies:** #1 (uses `ApiError` shape)
- **Files to create:**
  - `backend/src/errors/AppError.ts` — `AppError`, `NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`
  - `backend/src/middlewares/errorHandler.ts` — Express 5 error middleware mapping `AppError` → status + JSON
  - `backend/tests/middlewares/errorHandler.test.ts`
- **Acceptance criteria:**
  - Throwing `new NotFoundError('user', 42)` from a route handler returns `404` with body matching `ApiError`.
  - Unknown error returns `500` with generic message (no stack leaked in prod).
  - Vitest unit test asserts each status mapping (NotFound→404, Forbidden→403, Validation→400, Conflict→409, unknown→500).

---

#### Issue #4 — Auth middleware + JWT helper

- **Domain/Layer:** Cross-cutting (security)
- **Dependencies:** #1 (uses `AuthPayload` type), #3 (throws `AppError`)
- **Files to create:**
  - `backend/src/auth/jwt.ts` — `signToken(payload)`, `verifyToken(token)`
  - `backend/src/middlewares/authMiddleware.ts` — reads `Authorization: Bearer <token>`, attaches `req.user: AuthPayload`
  - `backend/src/types/express.d.ts` — augment Express `Request` with `user?: AuthPayload`
  - `backend/tests/middlewares/authMiddleware.test.ts`
- **Acceptance criteria:**
  - Vitest: missing header → `401`; malformed token → `401`; valid token → `next()` called and `req.user` populated.
  - `JWT_SECRET` read from `process.env` with a hard fail (not silent default) when `NODE_ENV === 'production'`.
  - No coupling to any Service/Repository — pure middleware.

---

### Phase 1a — Repository interfaces + migration (serial gate)

---

#### Issue #5a — Repository interfaces + migration file + schema-scope lock

- **Domain/Layer:** Repository (interfaces only) + DB schema
- **Dependencies:** #1
- **Rationale:** Interfaces must land before services (#6/#7/#8) or pg impls (#5b/c/d/e) start, so they can be mocked or implemented in parallel. Migration file lives here so all repo impl PRs reference the same schema.
- **Files to create:**
  - `backend/src/repositories/IUserRepository.ts`
  - `backend/src/repositories/IRoomRepository.ts`
  - `backend/src/repositories/IMessageRepository.ts`
  - `backend/src/repositories/IRoomMemberRepository.ts`
  - `backend/migrations/<timestamp>_init.sql` (generated via `node-pg-migrate create init`) — creates `users`, `rooms`, `messages`, `room_members`
- **Acceptance criteria:**
  - `pnpm --prefix backend exec tsc --noEmit` passes — interfaces compile against `shared/types`.
  - Migration file exists but **need not run** in this PR; it is exercised in #5b/c/d/e.
  - Migration SQL uses **snake_case column names exclusively** (e.g. `user_id`, `room_id`, `created_at`, `password_hash`, `room_id`, `joined_at`) — per the convention locked in #1.
  - v1 schema scope confirmed locked: tables are exactly `users`, `rooms`, `messages`, `room_members`. Any reference to `folders`, `attachments`, `friendships`, `blocks`, `emergency_contacts`, `mentions`, or `reply_to_id` is rejected in review.
  - **No pg implementations are created in this PR.**
  - Interfaces use TypeScript types from `@shared/types` (camelCase parameters and return values).
  - PR description includes a one-line summary of each interface method (≤6 methods per repo).

---

### Phase 1b — Repository pg implementations + Services (parallel fan-out)

> Each #5b/c/d/e depends only on #5a — they can land in any order or simultaneously.

---

#### Issue #5b — userRepository (pg) + integration test

- **Domain/Layer:** Repository (pg implementation)
- **Dependencies:** #2 (test infra), #5a (interface + migration)
- **Files to create:**
  - `backend/src/repositories/userRepository.ts`
  - `backend/tests/repositories/userRepository.int.test.ts`
- **Acceptance criteria:**
  - Implements `IUserRepository` against `pg`.
  - Integration test: `create` → `getById` → `getByUsername` → `update` → `delete`, asserting counts and that returned objects use camelCase fields (e.g. `passwordHash`, `createdAt`).
  - All `rows[]` returned by pg are mapped to camelCase TypeScript objects before returning (mapper helper colocated in this file or a `mappers/` folder).
  - **Zero `req`/`res` references and zero business-logic branches** — grep gate: `! grep -E "\breq\." backend/src/repositories/`.
  - All queries use parameterised `$1, $2` placeholders (no string concat).

---

#### Issue #5c — roomRepository (pg) + integration test

- **Domain/Layer:** Repository (pg implementation)
- **Dependencies:** #2, #5a
- **Files to create:**
  - `backend/src/repositories/roomRepository.ts`
  - `backend/tests/repositories/roomRepository.int.test.ts`
- **Acceptance criteria:**
  - Implements `IRoomRepository` against `pg`.
  - Integration test covers `create` → `list` → `getById` → `update` → `delete`.
  - Snake_case → camelCase mapping enforced.
  - Same grep + parameterised-query gates as #5b.

---

#### Issue #5d — messageRepository (pg) + integration test

- **Domain/Layer:** Repository (pg implementation)
- **Dependencies:** #2, #5a, #5b (FK to users for the `JOIN`), #5c (FK to rooms)
- **Files to create:**
  - `backend/src/repositories/messageRepository.ts`
  - `backend/tests/repositories/messageRepository.int.test.ts`
- **Acceptance criteria:**
  - Implements `IMessageRepository` against `pg`.
  - Integration test covers `create` and `listForRoom` (chronological order, joined with `users` to produce `MessageWithAuthor`).
  - Snake_case → camelCase mapping enforced (e.g. `user_id` → `userId`, `created_at` → `createdAt`).
  - Same grep + parameterised-query gates as #5b.

---

#### Issue #5e — roomMemberRepository (pg) + integration test

- **Domain/Layer:** Repository (pg implementation)
- **Dependencies:** #2, #5a, #5b, #5c
- **Why this exists:** v1 schema scope (locked in #1/#5a) includes `room_members`. Issue #8 (messageService) needs room-membership checks per PLAN.md:62–75 — this repo unblocks that.
- **Files to create:**
  - `backend/src/repositories/roomMemberRepository.ts`
  - `backend/tests/repositories/roomMemberRepository.int.test.ts`
- **Acceptance criteria:**
  - `addMember(roomId, userId, role)` inserts and returns a `RoomMember`.
  - `getMember(roomId, userId)` returns `RoomMember | null`.
  - `listMembers(roomId)` returns `RoomMember[]`.
  - `removeMember(roomId, userId)` deletes and returns boolean.
  - Integration test: add member → list → remove; assert counts.
  - Snake_case → camelCase mapping enforced.
  - Same grep + parameterised-query gates as #5b.

---

#### Issue #6 — User Service + auth flows (register/login)

- **Domain/Layer:** Service
- **Dependencies:** #1, #4 (jwt helper), #5a (interfaces; can start before #5b merges by mocking)
- **Files to create:**
  - `backend/src/services/userService.ts` — Factory `makeUserService(repo: IUserRepository, jwt: JwtHelper)` returning `{ register, login, getById, list, update, delete }`.
  - `backend/src/validators/userSchemas.ts` — **zod** schemas; `z.infer<>` exported so they line up with `shared/types`.
  - `backend/tests/services/userService.test.ts` — Vitest with **mocked** `IUserRepository`.
- **Acceptance criteria:**
  - `register`: hashes password via `bcryptjs`, calls `repo.create`, returns `PublicUser` (no password) + token. Test mocks repo and asserts hash invocation.
  - `register` with duplicate username → throws `ConflictError`.
  - `login`: looks up by username, compares hash, returns token + `PublicUser`. Wrong password → `ValidationError`.
  - **Password minimum length: 8 characters**, enforced by zod schema; shorter password returns `ValidationError`.
  - No `import` of `pg` or `@prisma/client`. No `req`/`res`.
  - Coverage ≥80% on this file.

---

#### Issue #7 — Room Service

- **Domain/Layer:** Service
- **Dependencies:** #1, #5a
- **Files to create:**
  - `backend/src/services/roomService.ts` — Factory `makeRoomService(repo: IRoomRepository)`.
  - `backend/src/validators/roomSchemas.ts` — **zod** schemas; types derived via `z.infer<>`.
  - `backend/tests/services/roomService.test.ts` — mocked repo.
- **Acceptance criteria:**
  - `create({ name })` rejects empty/whitespace name with `ValidationError` (via zod).
  - `getById` returns the room or throws `NotFoundError`.
  - `list` returns array (possibly empty).
  - Update/delete throw `NotFoundError` when repo returns null.
  - **Does not** import the user or message service (no cross-service deps).

---

#### Issue #8 — Message Service (REST + Socket.IO shared path)

- **Domain/Layer:** Service
- **Dependencies:** #1, #5a, #5e (room-membership check uses `IRoomMemberRepository`)
- **Files to create:**
  - `backend/src/services/messageService.ts` — Factory `makeMessageService(msgRepo, roomRepo, roomMemberRepo)`.
  - `backend/src/validators/messageSchemas.ts` — **zod** schemas; types derived via `z.infer<>`.
  - `backend/tests/services/messageService.test.ts` — mocked repos.
- **Acceptance criteria:**
  - `sendMessage(userId, roomId, content)`: validates content non-empty via zod, asserts room exists (else `NotFoundError`), asserts caller is a member via `roomMemberRepo.getMember` (else `ForbiddenError`), returns `MessageWithAuthor`. **Exact same method** is called by both the REST route and the Socket.IO handler in #12 — no duplicated logic.
  - `listForRoom(roomId)` returns chronologically ordered messages with author.
  - Recall/update/delete enforce "must belong to room" via `NotFoundError`.
  - No `socket.io` or `express` imports — pure logic.

---

### Phase 2 — Controllers + Routes wiring (parallel, per domain)

---

#### Issue #9 — User Controller + Routes (+ auth routes)

- **Domain/Layer:** Controller + Routes
- **Dependencies:** #3, #4, #6
- **Files to create:**
  - `backend/src/controllers/userController.ts` (new)
  - `backend/src/controllers/authController.ts` (new) — `register`, `login`
  - `backend/src/routes/userRoutes.ts` (new — note: #0 deleted the old broken file)
  - `backend/src/routes/authRoutes.ts` (new)
- **Acceptance criteria:**
  - Input validation via the zod schemas exported from `backend/src/validators/userSchemas.ts` (issue #6); validation errors map to `ValidationError` → `400`.
  - `POST /auth/register` returns `201` with `{ token, user: PublicUser }`. Duplicate username → `409`. **Password is never echoed back** (regression from `index.ts:37`).
  - `POST /auth/login` returns `200` with `{ token, user: PublicUser }`; wrong creds → `400`.
  - `GET /users/:id` without `Authorization` header → `401`.
  - Controller files contain **zero SQL** and **zero `bcrypt`/`jwt`** calls — grep gate.
  - Manual `curl` script in PR description proves the four endpoints.

---

#### Issue #10 — Room Controller + Routes

- **Domain/Layer:** Controller + Routes
- **Dependencies:** #3, #4, #7
- **Files to create:**
  - `backend/src/controllers/roomController.ts` (new)
  - `backend/src/routes/roomRoutes.ts` (new — note: #0 deleted the old broken file)
- **Acceptance criteria:**
  - Input validation via zod schemas from `backend/src/validators/roomSchemas.ts` (issue #7).
  - `GET /rooms` (auth required) returns `Room[]` matching shared type.
  - `POST /rooms` with `{ name }` returns `201` + `Room`.
  - Invalid body → `400` from validator, not controller.
  - Controller has zero SQL / zero Service-internal knowledge.

---

#### Issue #11 — Message Controller + Routes

- **Domain/Layer:** Controller + Routes
- **Dependencies:** #3, #4, #8
- **Files to create:**
  - `backend/src/controllers/messageController.ts` (new)
  - `backend/src/routes/messageRoutes.ts` (new — note: #0 deleted the old broken file). Nested route `/rooms/:roomId/messages` (matches PLAN.md), not the old flat `/messages`.
- **Acceptance criteria:**
  - Input validation via zod schemas from `backend/src/validators/messageSchemas.ts` (issue #8).
  - `GET /rooms/:roomId/messages` returns `MessageWithAuthor[]`.
  - `POST /rooms/:roomId/messages` with body `{ content }` returns `201` + `MessageWithAuthor`. `userId` comes from `req.user`, **not** body — fixes the `(req as any).user || { userId: 1 }` placeholder that existed in the original untracked file.
  - Non-existent room → `404`; non-member → `403`.

---

### Phase 3 — Socket.IO, Cutover, Frontend

---

#### Issue #12 — Socket.IO extraction to messageService

- **Domain/Layer:** Realtime
- **Dependencies:** #4 (JWT verification), #8 (calls the same `sendMessage`)
- **Files to create:**
  - `backend/src/realtime/socketServer.ts` — exports `attachSockets(io, deps)` that registers `connection` / `join_room` / `send_message` / `disconnect`
  - `backend/src/realtime/authSocket.ts` — `io.use` middleware reusing `verifyToken` from #4
  - `backend/tests/realtime/socketServer.test.ts` — uses `socket.io-client` against an in-memory server, asserts `send_message` calls `messageService.sendMessage` and broadcasts `new_message`
- **Acceptance criteria:**
  - The `send_message` handler contains **no SQL** — it only calls `messageService.sendMessage(...)`.
  - Authentication middleware shares the same `verifyToken` as the HTTP middleware (no duplicate JWT code).
  - Vitest: connecting with no token → rejected; connecting + emitting `send_message` for a non-existent room → emits **`error` event with `ApiError` shape** (defined in #1 as `ServerToClientEvents.error`), **not** a silent `console.error`.
  - `console.error`-only error paths are removed; failure modes always reach the client via the typed `error` event.

---

#### Issue #13 — Cutover: rewire `index.ts` (composition root) + route-collision gate

- **Domain/Layer:** Composition / wiring
- **Dependencies:** #9, #10, #11, #12
- **Files to modify:**
  - `backend/src/index.ts` — **shrink** to: load env → create `pg` pool → instantiate repositories → instantiate services → instantiate controllers → mount routers → register error middleware → `attachSockets(io, ...)` → `server.listen`.
  - Delete the inline auth/rooms/messages handlers.
  - Keep the `Server` + `cors` setup.
- **Pre-cutover snapshot (mandatory, in this PR):**
  - Capture pre-cutover response shapes for all 5 endpoints (`POST /auth/register`, `POST /auth/login`, `GET /rooms`, `POST /rooms`, `GET /rooms/:roomId/messages`) into `backend/tests/fixtures/legacy-responses.json` **before** removing inline handlers.
  - PR description lists any intentional shape changes (e.g. `password` field removed from register response — that was a bug in `index.ts:37`).
- **Acceptance criteria:**
  - `index.ts` ≤80 LOC.
  - `grep -E "pool\.query|bcrypt|jwt\.(sign|verify)" backend/src/index.ts` returns **zero matches**.
  - `grep -E "app\.(get|post|put|patch|delete)" backend/src/index.ts` returns **zero matches** — all inline handlers removed; only `app.use(router)` and middleware mounts remain.
  - `docker compose up -d` boots; the 5 legacy endpoints still respond — proven by a `curl` script attached to the PR.
  - Post-cutover integration test (or PR description) compares responses against `legacy-responses.json` and explicitly documents every intentional change.
  - Socket.IO smoke test: two browsers connect, `send_message` from one is received by the other.

---

#### Issue #14 — Frontend consumes `@shared/types`

- **Domain/Layer:** Frontend type wiring
- **Dependencies:** #1, #13 (so API endpoint set is stable)
- **Files to create/modify:**
  - `frontend/lib/api.ts` (new) — typed fetch wrappers `login()`, `register()`, `listRooms()`, `sendMessage()` typed against `shared/types`.
  - Refactor any existing chat page components to drop ad-hoc `any` types.
  - `frontend/tsconfig.json` path alias check (already done in #1; verify it still resolves).
- **Acceptance criteria:**
  - `pnpm --prefix frontend exec tsc --noEmit` passes.
  - No `any` introduced in `frontend/lib/api.ts`.
  - Manual: register/login/post-message flow works end-to-end in browser DevTools network tab and the response shape matches the typed wrapper.

---

## 3. Dependency Graph (at a glance)

```
  #0 quarantine broken Prisma files
        │
        ▼
  #1 shared/types ───────────────────────────────────┐
        │                                            │
        ▼                                            ▼
  #2 test harness    #3 errors ──┐            #14 frontend types
        │                │       │
        ▼                ▼       ▼
        │              #4 auth/jwt
        │                │
        ▼                │
  #5a repo interfaces    │
   + migration           │
   + schema lock         │
   ┌──┬──┬──┬──┐         │
   ▼  ▼  ▼  ▼  ▼         ▼
  #5b #5c #5d #5e   (Services depend on #5a interfaces only,
   (pg impls,        so they run in parallel with pg impls)
   parallel)
                    │   │   │
                    ▼   ▼   ▼
                   #6  #7  #8  services (mock #5a interfaces)
                    │   │   │
                    ▼   ▼   ▼
                   #9 #10 #11 controllers + routes
                          │
                          ├──────► #12 Socket.IO
                          │             │
                          ▼             ▼
                         #13 cutover (composition root)
                          │
                          ▼
                         #14 frontend
```

**Notes:**
- #5a is the second serial gate after Phase 0. All Phase 1b issues (#5b–#5e, #6–#8) depend only on #5a.
- #5d and #5e have implicit FK dependencies on #5b/#5c at integration-test time, but the source code does not depend on them (interfaces decouple).
- Every issue has **≤3 direct dependencies** and is mergeable independently once its deps land.

---

## 4. Guardrails

### Must Have
- `shared/types.ts` is the **single source of truth** for wire shapes.
- Every service receives its repository via constructor/factory args (DI) — never `import { repo } from '..'` inside the service body.
- CI gate: `grep` checks forbid `pool.query` outside `repositories/`, forbid `\breq\.` (word boundary) outside `controllers/` `routes/` `middlewares/`, forbid `@prisma/client` anywhere.
- Each PR description includes a `curl` (REST) or `socket.io-client` (realtime) snippet proving the AC.
- Migrations live in `backend/migrations/` (managed by `node-pg-migrate`).
- DB columns are snake_case; TypeScript objects above the repository layer are camelCase. Repositories own the mapping.
- Validation library is **zod**; types are derived via `z.infer<>` to stay aligned with `shared/types`.

### Must NOT Have
- No `@prisma/client` imports anywhere after #0 lands.
- No SQL strings inside `services/`, `controllers/`, or `routes/`.
- No business-logic `if`/`throw` inside `repositories/` or `controllers/`.
- No new global singletons (`new PrismaClient()` style) — use the composition root in `index.ts`.
- No issue that spans more than two layers (Controller+Route is the only allowed pair, per Phase 2).
- No silent `console.error` for Socket.IO failures — all errors reach the client via the typed `error` event.
- No root `package.json` or `pnpm-workspace.yaml` introduced by Issue #1 (path-alias-only).

---

## 5. Success Criteria (overall plan)

- 19 GitHub issues created (#0, #1–#4, #5a–#5e, #6–#14), each ≤3 deps, each independently mergeable.
- Final state: `backend/src/index.ts` is a thin composition root; all SQL lives in `repositories/`; all logic in `services/`; all HTTP in `controllers/`+`routes/`; Socket.IO calls the same service methods as REST.
- Vitest suite is green with two tiers (`test:unit` no-DB, `test:integration` with ephemeral Docker postgres).
- Frontend imports types from `@shared/types` with zero `any`.
- Legacy `index.ts` Fat Handler is deleted in #13, not before — and only after the pre-cutover response snapshot lands in `backend/tests/fixtures/legacy-responses.json`.

---

## 6. Open Questions — RESOLVED

All previously deferred items are now resolved and propagated into the ACs above:

1. **Validation library:** **zod**. Services (#6/#7/#8) own the schemas in `backend/src/validators/*Schemas.ts`; types are derived via `z.infer<>` so they stay aligned with `shared/types`. Controllers (#9/#10/#11) consume the schemas as middleware.
2. **Test DB strategy:** **ephemeral Docker postgres** via `docker-compose.test.yml`. Issue #2 owns the docker-compose file and the `test:db:up`/`test:db:down` scripts; `pnpm test:integration` spins the container up before tests.
3. **Password rules:** **minimum 8 characters**, enforced via zod schema in Issue #6. Shorter password returns `ValidationError`.
4. **Socket.IO error channel:** define `ServerToClientEvents.error: (payload: ApiError) => void` in Issue #1 (`ApiError` is the same shape returned by the HTTP error middleware). Issue #12 emits this event on failure; `console.error`-only paths are removed.
5. **Schema scope (v1):** locked in Issue #1 / #5a to `users`, `rooms`, `messages`, `room_members`. Explicitly deferred to future issues: `Folder`, `Attachment`, `Friendship`, `Block`, `EmergencyContact`, `Mention`, `reply_to_id`.
6. **Monorepo tool:** **path-alias only** via `tsconfig.base.json` with `paths: { "@shared/*": ["./shared/*"] }`. No root `package.json` or `pnpm-workspace.yaml` is introduced. Both `backend/tsconfig.json` and `frontend/tsconfig.json` extend `tsconfig.base.json`.
7. **Column-naming convention:** snake_case in DB, camelCase at the API/TypeScript boundary; repositories own the mapping. Documented in `shared/types.ts` JSDoc (Issue #1) and enforced in migration SQL (Issue #5a) and repo impls (Issue #5b–#5e).

---

## 7. ADR (Architecture Decision Record)

- **Decision:** **Option C (Hybrid Foundation Parallel-Fan-Out)** with Architect amendments A0–A3 incorporated: Issue #0 added as pre-flight quarantine of broken Prisma files; Issue #5 split into #5a (interfaces + migration + schema lock) and #5b–#5e (pg implementations including new RoomMember repository); Issue #1 expanded to lock column-naming convention, schema scope, and Socket.IO error event shape; Issue #13 augmented with a route-collision grep gate and a pre-cutover response snapshot.

- **Drivers:**
  1. Untracked Prisma files block any TypeScript compile gate the plan relies on (clear with #0 first).
  2. PLAN.md is explicitly a team teaching artifact; the graph must allow ≥2 contributors to work the same domain (e.g. messages) in parallel without merge collisions — Repository interfaces (#5a) must precede pg impls (#5b–#5e) and services (#6–#8).
  3. Service tests must run with no DB; repository tests need Postgres — drives the test-tier split and the docker-compose-based ephemeral test DB.

- **Alternatives considered:**
  - **Option A (horizontal slicing by layer):** strict pedagogy, but no working endpoint until very late; rebase cost if Repository signatures shift. **Fallback only** if review bandwidth is critically constrained.
  - **Option B (vertical slicing by domain):** smoke-testable per merge, but violates Principle #2 (one issue spans 4 layers); two devs cannot parallelise on the same domain. **Explicit fallback** for solo developers — if Phase 0 completes with only 1 active contributor, collapse each domain into a single vertical-slice issue.

- **Why chosen:** Option C is the only path that simultaneously satisfies Principles #1 (contract-first), #2 (one layer per issue), and #4 (mockable DI seams) while honouring Decision Driver #2 (parallelism for ≥2 contributors). Splitting #5 into #5a + #5b–#5e (per Architect A2) is what makes services and pg impls truly parallel — without that split, only one PR can touch the repository directory at a time. Adding #5e for RoomMember repository unblocks #8's membership checks per PLAN.md:62–75.

- **Consequences:**
  - **Parallelism gained:** in Phase 1b, up to 7 PRs (#5b, #5c, #5d, #5e, #6, #7, #8) can be in flight simultaneously, each blocked only on #5a.
  - **Freeze risk on `shared/types.ts`:** any post-Phase-0 change to the contract triggers downstream rebases; this is acceptable because the contract is small and reviewed by Architect before #1 merges.
  - **Freeze risk on repository interfaces:** similar to types — interfaces in #5a must be reviewed carefully because pg impls and services depend on them.
  - **Coordination cost in the first week:** Phase 0 + Phase 1a are serial; this is unavoidable but bounded.
  - **Schema migrations are themselves issues:** any addition beyond the v1 scope (`users`, `rooms`, `messages`, `room_members`) is a new issue with its own migration file — keeps PR scope bounded.
  - **No monorepo tooling complexity:** path-alias-only avoids `pnpm-workspace.yaml` churn.

- **Follow-ups (post-cutover hardening, NOT in v1):**
  - Rate limiting on `/auth/*` endpoints.
  - Refresh tokens (current spec is access-token-only).
  - Schema expansion for deferred entities: `Folder`, `Attachment`, `Friendship`, `Block`, `EmergencyContact`, `Mention`, `reply_to_id`.
  - Observability: structured logging + request IDs.
  - CI coverage threshold enforcement (the ≥80% in #6 is per-file aspirational; a CI-wide threshold is a separate issue).
