import type { Attachment } from '@shared/types';
import type { UploadedFile } from '../utils/fileUpload';
import type { StorageDriver } from '../utils/storageService';
import { Hono } from 'hono';
import { NotFoundError } from '../utils/AppError';
import { authMiddleware } from '../middlewares/authMiddleware';
import { attachmentUploadConfig } from '../utils/attachmentUploadConfig';
import { ensureUploadDirectories } from '../utils/uploads';
import { parseSingleFile } from '../utils/fileUpload';
import { defaultAttachmentStorage } from '../utils/storageService';
import { toPublicAttachment } from '../models/attachmentRepository';

ensureUploadDirectories();

const encodeDownloadFilename = (filename: string): string => {
  const asciiFallback = filename.replace(/[^\x20-\x7E]+/g, '_');
  const encoded = encodeURIComponent(filename)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A');

  return `attachment; filename="${asciiFallback || 'download'}"; filename*=UTF-8''${encoded}`;
};

export interface AttachmentService {
  uploadAttachment(userId: string, file: UploadedFile): Promise<Attachment>;
  getAttachment(userId: string, attachmentId: string): Promise<(Attachment & { filePath?: string; file_path?: string; original_name?: string; mime_type?: string }) | null>;
}

export const makeAttachmentRoutes = (
  service: AttachmentService,
  storage: StorageDriver = defaultAttachmentStorage,
) => {
  const app = new Hono();
  app.use('*', authMiddleware);

  app.post('/', async (c) => {
    const userId = c.get('user').userId;
    const file = await parseSingleFile(c, {
      fieldName: 'file',
      maxBytes: attachmentUploadConfig.maxBytes,
      restrictionEnabled: attachmentUploadConfig.restrictionEnabled,
      allowedMimeTypes: attachmentUploadConfig.allowedMimeTypes,
      allowedExtensions: attachmentUploadConfig.allowedExtensions,
    });
    const result = await service.uploadAttachment(userId, file);
    return c.json(result, 201);
  });

  app.get('/:id', async (c) => {
    const userId = c.get('user').userId;
    const attachmentId = c.req.param('id');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attachmentId);
    if (!isUuid) {
      throw new NotFoundError('attachment', attachmentId);
    }
    const attachment = await service.getAttachment(userId, attachmentId);
    if (!attachment) {
      throw new NotFoundError('attachment', attachmentId);
    }

    const accept = c.req.header('accept') || '';
    if (accept.includes('application/json')) {
      return c.json(toPublicAttachment(attachment), 200);
    }

    const rawPath = attachment.filePath || attachment.file_path;
    if (!rawPath) {
      // The record exists but has no stored file, so there is nothing to stream.
      throw new NotFoundError('attachment', attachmentId);
    }

    const originalName = attachment.originalName || attachment.original_name || 'download';
    const mimeType = attachment.fileType || attachment.mime_type || 'application/octet-stream';

    const file = await storage.open(rawPath);
    if (!file) {
      // Stored object is gone (lost volume, manual deletion). Answering with
      // metadata and a 200 would make download clients treat JSON as the file.
      // Only a genuinely absent object lands here: the driver throws on a
      // permission or connection failure rather than reporting it as missing.
      throw new NotFoundError('attachment', attachmentId);
    }

    return new Response(file, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': encodeDownloadFilename(originalName),
      },
    });
  });

  return app;
};
