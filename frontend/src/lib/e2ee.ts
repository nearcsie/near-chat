/**
 * E2EE session manager: device keypair enrollment, room-key fetch/create/
 * distribute, and message encrypt/decrypt for the chat UI.
 *
 * The private key lives only in this browser's localStorage; the server
 * stores public keys and RSA-wrapped room keys, so the database only ever
 * sees ciphertext envelopes (`E2E.v1:...`).
 */

import {
  distributeRoomKeys,
  getMyRoomKey,
  listRoomKeyStatus,
  setMyPublicKey,
} from "./api";
import {
  decryptMessage,
  encryptMessage,
  exportPrivateKey,
  exportPublicKey,
  generateRoomKey,
  generateUserKeyPair,
  importPrivateKey,
  importPublicKey,
  isEncryptedEnvelope,
  unwrapRoomKey,
  wrapRoomKey,
} from "./crypto";

export const LOCKED_MESSAGE_PLACEHOLDER = "🔒 無法解密的訊息 (Unable to decrypt)";

const privateKeyStorageKey = (userId: string) => `e2ee:private-key:${userId}`;
const publicKeyStorageKey = (userId: string) => `e2ee:public-key:${userId}`;

interface E2eeIdentity {
  userId: string;
  privateKey: CryptoKey;
  publicKeyBase64: string;
}

let identity: E2eeIdentity | null = null;
const roomKeyCache = new Map<string, CryptoKey | null>();
const roomKeyRequests = new Map<string, Promise<CryptoKey | null>>();

export const resetE2ee = (): void => {
  identity = null;
  roomKeyCache.clear();
  roomKeyRequests.clear();
};

/**
 * Loads (or generates) this device's keypair and enrolls the public key on
 * the server. Must run after login, before messages are decrypted.
 */
export const initE2ee = async (token: string, userId: string): Promise<void> => {
  if (identity?.userId === userId) return;
  resetE2ee();

  let privateKeyBase64 = localStorage.getItem(privateKeyStorageKey(userId));
  let publicKeyBase64 = localStorage.getItem(publicKeyStorageKey(userId));

  if (!privateKeyBase64 || !publicKeyBase64) {
    const keyPair = await generateUserKeyPair();
    privateKeyBase64 = await exportPrivateKey(keyPair.privateKey);
    publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
    localStorage.setItem(privateKeyStorageKey(userId), privateKeyBase64);
    localStorage.setItem(publicKeyStorageKey(userId), publicKeyBase64);
  }

  // Idempotent enrollment; also re-claims the slot after a device reset.
  await setMyPublicKey(token, publicKeyBase64);

  identity = {
    userId,
    privateKey: await importPrivateKey(privateKeyBase64),
    publicKeyBase64,
  };
};

/** Wraps the room key for members that have enrolled but hold no key yet. */
const redistributeMissingKeys = async (
  token: string,
  roomId: string,
  roomKey: CryptoKey,
): Promise<void> => {
  const status = await listRoomKeyStatus(token, roomId);
  const missing = status.filter((member) => member.publicKey && !member.hasRoomKey);
  if (missing.length === 0) return;

  const keys = await Promise.all(
    missing.map(async (member) => ({
      userId: member.userId,
      encryptedKey: await wrapRoomKey(roomKey, await importPublicKey(member.publicKey!)),
    })),
  );
  await distributeRoomKeys(token, roomId, keys);
};

const fetchOrCreateRoomKey = async (
  token: string,
  roomId: string,
): Promise<CryptoKey | null> => {
  if (!identity) return null;

  try {
    const mine = await getMyRoomKey(token, roomId);
    const roomKey = await unwrapRoomKey(mine.encryptedKey, identity.privateKey);
    void redistributeMissingKeys(token, roomId, roomKey).catch(() => undefined);
    return roomKey;
  } catch {
    // No key distributed to us yet — fall through to create/wait below.
  }

  const status = await listRoomKeyStatus(token, roomId);
  const someoneHasKey = status.some((member) => member.hasRoomKey);
  if (someoneHasKey) {
    // The room key exists but was wrapped before we enrolled; another
    // member's client will redistribute it to us when they come online.
    return null;
  }

  // First enrolled member to open this room creates the key.
  const roomKey = await generateRoomKey();
  const recipients = status.filter((member) => member.publicKey);
  const keys = await Promise.all(
    recipients.map(async (member) => ({
      userId: member.userId,
      encryptedKey: await wrapRoomKey(roomKey, await importPublicKey(member.publicKey!)),
    })),
  );
  if (keys.length === 0) return null;
  await distributeRoomKeys(token, roomId, keys);

  // Two clients may race to create the key; the database keeps whichever
  // row landed first, so converge on the server's copy.
  const mine = await getMyRoomKey(token, roomId);
  return unwrapRoomKey(mine.encryptedKey, identity.privateKey);
};

/** Resolves the room key, deduplicating concurrent lookups per room. */
export const getRoomKey = async (token: string, roomId: string): Promise<CryptoKey | null> => {
  if (roomKeyCache.has(roomId)) {
    const cached = roomKeyCache.get(roomId) ?? null;
    if (cached) return cached;
  }

  const pending = roomKeyRequests.get(roomId);
  if (pending) return pending;

  const request = fetchOrCreateRoomKey(token, roomId)
    .then((key) => {
      roomKeyCache.set(roomId, key);
      return key;
    })
    .catch(() => null)
    .finally(() => {
      roomKeyRequests.delete(roomId);
    });

  roomKeyRequests.set(roomId, request);
  return request;
};

/**
 * Encrypts outgoing content. Falls back to plaintext when no room key is
 * available (e.g. legacy rooms where no member has enrolled yet).
 */
export const encryptForRoom = async (
  token: string,
  roomId: string,
  plaintext: string,
): Promise<string> => {
  const roomKey = await getRoomKey(token, roomId);
  if (!roomKey) return plaintext;
  return encryptMessage(roomKey, plaintext);
};

/**
 * Decrypts incoming content; plaintext (legacy) messages pass through and
 * undecryptable envelopes become a locked placeholder.
 */
export const decryptForRoom = async (
  token: string,
  roomId: string,
  content: string,
): Promise<string> => {
  if (!content || !isEncryptedEnvelope(content)) return content;

  const roomKey = await getRoomKey(token, roomId);
  if (!roomKey) return LOCKED_MESSAGE_PLACEHOLDER;

  try {
    return await decryptMessage(roomKey, content);
  } catch {
    return LOCKED_MESSAGE_PLACEHOLDER;
  }
};

export { isEncryptedEnvelope };
