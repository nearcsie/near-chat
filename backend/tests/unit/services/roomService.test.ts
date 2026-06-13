import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { makeRoomService } from '../../../src/services/roomService';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../src/errors/AppError';
import type { IRoomRepository } from '../../../src/repositories/IRoomRepository';
import type { IRoomMemberRepository } from '../../../src/repositories/IRoomMemberRepository';
import type { Room, RoomMember } from '../../../../shared/types';

describe('roomService', () => {
  let mockRepo: Mocked<IRoomRepository>;
  let mockMemberRepo: Mocked<IRoomMemberRepository>;
  let roomService: ReturnType<typeof makeRoomService>;

  const room: Room = {
    roomId: 'room-1',
    type: 'group',
    name: 'Study Room',
    requireApproval: false,
    viewHistory: true,
    isArchived: false,
    isReadonly: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const ownerMember: RoomMember = {
    roomId: 'room-1',
    userId: 'user-1',
    role: 'owner',
    isMuted: false,
    joinTime: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findByInviteCode: vi.fn(),
      findPrivateRoomByMembers: vi.fn(),
      findByMember: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    mockMemberRepo = {
      findMember: vi.fn(),
      findByRoom: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      resolveMentions: vi.fn(),
    };
    roomService = makeRoomService(mockRepo, mockMemberRepo);
  });

  it('create validates input, trims name, and applies defaults', async () => {
    mockRepo.create.mockResolvedValue(room);
    mockMemberRepo.add.mockResolvedValue(ownerMember);

    const result = await roomService.create('user-1', { name: '  Study Room  ' });

    expect(mockRepo.create).toHaveBeenCalledWith({
      type: 'group',
      name: 'Study Room',
      inviteCode: expect.any(String),
      requireApproval: false,
      viewHistory: true,
    });
    expect(mockMemberRepo.add).toHaveBeenCalledWith({ roomId: room.roomId, userId: 'user-1', role: 'owner' });
    expect(result).toBe(room);
  });

  it('create rejects empty room names', async () => {
    await expect(roomService.create('user-1', { name: '   ' })).rejects.toThrow(ValidationError);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('getById returns the room or throws NotFoundError', async () => {
    mockRepo.findById.mockResolvedValueOnce(room);
    mockMemberRepo.findMember.mockResolvedValueOnce(ownerMember);
    await expect(roomService.getById('room-1', 'user-1')).resolves.toBe(room);

    mockRepo.findById.mockResolvedValueOnce(null);
    await expect(roomService.getById('missing-room', 'user-1')).rejects.toThrow(NotFoundError);
  });

  it('list returns rooms for a member', async () => {
    mockRepo.findByMember.mockResolvedValue([room]);

    const result = await roomService.list('user-1');

    expect(mockRepo.findByMember).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([room]);
  });

  it('update validates payload and throws NotFoundError for missing rooms', async () => {
    const updated = { ...room, name: 'Updated Room' };
    mockRepo.findById.mockResolvedValueOnce(room);
    mockMemberRepo.findMember.mockResolvedValueOnce(ownerMember);
    mockRepo.update.mockResolvedValue(updated);

    await expect(roomService.update('room-1', 'user-1', { name: ' Updated Room ' })).resolves.toBe(updated);
    expect(mockRepo.update).toHaveBeenCalledWith('room-1', { name: 'Updated Room' });

    await expect(roomService.update('room-1', 'user-1', {})).rejects.toThrow(ValidationError);

    mockRepo.findById.mockResolvedValueOnce(null);
    await expect(roomService.update('missing-room', 'user-1', { name: 'Nope' })).rejects.toThrow(NotFoundError);
  });

  it('deleteGroup deletes the group for the owner', async () => {
    mockRepo.findById.mockResolvedValueOnce(room);
    mockMemberRepo.findMember.mockResolvedValueOnce(ownerMember);
    await expect(roomService.deleteGroup('room-1', 'user-1')).resolves.toBeUndefined();
    expect(mockRepo.delete).toHaveBeenCalledWith('room-1');
    expect(mockRepo.update).not.toHaveBeenCalled();

    mockRepo.findById.mockResolvedValueOnce(null);
    await expect(roomService.deleteGroup('missing-room', 'user-1')).rejects.toThrow(NotFoundError);
  });

  it('createPrivate returns an existing private room for accepted friends', async () => {
    const socialRepo = {
      isBlocked: vi.fn().mockResolvedValue(false),
      areFriends: vi.fn().mockResolvedValue(true),
    };
    const privateRoom = { ...room, type: 'private' as const };
    mockRepo.findPrivateRoomByMembers.mockResolvedValue(privateRoom);
    roomService = makeRoomService(mockRepo, mockMemberRepo, undefined, socialRepo);

    const result = await roomService.createPrivate('user-1', 'user-2');

    expect(result).toEqual({ room: privateRoom, created: false });
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('createPrivate reopens a readonly private room instead of creating a duplicate', async () => {
    const socialRepo = {
      isBlocked: vi.fn().mockResolvedValue(false),
      areFriends: vi.fn().mockResolvedValue(true),
    };
    const archivedPrivate = {
      ...room,
      type: 'private' as const,
      isReadonly: true,
    };
    const reopenedPrivate = {
      ...archivedPrivate,
      isReadonly: false,
    };
    mockRepo.findPrivateRoomByMembers.mockResolvedValue(archivedPrivate as Room);
    mockRepo.update.mockResolvedValue(reopenedPrivate as Room);
    roomService = makeRoomService(mockRepo, mockMemberRepo, undefined, socialRepo);

    const result = await roomService.createPrivate('user-1', 'user-2');

    expect(mockRepo.update).toHaveBeenCalledWith('room-1', { isReadonly: false });
    expect(result).toEqual({ room: reopenedPrivate, created: false });
  });

  it('createPrivate rejects non-friends', async () => {
    const socialRepo = {
      isBlocked: vi.fn().mockResolvedValue(false),
      areFriends: vi.fn().mockResolvedValue(false),
    };
    roomService = makeRoomService(mockRepo, mockMemberRepo, undefined, socialRepo);

    await expect(roomService.createPrivate('user-1', 'user-2')).rejects.toThrow(ForbiddenError);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('markPrivateReadOnly sets isReadonly to true', async () => {
    const privateRoom = { ...room, type: 'private' as const };
    mockRepo.findPrivateRoomByMembers.mockResolvedValue(privateRoom as Room);

    await roomService.markPrivateReadOnly('user-1', 'user-2');

    expect(mockRepo.update).toHaveBeenCalledWith('room-1', { isReadonly: true });
  });

  it('reopenPrivateRoom sets isReadonly to false', async () => {
    const readonlyRoom = { ...room, type: 'private' as const, isReadonly: true };
    mockRepo.findPrivateRoomByMembers.mockResolvedValue(readonlyRoom as Room);

    await roomService.reopenPrivateRoom('user-1', 'user-2');

    expect(mockRepo.update).toHaveBeenCalledWith('room-1', { isReadonly: false });
  });

  it('reopenPrivateRoom does nothing when room is not readonly', async () => {
    const openRoom = { ...room, type: 'private' as const, isReadonly: false };
    mockRepo.findPrivateRoomByMembers.mockResolvedValue(openRoom as Room);

    await roomService.reopenPrivateRoom('user-1', 'user-2');

    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('reopenPrivateRoom does nothing when room does not exist', async () => {
    mockRepo.findPrivateRoomByMembers.mockResolvedValue(null);

    await roomService.reopenPrivateRoom('user-1', 'user-2');

    expect(mockRepo.update).not.toHaveBeenCalled();
  });
  describe('joinByCode', () => {
    it('joins room using invite code', async () => {
      mockRepo.findByInviteCode.mockResolvedValue(room);
      mockMemberRepo.findMember.mockResolvedValue(null);
      await roomService.joinByCode('user-2', 'ABCDEF');
      expect(mockMemberRepo.add).toHaveBeenCalledWith({ roomId: 'room-1', userId: 'user-2', role: 'member' });
    });
    it('throws ConflictError if already a member', async () => {
      mockRepo.findByInviteCode.mockResolvedValue(room);
      mockMemberRepo.findMember.mockResolvedValue({} as RoomMember);
      await expect(roomService.joinByCode('user-2', 'ABCDEF')).rejects.toThrow(ConflictError);
    });
  });

  describe('leave', () => {
    it('allows normal member to leave', async () => {
      mockRepo.findById.mockResolvedValue(room);
      mockMemberRepo.findMember.mockResolvedValue({ role: 'member' } as RoomMember);
      await roomService.leave('user-2', 'room-1');
      expect(mockMemberRepo.remove).toHaveBeenCalledWith('room-1', 'user-2');
    });
    it('throws ForbiddenError if owner tries to leave', async () => {
      mockRepo.findById.mockResolvedValue(room);
      mockMemberRepo.findMember.mockResolvedValue(ownerMember);
      await expect(roomService.leave('user-1', 'room-1')).rejects.toThrow(ForbiddenError);
    });
  });

  describe('kickMember', () => {
    it('allows owner to kick member', async () => {
      mockRepo.findById.mockResolvedValue(room);
      mockMemberRepo.findMember.mockImplementation(async (roomId, userId) => {
        if (userId === 'user-1') return ownerMember;
        if (userId === 'user-2') return { role: 'member' } as RoomMember;
        return null;
      });
      await roomService.kickMember('room-1', 'user-1', 'user-2');
      expect(mockMemberRepo.remove).toHaveBeenCalledWith('room-1', 'user-2');
    });
    it('prevents kicking the owner', async () => {
      mockRepo.findById.mockResolvedValue(room);
      mockMemberRepo.findMember.mockImplementation(async (roomId, userId) => {
        if (userId === 'user-1') return { role: 'admin' } as RoomMember;
        if (userId === 'user-2') return ownerMember;
        return null;
      });
      await expect(roomService.kickMember('room-1', 'user-1', 'user-2')).rejects.toThrow(ForbiddenError);
    });
  });
});
