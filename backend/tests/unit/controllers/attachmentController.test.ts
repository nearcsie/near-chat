import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeAttachmentController } from '../../../src/controllers/attachmentController';

describe('AttachmentController', () => {
  let mockService: any;
  let controller: any;
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    mockService = {
      uploadAttachment: vi.fn(),
      getAttachment: vi.fn(),
    };
    controller = makeAttachmentController(mockService);
    req = { body: {}, file: null, params: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      download: vi.fn(),
    };
    next = vi.fn();
  });

  describe('upload', () => {
    it('returns 400 if file is missing', async () => {
      req.user = { userId: 'user-1' };
      await controller.upload(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'file is required' });
      expect(mockService.uploadAttachment).not.toHaveBeenCalled();
    });

    it('calls uploadAttachment and returns 201 on success', async () => {
      req.user = { userId: 'user-1' };
      req.file = { path: '/tmp/file.png', mimetype: 'image/png', originalname: 'test.png' } as any;
      mockService.uploadAttachment.mockResolvedValue({ attachmentId: 'att-1', fileUrl: '/api/v1/attachments/att-1' });
      
      await controller.upload(req, res, next);
      
      expect(mockService.uploadAttachment).toHaveBeenCalledWith('user-1', req.file);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ attachmentId: 'att-1', fileUrl: '/api/v1/attachments/att-1' });
    });
  });
});
