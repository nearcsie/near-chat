import { Request, Response, NextFunction } from 'express';
import path from 'path';

export function makeAttachmentController(attachmentService: any) {
  return {
    upload: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const uploadedBy = req.user!.userId;
        if (!req.file) {
          return res.status(400).json({ error: 'file is required' });
        }
        const result = await attachmentService.uploadAttachment(uploadedBy, req.file);
        res.status(201).json(result);
      } catch (err: any) {
        next(err);
      }
    },
    download: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const attachmentId = req.params.id;
        const attachment = await attachmentService.getAttachment(attachmentId);
        if (!attachment) {
          return res.status(404).json({ error: 'Attachment not found' });
        }
        res.download(path.resolve(attachment.file_path), attachment.original_name);
      } catch (err) {
        next(err);
      }
    }
  };
}
