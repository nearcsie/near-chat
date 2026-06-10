import { describe, it, expect } from 'vitest';
import { distributeRoomKeysSchema, publicKeySchema } from '../../../src/validators/keySchemas';

const BASE64_KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A+abc/123==';

describe('publicKeySchema', () => {
  it('accepts base64 material', () => {
    const result = publicKeySchema.safeParse({ publicKey: BASE64_KEY });
    expect(result.success).toBe(true);
  });

  it('rejects non-base64 characters', () => {
    expect(publicKeySchema.safeParse({ publicKey: 'hello world!' }).success).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(publicKeySchema.safeParse({ publicKey: '' }).success).toBe(false);
  });

  it('rejects oversized keys', () => {
    expect(publicKeySchema.safeParse({ publicKey: 'A'.repeat(9000) }).success).toBe(false);
  });
});

describe('distributeRoomKeysSchema', () => {
  it('accepts a list of wrapped keys', () => {
    const result = distributeRoomKeysSchema.safeParse({
      roomId: 'room-1',
      keys: [{ userId: 'user-1', encryptedKey: BASE64_KEY }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty key list', () => {
    expect(distributeRoomKeysSchema.safeParse({ roomId: 'room-1', keys: [] }).success).toBe(false);
  });

  it('rejects malformed encrypted keys', () => {
    const result = distributeRoomKeysSchema.safeParse({
      roomId: 'room-1',
      keys: [{ userId: 'user-1', encryptedKey: 'not base64 !!!' }],
    });
    expect(result.success).toBe(false);
  });
});
