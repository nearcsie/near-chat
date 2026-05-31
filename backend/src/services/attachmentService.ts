import { ValidationError } from '../errors/AppError';
import { AttachmentRepository } from '../repositories/attachmentRepository';

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
      return {
        attachmentId: attachment.attachment_id,
        fileUrl: `/api/v1/attachments/${attachment.attachment_id}`,
      };
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
