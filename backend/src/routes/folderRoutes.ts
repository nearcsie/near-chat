import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import type { makeFolderController } from '../controllers/folderController';

export const makeFolderRoutes = (ctrl: ReturnType<typeof makeFolderController>): Router => {
  const router = Router();
  router.use(authMiddleware);
  router.get('/', ctrl.list.bind(ctrl));
  router.post('/', ctrl.create.bind(ctrl));
  router.delete('/:id', ctrl.remove.bind(ctrl));
  router.put('/:id/rooms', ctrl.updateRooms.bind(ctrl));
  return router;
};
