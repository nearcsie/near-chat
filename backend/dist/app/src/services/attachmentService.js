"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeAttachmentService = makeAttachmentService;
function makeAttachmentService(attachmentRepo) {
    return {
        async uploadAttachment(messageId, file) {
            if (!messageId) {
                throw new Error('Message ID is required');
            }
            if (!file) {
                throw new Error('File is required');
            }
            const attachment = await attachmentRepo.create({
                messageId,
                filePath: file.path,
                fileType: file.mimetype,
                originalName: file.originalname,
            });
            return {
                attachmentId: attachment.attachment_id,
                fileUrl: `/api/v1/attachments/${attachment.attachment_id}`,
            };
        },
        async getAttachment(attachmentId) {
            const attachment = await attachmentRepo.findById(attachmentId);
            if (!attachment) {
                return null;
            }
            return attachment;
        }
    };
}
