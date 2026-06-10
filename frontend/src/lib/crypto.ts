/**
 * Low-level Web Crypto helpers for E2E encryption.
 *
 * Scheme:
 *   - Per-user RSA-OAEP-2048 keypair; the public key (SPKI, base64) lives on
 *     the server, the private key (PKCS8, base64) never leaves this device.
 *   - Per-room AES-256-GCM key, wrapped with each member's public key.
 *   - Message envelope: `E2E.v1:<ivBase64>:<cipherBase64>`.
 */

/**
 * Kept in sync with `E2EE_ENVELOPE_PREFIX` in shared/types.ts (declared
 * locally so the Next.js bundle has no runtime import from outside the app).
 */
export const E2EE_ENVELOPE_PREFIX = "E2E.v1:";

const RSA_PARAMS: RsaHashedKeyGenParams = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
  hash: "SHA-256",
};

const AES_PARAMS: AesKeyGenParams = { name: "AES-GCM", length: 256 };
const GCM_IV_BYTES = 12;

const subtle = (): SubtleCrypto => globalThis.crypto.subtle;

export const toBase64 = (data: ArrayBuffer | Uint8Array): string => {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

export const fromBase64 = (value: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const generateUserKeyPair = (): Promise<CryptoKeyPair> =>
  subtle().generateKey(RSA_PARAMS, true, ["encrypt", "decrypt"]) as Promise<CryptoKeyPair>;

export const exportPublicKey = async (key: CryptoKey): Promise<string> =>
  toBase64(await subtle().exportKey("spki", key));

export const exportPrivateKey = async (key: CryptoKey): Promise<string> =>
  toBase64(await subtle().exportKey("pkcs8", key));

export const importPublicKey = (spkiBase64: string): Promise<CryptoKey> =>
  subtle().importKey("spki", fromBase64(spkiBase64).buffer as ArrayBuffer, RSA_PARAMS, true, [
    "encrypt",
  ]);

export const importPrivateKey = (pkcs8Base64: string): Promise<CryptoKey> =>
  subtle().importKey("pkcs8", fromBase64(pkcs8Base64).buffer as ArrayBuffer, RSA_PARAMS, true, [
    "decrypt",
  ]);

export const generateRoomKey = (): Promise<CryptoKey> =>
  subtle().generateKey(AES_PARAMS, true, ["encrypt", "decrypt"]) as Promise<CryptoKey>;

/** Wraps the room AES key with a member's RSA public key. */
export const wrapRoomKey = async (roomKey: CryptoKey, publicKey: CryptoKey): Promise<string> => {
  const raw = await subtle().exportKey("raw", roomKey);
  const wrapped = await subtle().encrypt({ name: "RSA-OAEP" }, publicKey, raw);
  return toBase64(wrapped);
};

/** Unwraps a room key previously wrapped with our public key. */
export const unwrapRoomKey = async (
  wrappedBase64: string,
  privateKey: CryptoKey,
): Promise<CryptoKey> => {
  const raw = await subtle().decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    fromBase64(wrappedBase64).buffer as ArrayBuffer,
  );
  return subtle().importKey("raw", raw, AES_PARAMS, true, ["encrypt", "decrypt"]);
};

export const isEncryptedEnvelope = (content: string): boolean =>
  content.startsWith(E2EE_ENVELOPE_PREFIX);

export const encryptMessage = async (roomKey: CryptoKey, plaintext: string): Promise<string> => {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES));
  const ciphertext = await subtle().encrypt(
    { name: "AES-GCM", iv },
    roomKey,
    new TextEncoder().encode(plaintext),
  );
  return `${E2EE_ENVELOPE_PREFIX}${toBase64(iv)}:${toBase64(ciphertext)}`;
};

/** Throws when the envelope is malformed or the key does not match. */
export const decryptMessage = async (roomKey: CryptoKey, envelope: string): Promise<string> => {
  if (!isEncryptedEnvelope(envelope)) {
    return envelope;
  }

  const parts = envelope.slice(E2EE_ENVELOPE_PREFIX.length).split(":");
  if (parts.length !== 2) {
    throw new Error("Malformed E2EE envelope");
  }

  const plaintext = await subtle().decrypt(
    { name: "AES-GCM", iv: fromBase64(parts[0]) },
    roomKey,
    fromBase64(parts[1]).buffer as ArrayBuffer,
  );
  return new TextDecoder().decode(plaintext);
};
