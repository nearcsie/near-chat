import { Pool } from 'pg';

export class AttachmentRepository {
  constructor(private readonly pool: Pool) {}

  async create(data: { uploadedBy: string, filePath: string, fileType: string, originalName: string }): Promise<any> {
    const res = await this.pool.query(
      'INSERT INTO attachments (uploaded_by, file_path, file_type, original_name) VALUES ($1, $2, $3, $4) RETURNING *',
      [data.uploadedBy, data.filePath, data.fileType, data.originalName]
    );
    return res.rows[0];
  }

  async findById(attachmentId: string): Promise<any> {
    const res = await this.pool.query(
      'SELECT * FROM attachments WHERE attachment_id = $1',
      [attachmentId]
    );
    return res.rows[0] || null;
  }
}
