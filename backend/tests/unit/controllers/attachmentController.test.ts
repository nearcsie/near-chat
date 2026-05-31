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
    it('returns 400 if messageId is missing', async () => {
      req.file = { path: '/tmp/file.png', mimetype: 'image/png', originalname: 'test.png' } as any;
      await controller.upload(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'messageId is required' });
      expect(mockService.uploadAttachment).not.toHaveBeenCalled();
    });

    it('returns 400 if file is missing', async () => {
      req.body = { messageId: 'msg-123' };
      await controller.upload(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'file is required' });
      expect(mockService.uploadAttachment).not.toHaveBeenCalled();
    });
  });
});
