# Backend Issue Status

Last updated: 2026-05-30

Source of truth reviewed:
- `.omc/plans/tdd-api-first-issue-breakdown.md`
- GitHub issues #17 and #18
- current backend source tree on branch `feat/issues-17-18-realtime-cutover`

Status legend:
- Complete: implemented and has a reasonable local verification path.
- Partial: useful work exists, but at least one acceptance criterion or planned method is still missing.
- Not started: no dedicated implementation found yet.

| Issue | Title | Status | Evidence / Notes |
| --- | --- | --- | --- |
| #0 | Quarantine broken Prisma files | Complete | No active Prisma-backed service/route/test files remain in the planned layer paths. |
| #1 | Shared API contract (`shared/types.ts`) | Partial | `shared/types.ts` and path alias config exist. `shared/types.assert.ts` is not present, and the implemented contract uses string UUID IDs while the original issue text mentions numeric IDs. |
| #2 | Test infrastructure | Partial | Vitest config, integration config, test DB helper, reset helper, and `docker-compose.test.yml` exist. Current `test:integration` does not start the test DB automatically; `test:db:up` is separate. |
| #3 | Error model + global error middleware | Complete | `AppError` subclasses, `errorHandler`, and middleware tests exist. |
| #4 | Auth middleware + JWT helper | Complete | `auth/jwt.ts`, `authMiddleware.ts`, Express request typing, and auth middleware tests exist. |
| #5a | Repository interfaces + migration | Complete | Repository interfaces and initial migration exist. Actual table name is `chat_rooms`, while the planning text sometimes says `rooms`. |
| #5b | userRepository (pg) + integration test | Complete | `userRepository.ts` and repository tests exist. |
| #5c | roomRepository (pg) + integration test | Complete | `roomRepository.ts` and integration tests exist. |
| #5d | messageRepository (pg) + integration test | Complete | `messageRepository.ts` and integration tests exist. `findByRoom`, `create`, and `markRecalled` return `MessageWithSender` via `LEFT JOIN users`. |
| #5e | roomMemberRepository (pg) + integration test | Complete | `roomMemberRepository.ts` and integration tests exist. |
| #6 | User Service + auth flows | Partial | `userService.ts`, `userSchemas.ts`, and service tests exist for register/login. Planned `getById`, `list`, `update`, and `delete` service methods are still missing. |
| #7 | Room Service | Complete | Implemented in this branch: `roomService.ts`, `roomSchemas.ts`, and mocked service tests. |
| #8 | Message Service | Complete | Implemented in this branch: `messageService.ts`, `messageSchemas.ts`, and mocked service tests for send/list/recall with room-membership checks. Sender enrichment now comes from `IMessageRepository`, keeping SQL and joins below the service layer. |
| #9 | User Controller + Routes (+ auth routes) | Complete | `authController.ts`, `userController.ts`, `authRoutes.ts`, and `userRoutes.ts` exist and are mounted under `/api/v1`. |
| #10 | Room Controller + Routes | Complete | `roomController.ts` and `roomRoutes.ts` exist and are mounted under `/api/v1`. |
| #11 | Message Controller + Routes | Complete | `messageController.ts` and `messageRoutes.ts` exist for `/rooms/:roomId/messages` and are mounted under `/api/v1`. |
| #12 | Socket.IO extraction to messageService | Complete | `realtime/authSocket.ts` reuses `verifyToken`; `realtime/socketServer.ts` handles all six typed client events and emits typed `ApiError` payloads. |
| #13 | Cutover: rewire `index.ts` | Complete | `index.ts` is a composition root with repo/service/controller/router wiring, `/api/v1` route mounts, error middleware, and `attachSockets`. No inline REST handlers or direct JWT verification remain. |
| #14 | Frontend consumes `@shared/types` | Not started | No `frontend/lib/api.ts` typed wrapper found yet. |

Recommended next issues after this branch:
- Finish #6 CRUD service methods so #9 has a complete user service to call.
- Then implement #9/#10/#11 controllers and routes before cutting over `index.ts`.
