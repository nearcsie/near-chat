import { z } from 'zod';

const idSchema = z.string().trim().min(1, 'Id cannot be empty');

/** Base64 key material (SPKI public key or RSA-wrapped AES key). */
const keyMaterialSchema = z
  .string()
  .trim()
  .min(1, 'Key material cannot be empty')
  .max(8192, 'Key material is too large')
  .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Key material must be base64');

export const publicKeySchema = z.object({
  publicKey: keyMaterialSchema,
});

export const distributeRoomKeysSchema = z.object({
  roomId: idSchema,
  keys: z
    .array(
      z.object({
        userId: idSchema,
        encryptedKey: keyMaterialSchema,
      }),
    )
    .min(1, 'At least one key is required')
    .max(100, 'Too many keys in one request'),
});
