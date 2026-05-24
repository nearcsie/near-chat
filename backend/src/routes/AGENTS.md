<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-22 | Updated: 2026-05-24 -->

# routes

## Purpose
Express Router handlers defining the REST API surface for User, Room, and Message resources. Each file is responsible solely for HTTP concerns: parsing request params/body, input validation, delegating to the service layer, and setting the correct HTTP response status codes. No database logic lives here.

## Key Files

| File | Description |
|------|-------------|
| `userRoutes.ts` | Full CRUD for `User` — `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id`; delegates to `userService` |
| `roomRoutes.ts` | Full CRUD for `Room` — `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id`; delegates to `roomService` |
| `messageRoutes.ts` | Message operations scoped to a room — `GET /:roomId/messages`, `GET /:roomId/messages/:messageId`, `POST /:roomId/messages`, `PATCH /:roomId/messages/:messageId`, `DELETE /:roomId/messages/:messageId`; delegates to `messageService` |

## For AI Agents

### Working In This Directory
- These routers are **not yet mounted** in `src/index.ts`. To activate them, add to `index.ts`:
  ```ts
  import userRouter from './routes/userRoutes';
  import roomRouter from './routes/roomRoutes';
  import messageRouter from './routes/messageRoutes';

  app.use('/api/users', userRouter);
  app.use('/api/rooms', roomRouter);
  app.use('/api/rooms', messageRouter); // messageRoutes uses /:roomId/messages prefix
  ```
- `messageRoutes.ts` has a placeholder auth pattern (`(req as any).user || { userId: 1 }`) — replace with real JWT middleware before production use.
- All ID params are parsed with `parseInt` and validated with `isNaN` before being passed to services.

### Testing Requirements
- Route-level HTTP tests are not yet written; current tests in `backend/tests/` test the service layer directly.
- To test routes via HTTP, mount them in `index.ts` and use a tool like `curl` or write Supertest/Vitest HTTP tests.

### Common Patterns
- Route → Service → Prisma is the strict call chain; routes never import `PrismaClient` directly.
- Error messages from the service layer are inspected with `.includes(keyword)` to map to appropriate HTTP status codes (400, 404, 500).
- `res.status(204).send()` for successful DELETE — no body.

## Dependencies

### Internal
- `../services/userService` — called by `userRoutes.ts`
- `../services/roomService` — called by `roomRoutes.ts`
- `../services/messageService` — called by `messageRoutes.ts`

### External
- `express` — `Router`, `Request`, `Response` types

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
