import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import type { makeRoomController } from '../controllers/roomController';

export const makeRoomRoutes = (ctrl: ReturnType<typeof makeRoomController>): Router => {
  const router = Router();

  router.use(authMiddleware);

  router.get('/', ctrl.list.bind(ctrl));
  router.post('/group', ctrl.createGroup.bind(ctrl));
  router.post('/join/:code', ctrl.joinByCode.bind(ctrl));
  router.get('/:id', ctrl.getById.bind(ctrl));
  router.patch('/:id', ctrl.update.bind(ctrl));
  router.patch('/:id/members/:userId/approve', ctrl.approveMember.bind(ctrl));
  router.patch('/:id/members/:userId', ctrl.updateMember.bind(ctrl));
  router.delete('/:id/members/:userId', ctrl.kickMember.bind(ctrl));
  router.delete('/:id/leave', ctrl.leave.bind(ctrl));

  return router;
};
