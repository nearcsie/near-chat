import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import type { makeAuthController } from '../controllers/authController';

export const makeAuthRoutes = (ctrl: ReturnType<typeof makeAuthController>): Router => {
  const router = Router();

  router.post('/register', ctrl.register.bind(ctrl));
  router.post('/login', ctrl.login.bind(ctrl));
  router.post('/logout', authMiddleware, ctrl.logout.bind(ctrl));

  return router;
};
