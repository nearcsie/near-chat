import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/authMiddleware';

const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit to prevent DoS
  }
});

export function makeAttachmentRoutes(attachmentController: any) {
  const router = Router();
  router.post('/', authMiddleware, upload.single('file'), attachmentController.upload);
  router.get('/:id', authMiddleware, attachmentController.download);
  return router;
}
