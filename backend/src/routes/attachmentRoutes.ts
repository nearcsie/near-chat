import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/authMiddleware';
import { ATTACHMENTS_UPLOAD_DIR, ensureUploadDirectories } from '../lib/uploads';

ensureUploadDirectories();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, ATTACHMENTS_UPLOAD_DIR);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/zip', 'text/plain', 'application/octet-stream'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type: ' + file.mimetype));
    }
    
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.zip', '.txt'];
    const extension = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (!extension || !allowedExtensions.includes(extension)) {
      return cb(new Error('Invalid file extension'));
    }
    
    cb(null, true);
  }
});

export function makeAttachmentRoutes(attachmentController: any) {
  const router = Router();
  router.post('/', authMiddleware, upload.single('file'), attachmentController.upload);
  router.get('/:id', authMiddleware, attachmentController.download);
  return router;
}
