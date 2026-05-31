import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/authMiddleware';

const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log("FILE UPLOADED:", file);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/zip', 'text/plain', 'application/octet-stream'];
    if (!allowedTypes.includes(file.mimetype)) {
      console.log("REJECTED BY MIMETYPE", file.mimetype);
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
