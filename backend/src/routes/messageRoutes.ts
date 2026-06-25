import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import type { makeMessageController } from '../controllers/messageController';

export const makeMessageRoutes = (ctrl: ReturnType<typeof makeMessageController>): Router => {
  const router = Router();

  router.use(authMiddleware);

  router.get('/:roomId/messages', ctrl.listForRoom.bind(ctrl));
  router.patch('/:roomId/messages/:messageId', ctrl.update.bind(ctrl));

  return router;
};
