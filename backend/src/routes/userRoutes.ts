import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import type { makeUserController } from '../controllers/userController';

export const makeUserRoutes = (ctrl: ReturnType<typeof makeUserController>): Router => {
  const router = Router();

  router.use(authMiddleware);

  router.get('/me', ctrl.getMe.bind(ctrl));
  router.patch('/me', ctrl.updateMe.bind(ctrl));
  router.get('/search', ctrl.search.bind(ctrl));

  return router;
};
