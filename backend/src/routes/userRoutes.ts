import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import type { makeUserController } from '../controllers/userController';

export const makeUserRoutes = (ctrl: ReturnType<typeof makeUserController>): Router => {
  const router = Router();

  router.use(authMiddleware);

  router.get('/me', ctrl.getMe.bind(ctrl));
  router.patch('/me', ctrl.updateMe.bind(ctrl));
  router.delete('/me', ctrl.deleteMe.bind(ctrl));
  router.get('/search', ctrl.search.bind(ctrl));
  router.get('/me/emergency-contacts', ctrl.getEmergencyContacts.bind(ctrl));
  router.post('/me/emergency-contacts', ctrl.addEmergencyContact.bind(ctrl));
  router.delete('/me/emergency-contacts/:contactId', ctrl.deleteEmergencyContact.bind(ctrl));
  router.post('/me/emergency-alert', ctrl.triggerEmergencyAlert.bind(ctrl));
  router.post('/me/emergency-alert/check-inactivity', ctrl.checkEmergencyInactivity.bind(ctrl));

  return router;
};
