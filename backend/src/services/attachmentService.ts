import { ValidationError } from '../errors/AppError';
import { AttachmentRepository } from '../repositories/attachmentRepository';
import type { Attachment } from '@shared/types';

const mapAttachment = (row: any): Attachment => ({
  attachmentId: row.attachment_id,
  messageId: row.message_id ?? undefined,
  uploadedBy: row.uploaded_by,
  fileUrl: `/api/v1/attachments/${row.attachment_id}`,
  fileType: row.file_type,
  originalName: row.original_name,
  uploadedAt: row.uploaded_at,
});

export function makeAttachmentService(attachmentRepo: AttachmentRepository) {
  return {
    async uploadAttachment(uploadedBy: string, file: Express.Multer.File) {
      if (!uploadedBy) {
        throw new ValidationError('uploadedBy is required');
      }
      if (!file) {
        throw new ValidationError('file is required');
      }
      const attachment = await attachmentRepo.create({
        uploadedBy,
        filePath: file.path,
        fileType: file.mimetype,
        originalName: file.originalname,
      });
      return mapAttachment(attachment);
    },
    async getAttachment(attachmentId: string) {
      const attachment = await attachmentRepo.findById(attachmentId);
      if (!attachment) {
        return null;
      }
      return attachment;
    }
  };
}
