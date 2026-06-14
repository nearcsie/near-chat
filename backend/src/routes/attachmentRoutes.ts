import { Router } from 'express';
import multer from 'multer';
import { ValidationError } from '../errors/AppError';
import { authMiddleware } from '../middlewares/authMiddleware';
import { attachmentUploadConfig } from '../lib/attachmentUploadConfig';
import { ATTACHMENTS_UPLOAD_DIR, ensureUploadDirectories } from '../lib/uploads';

ensureUploadDirectories();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, ATTACHMENTS_UPLOAD_DIR);
    },
  }),
  limits: {
    fileSize: attachmentUploadConfig.maxBytes,
  },
  fileFilter: (_req, file, cb) => {
    if (!attachmentUploadConfig.restrictionEnabled) {
      return cb(null, true);
    }

    const mimeType = file.mimetype.toLowerCase();
    if (!attachmentUploadConfig.allowedMimeTypes.includes(mimeType)) {
      return cb(new ValidationError(`Attachment MIME type is not allowed: ${file.mimetype}`));
    }

    const extension = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (!extension || !attachmentUploadConfig.allowedExtensions.includes(extension)) {
      return cb(new ValidationError(`Attachment file extension is not allowed: ${extension ?? 'unknown'}`));
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
