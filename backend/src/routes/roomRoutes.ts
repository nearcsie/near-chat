import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import type { makeRoomController } from '../controllers/roomController';

export const makeRoomRoutes = (ctrl: ReturnType<typeof makeRoomController>): Router => {
  const router = Router();

  router.use(authMiddleware);

  router.get('/', ctrl.list.bind(ctrl));
  router.post('/', ctrl.create.bind(ctrl));
  router.get('/:id/members', ctrl.listMembers.bind(ctrl));
  router.post('/:id/members', ctrl.join.bind(ctrl));
  router.delete('/:id/members/me', ctrl.leave.bind(ctrl));
  router.delete('/:id/members/:userId', ctrl.kickMember.bind(ctrl));
  router.patch('/:id/members/:userId', ctrl.updateMember.bind(ctrl));
  router.get('/:id', ctrl.getById.bind(ctrl));
  router.patch('/:id', ctrl.update.bind(ctrl));
  router.delete('/:id', ctrl.archiveGroup.bind(ctrl));

  return router;
};
