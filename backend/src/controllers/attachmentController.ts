import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { NotFoundError, ValidationError } from '../errors/AppError';
import { ATTACHMENTS_UPLOAD_DIR } from '../lib/uploads';

const encodeDownloadFilename = (filename: string): string => {
  const asciiFallback = filename.replace(/[^\x20-\x7E]+/g, '_');
  const encoded = encodeURIComponent(filename)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A');

  return `attachment; filename="${asciiFallback || 'download'}"; filename*=UTF-8''${encoded}`;
};

export function makeAttachmentController(attachmentService: any) {
  return {
    upload: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const uploadedBy = req.user!.userId;
        if (!req.file) {
          throw new ValidationError('file is required');
        }
        const result = await attachmentService.uploadAttachment(uploadedBy, req.file);
        res.status(201).json(result);
      } catch (err: any) {
        next(err);
      }
    },
    download: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const attachmentId = String(req.params.id);
        const attachment = await attachmentService.getAttachment(attachmentId);
        if (!attachment) {
          throw new NotFoundError('attachment', attachmentId);
        }
        const filePath = path.isAbsolute(attachment.file_path)
          ? attachment.file_path
          : path.resolve(ATTACHMENTS_UPLOAD_DIR, path.basename(attachment.file_path));
        await fs.access(filePath);
        res.setHeader('Content-Disposition', encodeDownloadFilename(attachment.original_name));
        res.download(filePath, attachment.original_name);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          return next(new NotFoundError('attachment file', String(req.params.id)));
        }
        next(err);
      }
    }
  };
}
