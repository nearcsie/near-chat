import { Hono } from 'hono';
import type { MessageChange } from '@shared/types';
import { z } from 'zod';
import { validate } from '../middlewares/validator';

interface SyncService {
  sync(userId: string, cursor: number, limit: number): Promise<{
    changes: MessageChange[];
    resyncRequired: boolean;
  }>;
}

const syncQuerySchema = z.object({
  cursor: z.preprocess(
    (value) => (value === undefined || value === '' ? 0 : Number(value)),
    z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  ),
  limit: z.preprocess(
    (value) => (value === undefined || value === '' ? 100 : Number(value)),
    z.number().int().min(1).max(500),
  ),
});

export const makeSyncRoutes = (service: SyncService) => {
  const app = new Hono();

  app.get('/', validate('query', syncQuerySchema), async (c) => {
    const query = c.req.valid('query') as { cursor: number; limit: number };
    const { changes, resyncRequired } = await service.sync(c.get('user').userId, query.cursor, query.limit);
    // Echoing the cursor back here would be indistinguishable from "caught
    // up", which is how a client with an outrun cursor ends up waiting on a
    // delta that can never arrive. Answer 0 instead: a client that ignores the
    // flag then over-fetches rather than silently skipping everything.
    if (resyncRequired) {
      return c.json({
        changes: [],
        nextCursor: 0,
        hasMore: false,
        resyncRequired: true,
      }, 200);
    }
    const nextCursor = changes.at(-1)?.changeSequence ?? query.cursor;
    return c.json({
      changes,
      nextCursor,
      hasMore: changes.length === query.limit,
    }, 200);
  });

  return app;
};
