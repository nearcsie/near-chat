import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../src/errors/AppError';
import { assertValidAvatarUpload } from '../../../src/lib/avatarUpload';

const makeFile = (mimetype: string, bytes: number[]): Express.Multer.File =>
  ({
    fieldname: 'file',
    originalname: 'avatar',
    encoding: '7bit',
    mimetype,
    size: bytes.length,
    buffer: Buffer.from(bytes),
  }) as Express.Multer.File;

describe('avatarUpload helpers', () => {
  it('accepts matching png content', () => {
    const extension = assertValidAvatarUpload(
      makeFile('image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );

    expect(extension).toBe('.png');
  });

  it('rejects unsupported mimetypes', () => {
    expect(() =>
      assertValidAvatarUpload(makeFile('image/svg+xml', [0x3c, 0x73, 0x76, 0x67])),
    ).toThrow(ValidationError);
  });

  it('rejects mismatched content signatures', () => {
    expect(() =>
      assertValidAvatarUpload(makeFile('image/png', [0xff, 0xd8, 0xff, 0xe0])),
    ).toThrow(ValidationError);
  });
});
