import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeAttachmentService } from '../../../src/services/attachmentService';

describe('AttachmentService', () => {
  let attachmentRepo: { create: ReturnType<typeof vi.fn>; findById: ReturnType<typeof vi.fn> };
  let service: ReturnType<typeof makeAttachmentService>;

  beforeEach(() => {
    attachmentRepo = {
      create: vi.fn(),
      findById: vi.fn(),
    };
    service = makeAttachmentService(attachmentRepo as any);
  });

  it('normalizes mojibake original filenames before persisting', async () => {
    attachmentRepo.create.mockResolvedValue({
      attachment_id: 'att-1',
      uploaded_by: 'user-1',
      file_type: 'application/pdf',
      original_name: '運算思維與程式設計平台 多個頁點.pdf',
      uploaded_at: new Date('2026-01-01T00:00:00.000Z'),
    });

    await service.uploadAttachment('user-1', {
      path: '/tmp/file.pdf',
      mimetype: 'application/pdf',
      originalname: 'éç®æç¶­èç¨å¼è¨­è¨å¹³å° å¤åé é».pdf',
    } as Express.Multer.File);

    expect(attachmentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        originalName: '運算思維與程式設計平台 多個頁點.pdf',
      }),
    );
  });
});
