import type { RoomKeyMemberStatus } from '@shared/types';
import type { IKeyRepository } from '../repositories/IKeyRepository';
import type { IRoomMemberRepository } from '../repositories/IRoomMemberRepository';
import type { IRoomRepository } from '../repositories/IRoomRepository';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors/AppError';
import { distributeRoomKeysSchema, publicKeySchema } from '../validators/keySchemas';

const validationMessage = (issues: { message: string }[]) =>
  issues[0]?.message ?? 'Invalid key payload';

export const makeKeyService = (
  keyRepo: IKeyRepository,
  roomRepo: IRoomRepository,
  roomMemberRepo: IRoomMemberRepository,
) => {
  const assertRoomMembership = async (userId: string, roomId: string) => {
    const room = await roomRepo.findById(roomId);
    if (!room) {
      throw new NotFoundError('room', roomId);
    }

    const member = await roomMemberRepo.findMember(roomId, userId);
    if (!member) {
      throw new ForbiddenError('User is not a member of this room');
    }
    if (member.role === 'pending') {
      throw new ForbiddenError('Pending members cannot access room keys');
    }
  };

  return {
    async setMyPublicKey(
      userId: string,
      publicKey: string,
    ): Promise<{ userId: string; publicKey: string }> {
      const parsed = publicKeySchema.safeParse({ publicKey });
      if (!parsed.success) {
        throw new ValidationError(validationMessage(parsed.error.issues));
      }

      await keyRepo.setPublicKey(userId, parsed.data.publicKey);
      return { userId, publicKey: parsed.data.publicKey };
    },

    async getPublicKey(userId: string): Promise<{ userId: string; publicKey: string | null }> {
      const row = await keyRepo.getPublicKeyRow(userId);
      if (!row) {
        throw new NotFoundError('user', userId);
      }
      return { userId, publicKey: row.publicKey };
    },

    async getMyRoomKey(
      userId: string,
      roomId: string,
    ): Promise<{ roomId: string; userId: string; encryptedKey: string }> {
      await assertRoomMembership(userId, roomId);

      const encryptedKey = await keyRepo.findRoomKey(roomId, userId);
      if (!encryptedKey) {
        throw new NotFoundError('room key', roomId);
      }
      return { roomId, userId, encryptedKey };
    },

    async listRoomKeyStatus(userId: string, roomId: string): Promise<RoomKeyMemberStatus[]> {
      await assertRoomMembership(userId, roomId);
      return keyRepo.listMemberKeyStatus(roomId);
    },

    async distributeRoomKeys(
      userId: string,
      roomId: string,
      keys: { userId: string; encryptedKey: string }[],
    ): Promise<{ distributed: string[] }> {
      const parsed = distributeRoomKeysSchema.safeParse({ roomId, keys });
      if (!parsed.success) {
        throw new ValidationError(validationMessage(parsed.error.issues));
      }

      await assertRoomMembership(userId, parsed.data.roomId);

      const memberStatus = await keyRepo.listMemberKeyStatus(parsed.data.roomId);
      const memberIds = new Set(memberStatus.map((status) => status.userId));
      for (const entry of parsed.data.keys) {
        if (!memberIds.has(entry.userId)) {
          throw new ValidationError('All key recipients must be members of this room');
        }
      }

      const distributed = await keyRepo.insertRoomKeys(parsed.data.roomId, parsed.data.keys);
      return { distributed };
    },
  };
};
