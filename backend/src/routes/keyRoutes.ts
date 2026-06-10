import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import type { makeKeyController } from '../controllers/keyController';

/**
 * E2EE key exchange routes, mounted at /api/v1.
 * Paths are spelled out in full to avoid clashing with userRoutes/roomRoutes.
 */
export const makeKeyRoutes = (ctrl: ReturnType<typeof makeKeyController>): Router => {
  const router = Router();

  router.use(authMiddleware);

  router.put('/users/me/public-key', ctrl.setMyPublicKey.bind(ctrl));
  router.get('/users/:id/public-key', ctrl.getPublicKey.bind(ctrl));
  router.get('/rooms/:id/keys/me', ctrl.getMyRoomKey.bind(ctrl));
  router.get('/rooms/:id/keys', ctrl.listRoomKeyStatus.bind(ctrl));
  router.post('/rooms/:id/keys', ctrl.distributeRoomKeys.bind(ctrl));

  return router;
};
