import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import type { makeFriendController } from '../controllers/friendController';

export const makeFriendRoutes = (ctrl: ReturnType<typeof makeFriendController>): Router => {
  const router = Router();

  router.use(authMiddleware);

  // Friend Requests
  router.get('/requests', ctrl.getRequests.bind(ctrl));
  router.post('/requests', ctrl.sendRequest.bind(ctrl));
  router.patch('/requests/:id', ctrl.respondRequest.bind(ctrl));

  // Friends List
  router.get('/', ctrl.getFriends.bind(ctrl));
  router.delete('/:id', ctrl.removeFriend.bind(ctrl));

  return router;
};

export const makeBlockRoutes = (ctrl: ReturnType<typeof makeFriendController>): Router => {
  const router = Router();

  router.use(authMiddleware);

  router.post('/', ctrl.blockUser.bind(ctrl));
  router.delete('/:id', ctrl.unblockUser.bind(ctrl));

  return router;
};
