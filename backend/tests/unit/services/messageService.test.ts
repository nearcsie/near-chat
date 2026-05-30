import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { makeMessageService } from '../../../src/services/messageService';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../src/errors/AppError';
import type { IMessageRepository } from '../../../src/repositories/IMessageRepository';
import type { IRoomMemberRepository } from '../../../src/repositories/IRoomMemberRepository';
import type { IRoomRepository } from '../../../src/repositories/IRoomRepository';
import type { Message, MessageWithSender, Room, RoomMember } from '../../../../shared/types';

describe('messageService', () => {
  let messageRepo: Mocked<IMessageRepository>;
  let roomRepo: Mocked<IRoomRepository>;
  let roomMemberRepo: Mocked<IRoomMemberRepository>;
  let messageService: ReturnType<typeof makeMessageService>;

  const room: Room = {
    roomId: 'room-1',
    type: 'group',
    name: 'Study Room',
    requireApproval: false,
    viewHistory: true,
    isArchived: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const member: RoomMember = {
    roomId: 'room-1',
    userId: 'user-1',
    role: 'member',
    isMuted: false,
    joinTime: new Date('2026-01-01T00:00:00.000Z'),
  };

  const message: Message = {
    messageId: 'message-1',
    roomId: 'room-1',
    senderId: 'user-1',
    content: 'hello',
    isRecalled: false,
    sentAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const messageWithSender: MessageWithSender = {
    ...message,
    sender: {
      userId: 'user-1',
      name: 'Sender',
      avatarUrl: undefined,
    },
  };

  beforeEach(() => {
    messageRepo = {
      findById: vi.fn(),
      findByRoom: vi.fn(),
      create: vi.fn(),
      markRecalled: vi.fn(),
    };
    roomRepo = {
      findById: vi.fn(),
      findByMember: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    roomMemberRepo = {
      findMember: vi.fn(),
      findByRoom: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    messageService = makeMessageService(messageRepo, roomRepo, roomMemberRepo);
  });

  it('sendMessage validates, checks room membership, and creates a message', async () => {
    roomRepo.findById.mockResolvedValue(room);
    roomMemberRepo.findMember.mockResolvedValue(member);
    messageRepo.create.mockResolvedValue(messageWithSender);

    const result = await messageService.sendMessage('user-1', 'room-1', '  hello  ');

    expect(roomRepo.findById).toHaveBeenCalledWith('room-1');
    expect(roomMemberRepo.findMember).toHaveBeenCalledWith('room-1', 'user-1');
    expect(messageRepo.create).toHaveBeenCalledWith({
      roomId: 'room-1',
      senderId: 'user-1',
      content: 'hello',
    });
    expect(result).toBe(messageWithSender);
  });

  it('sendMessage rejects empty content before touching repositories', async () => {
    await expect(messageService.sendMessage('user-1', 'room-1', '   ')).rejects.toThrow(ValidationError);
    expect(roomRepo.findById).not.toHaveBeenCalled();
    expect(messageRepo.create).not.toHaveBeenCalled();
  });

  it('sendMessage throws NotFoundError when the room is missing', async () => {
    roomRepo.findById.mockResolvedValue(null);

    await expect(messageService.sendMessage('user-1', 'missing-room', 'hello')).rejects.toThrow(NotFoundError);
    expect(roomMemberRepo.findMember).not.toHaveBeenCalled();
    expect(messageRepo.create).not.toHaveBeenCalled();
  });

  it('sendMessage throws ForbiddenError when caller is not a room member', async () => {
    roomRepo.findById.mockResolvedValue(room);
    roomMemberRepo.findMember.mockResolvedValue(null);

    await expect(messageService.sendMessage('user-2', 'room-1', 'hello')).rejects.toThrow(ForbiddenError);
    expect(messageRepo.create).not.toHaveBeenCalled();
  });

  it('listForRoom checks membership and returns chronological messages from the repository', async () => {
    roomRepo.findById.mockResolvedValue(room);
    roomMemberRepo.findMember.mockResolvedValue(member);
    messageRepo.findByRoom.mockResolvedValue([messageWithSender]);

    const result = await messageService.listForRoom('user-1', 'room-1', {
      beforeId: 'message-0',
      limit: 10,
    });

    expect(messageRepo.findByRoom).toHaveBeenCalledWith('room-1', {
      beforeId: 'message-0',
      limit: 10,
    });
    expect(result).toEqual([messageWithSender]);
  });

  it('recallMessage checks membership and recalls messages that belong to the room', async () => {
    const recalled: MessageWithSender = { ...messageWithSender, isRecalled: true };
    roomRepo.findById.mockResolvedValue(room);
    roomMemberRepo.findMember.mockResolvedValue(member);
    messageRepo.findById.mockResolvedValue(message);
    messageRepo.markRecalled.mockResolvedValue(recalled);

    const result = await messageService.recallMessage('user-1', 'room-1', 'message-1');

    expect(messageRepo.markRecalled).toHaveBeenCalledWith('message-1');
    expect(result).toBe(recalled);
  });

  it('recallMessage hides messages outside the room behind NotFoundError', async () => {
    roomRepo.findById.mockResolvedValue(room);
    roomMemberRepo.findMember.mockResolvedValue(member);
    messageRepo.findById.mockResolvedValue({ ...message, roomId: 'other-room' });

    await expect(messageService.recallMessage('user-1', 'room-1', 'message-1')).rejects.toThrow(NotFoundError);
    expect(messageRepo.markRecalled).not.toHaveBeenCalled();
  });

  it('recallMessage rejects callers who are not the original sender', async () => {
    roomRepo.findById.mockResolvedValue(room);
    roomMemberRepo.findMember.mockResolvedValue(member);
    messageRepo.findById.mockResolvedValue({ ...message, senderId: 'user-2' });

    await expect(messageService.recallMessage('user-1', 'room-1', 'message-1')).rejects.toThrow(ForbiddenError);
    expect(messageRepo.markRecalled).not.toHaveBeenCalled();
  });
});
