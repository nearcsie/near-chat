import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { makeKeyService } from '../../../src/services/keyService';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../src/errors/AppError';
import type { IKeyRepository } from '../../../src/repositories/IKeyRepository';
import type { IRoomMemberRepository } from '../../../src/repositories/IRoomMemberRepository';
import type { IRoomRepository } from '../../../src/repositories/IRoomRepository';
import type { Room, RoomMember } from '../../../../shared/types';

const PUBLIC_KEY = 'A'.repeat(128);
const ENCRYPTED_KEY = 'B'.repeat(128);

describe('keyService', () => {
  let keyRepo: Mocked<IKeyRepository>;
  let roomRepo: Mocked<IRoomRepository>;
  let roomMemberRepo: Mocked<IRoomMemberRepository>;
  let keyService: ReturnType<typeof makeKeyService>;

  const room: Room = {
    roomId: 'room-1',
    type: 'group',
    name: 'Secret Room',
    requireApproval: false,
    viewHistory: true,
    isArchived: false,
    isReadonly: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const member: RoomMember = {
    roomId: 'room-1',
    userId: 'user-1',
    role: 'member',
    isMuted: false,
    joinTime: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    keyRepo = {
      getPublicKeyRow: vi.fn(),
      setPublicKey: vi.fn(),
      findRoomKey: vi.fn(),
      listMemberKeyStatus: vi.fn(),
      insertRoomKeys: vi.fn(),
    };
    roomRepo = {
      findById: vi.fn(),
      findByInviteCode: vi.fn(),
      findByMember: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as Mocked<IRoomRepository>;
    roomMemberRepo = {
      findMember: vi.fn(),
      findByRoom: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      resolveMentions: vi.fn(),
    } as unknown as Mocked<IRoomMemberRepository>;
    keyService = makeKeyService(keyRepo, roomRepo, roomMemberRepo);
  });

  describe('setMyPublicKey', () => {
    it('stores a valid base64 public key', async () => {
      keyRepo.setPublicKey.mockResolvedValue();

      const result = await keyService.setMyPublicKey('user-1', PUBLIC_KEY);

      expect(keyRepo.setPublicKey).toHaveBeenCalledWith('user-1', PUBLIC_KEY);
      expect(result).toEqual({ userId: 'user-1', publicKey: PUBLIC_KEY });
    });

    it('rejects keys that are not base64', async () => {
      await expect(keyService.setMyPublicKey('user-1', 'not base64 !!!')).rejects.toThrow(
        ValidationError,
      );
      expect(keyRepo.setPublicKey).not.toHaveBeenCalled();
    });

    it('rejects empty keys', async () => {
      await expect(keyService.setMyPublicKey('user-1', '')).rejects.toThrow(ValidationError);
      expect(keyRepo.setPublicKey).not.toHaveBeenCalled();
    });
  });

  describe('getPublicKey', () => {
    it('returns the public key of an existing user', async () => {
      keyRepo.getPublicKeyRow.mockResolvedValue({ publicKey: PUBLIC_KEY });

      const result = await keyService.getPublicKey('user-2');

      expect(result).toEqual({ userId: 'user-2', publicKey: PUBLIC_KEY });
    });

    it('returns null publicKey for users without a key', async () => {
      keyRepo.getPublicKeyRow.mockResolvedValue({ publicKey: null });

      const result = await keyService.getPublicKey('user-2');

      expect(result).toEqual({ userId: 'user-2', publicKey: null });
    });

    it('throws NotFoundError for missing users', async () => {
      keyRepo.getPublicKeyRow.mockResolvedValue(null);

      await expect(keyService.getPublicKey('ghost')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getMyRoomKey', () => {
    it('returns the wrapped room key for a member', async () => {
      roomRepo.findById.mockResolvedValue(room);
      roomMemberRepo.findMember.mockResolvedValue(member);
      keyRepo.findRoomKey.mockResolvedValue(ENCRYPTED_KEY);

      const result = await keyService.getMyRoomKey('user-1', 'room-1');

      expect(keyRepo.findRoomKey).toHaveBeenCalledWith('room-1', 'user-1');
      expect(result).toEqual({ roomId: 'room-1', userId: 'user-1', encryptedKey: ENCRYPTED_KEY });
    });

    it('throws NotFoundError when no key has been distributed yet', async () => {
      roomRepo.findById.mockResolvedValue(room);
      roomMemberRepo.findMember.mockResolvedValue(member);
      keyRepo.findRoomKey.mockResolvedValue(null);

      await expect(keyService.getMyRoomKey('user-1', 'room-1')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError for non-members', async () => {
      roomRepo.findById.mockResolvedValue(room);
      roomMemberRepo.findMember.mockResolvedValue(null);

      await expect(keyService.getMyRoomKey('user-9', 'room-1')).rejects.toThrow(ForbiddenError);
      expect(keyRepo.findRoomKey).not.toHaveBeenCalled();
    });

    it('throws NotFoundError for missing rooms', async () => {
      roomRepo.findById.mockResolvedValue(null);

      await expect(keyService.getMyRoomKey('user-1', 'missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listRoomKeyStatus', () => {
    it('returns member key status for a member', async () => {
      roomRepo.findById.mockResolvedValue(room);
      roomMemberRepo.findMember.mockResolvedValue(member);
      keyRepo.listMemberKeyStatus.mockResolvedValue([
        { userId: 'user-1', publicKey: PUBLIC_KEY, hasRoomKey: true },
        { userId: 'user-2', publicKey: PUBLIC_KEY, hasRoomKey: false },
      ]);

      const result = await keyService.listRoomKeyStatus('user-1', 'room-1');

      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({ userId: 'user-2', publicKey: PUBLIC_KEY, hasRoomKey: false });
    });

    it('rejects pending members', async () => {
      roomRepo.findById.mockResolvedValue(room);
      roomMemberRepo.findMember.mockResolvedValue({ ...member, role: 'pending' });

      await expect(keyService.listRoomKeyStatus('user-1', 'room-1')).rejects.toThrow(
        ForbiddenError,
      );
    });
  });

  describe('distributeRoomKeys', () => {
    it('inserts wrapped keys for room members and returns distributed user ids', async () => {
      roomRepo.findById.mockResolvedValue(room);
      roomMemberRepo.findMember.mockResolvedValue(member);
      keyRepo.listMemberKeyStatus.mockResolvedValue([
        { userId: 'user-1', publicKey: PUBLIC_KEY, hasRoomKey: false },
        { userId: 'user-2', publicKey: PUBLIC_KEY, hasRoomKey: false },
      ]);
      keyRepo.insertRoomKeys.mockResolvedValue(['user-1', 'user-2']);

      const result = await keyService.distributeRoomKeys('user-1', 'room-1', [
        { userId: 'user-1', encryptedKey: ENCRYPTED_KEY },
        { userId: 'user-2', encryptedKey: ENCRYPTED_KEY },
      ]);

      expect(keyRepo.insertRoomKeys).toHaveBeenCalledWith('room-1', [
        { userId: 'user-1', encryptedKey: ENCRYPTED_KEY },
        { userId: 'user-2', encryptedKey: ENCRYPTED_KEY },
      ]);
      expect(result).toEqual({ distributed: ['user-1', 'user-2'] });
    });

    it('rejects recipients that are not room members', async () => {
      roomRepo.findById.mockResolvedValue(room);
      roomMemberRepo.findMember.mockResolvedValue(member);
      keyRepo.listMemberKeyStatus.mockResolvedValue([
        { userId: 'user-1', publicKey: PUBLIC_KEY, hasRoomKey: false },
      ]);

      await expect(
        keyService.distributeRoomKeys('user-1', 'room-1', [
          { userId: 'outsider', encryptedKey: ENCRYPTED_KEY },
        ]),
      ).rejects.toThrow(ValidationError);
      expect(keyRepo.insertRoomKeys).not.toHaveBeenCalled();
    });

    it('rejects an empty key list', async () => {
      await expect(keyService.distributeRoomKeys('user-1', 'room-1', [])).rejects.toThrow(
        ValidationError,
      );
      expect(roomRepo.findById).not.toHaveBeenCalled();
    });

    it('rejects callers that are not members', async () => {
      roomRepo.findById.mockResolvedValue(room);
      roomMemberRepo.findMember.mockResolvedValue(null);

      await expect(
        keyService.distributeRoomKeys('user-9', 'room-1', [
          { userId: 'user-1', encryptedKey: ENCRYPTED_KEY },
        ]),
      ).rejects.toThrow(ForbiddenError);
      expect(keyRepo.insertRoomKeys).not.toHaveBeenCalled();
    });
  });
});
