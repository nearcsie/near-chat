"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentRepository = void 0;
class AttachmentRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async create(data) {
        const res = await this.pool.query('INSERT INTO attachments (message_id, file_path, file_type, original_name) VALUES ($1, $2, $3, $4) RETURNING *', [data.messageId, data.filePath, data.fileType, data.originalName]);
        return res.rows[0];
    }
    async findById(attachmentId) {
        const res = await this.pool.query('SELECT * FROM attachments WHERE attachment_id = $1', [attachmentId]);
        return res.rows[0] || null;
    }
}
exports.AttachmentRepository = AttachmentRepository;
