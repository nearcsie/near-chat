import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { makeRoomService } from '../../src/services/roomService';
import { NotFoundError, ValidationError } from '../../src/errors/AppError';
import type { IRoomRepository } from '../../src/repositories/IRoomRepository';
import type { Room } from '../../../shared/types';

describe('roomService', () => {
  let mockRepo: Mocked<IRoomRepository>;
  let roomService: ReturnType<typeof makeRoomService>;

  const room: Room = {
    roomId: 'room-1',
    type: 'group',
    name: 'Study Room',
    requireApproval: false,
    viewHistory: true,
    isArchived: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findByMember: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    roomService = makeRoomService(mockRepo);
  });

  it('create validates input, trims name, and applies defaults', async () => {
    mockRepo.create.mockResolvedValue(room);

    const result = await roomService.create({ name: '  Study Room  ' });

    expect(mockRepo.create).toHaveBeenCalledWith({
      type: 'group',
      name: 'Study Room',
      requireApproval: false,
      viewHistory: true,
    });
    expect(result).toBe(room);
  });

  it('create rejects empty room names', async () => {
    await expect(roomService.create({ name: '   ' })).rejects.toThrow(ValidationError);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('getById returns the room or throws NotFoundError', async () => {
    mockRepo.findById.mockResolvedValueOnce(room);
    await expect(roomService.getById('room-1')).resolves.toBe(room);

    mockRepo.findById.mockResolvedValueOnce(null);
    await expect(roomService.getById('missing-room')).rejects.toThrow(NotFoundError);
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
    mockRepo.update.mockResolvedValue(updated);

    await expect(roomService.update('room-1', { name: ' Updated Room ' })).resolves.toBe(updated);
    expect(mockRepo.update).toHaveBeenCalledWith('room-1', { name: 'Updated Room' });

    await expect(roomService.update('room-1', {})).rejects.toThrow(ValidationError);

    mockRepo.findById.mockResolvedValueOnce(null);
    await expect(roomService.update('missing-room', { name: 'Nope' })).rejects.toThrow(NotFoundError);
  });

  it('delete throws NotFoundError when the room does not exist', async () => {
    mockRepo.findById.mockResolvedValueOnce(room);
    await expect(roomService.delete('room-1')).resolves.toBeUndefined();
    expect(mockRepo.delete).toHaveBeenCalledWith('room-1');

    mockRepo.findById.mockResolvedValueOnce(null);
    await expect(roomService.delete('missing-room')).rejects.toThrow(NotFoundError);
  });
});
