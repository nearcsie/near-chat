import type { RoomKeyMemberStatus } from '@shared/types';

export interface IKeyRepository {
  /** Returns null when the user does not exist; publicKey null when not set. */
  getPublicKeyRow(userId: string): Promise<{ publicKey: string | null } | null>;
  setPublicKey(userId: string, publicKey: string): Promise<void>;
  /** The caller's wrapped room key, or null when none has been distributed. */
  findRoomKey(roomId: string, userId: string): Promise<string | null>;
  /** Key/public-key status for every member of the room. */
  listMemberKeyStatus(roomId: string): Promise<RoomKeyMemberStatus[]>;
  /**
   * Inserts wrapped keys, skipping members that already hold one
   * (existing keys are never overwritten). Returns the user ids inserted.
   */
  insertRoomKeys(
    roomId: string,
    entries: { userId: string; encryptedKey: string }[],
  ): Promise<string[]>;
}
