import { Router } from 'express';
import type { makeAuthController } from '../controllers/authController';

export const makeAuthRoutes = (ctrl: ReturnType<typeof makeAuthController>): Router => {
  const router = Router();

  router.post('/register', ctrl.register.bind(ctrl));
  router.post('/login', ctrl.login.bind(ctrl));
  // Logout only needs the refresh cookie; requiring a live access token would
  // block users whose access token already expired.
  router.post('/logout', ctrl.logout.bind(ctrl));
  router.post('/refresh', ctrl.refresh.bind(ctrl));

  return router;
};
