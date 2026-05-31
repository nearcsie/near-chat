import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/authMiddleware';

const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/zip'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'));
    }
    
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.zip'];
    const extension = file.originalname.toLowerCase().match(/\\.[^.]+$/)?.[0];
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
