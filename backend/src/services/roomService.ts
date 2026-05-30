import type { Room } from '@shared/types';
import type { IRoomRepository } from '../repositories/IRoomRepository';
import type { IRoomMemberRepository } from '../repositories/IRoomMemberRepository';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors/AppError';
import {
  createRoomSchema,
  updateRoomSchema,
  type CreateRoomInput,
  type UpdateRoomInput,
} from '../validators/roomSchemas';

const validationMessage = (issues: { message: string }[]) =>
  issues[0]?.message ?? 'Invalid room payload';

export const makeRoomService = (repo: IRoomRepository, roomMemberRepo: IRoomMemberRepository) => {
  return {
    async create(creatorId: string, data: CreateRoomInput): Promise<Room> {
      const parsed = createRoomSchema.safeParse(data);
      if (!parsed.success) {
        throw new ValidationError(validationMessage(parsed.error.issues));
      }
      const room = await repo.create(parsed.data);
      await roomMemberRepo.add({ roomId: room.roomId, userId: creatorId, role: 'owner' });
      return room;
    },

    async getById(roomId: string, callerId: string): Promise<Room> {
      const room = await repo.findById(roomId);
      if (!room) throw new NotFoundError('room', roomId);
      const member = await roomMemberRepo.findMember(roomId, callerId);
      if (!member) throw new ForbiddenError('User is not a member of this room');
      return room;
    },

    async list(userId: string): Promise<Room[]> {
      return repo.findByMember(userId);
    },

    async update(roomId: string, callerId: string, data: UpdateRoomInput): Promise<Room> {
      const parsed = updateRoomSchema.safeParse(data);
      if (!parsed.success) {
        throw new ValidationError(validationMessage(parsed.error.issues));
      }
      const room = await repo.findById(roomId);
      if (!room) throw new NotFoundError('room', roomId);
      const member = await roomMemberRepo.findMember(roomId, callerId);
      if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
        throw new ForbiddenError('Only owner or admin can update room settings');
      }
      return repo.update(roomId, parsed.data);
    },

    async joinByCode(userId: string, inviteCode: string): Promise<Room> {
      const room = await repo.findByInviteCode(inviteCode);
      if (!room) throw new NotFoundError('room', inviteCode);
      const existing = await roomMemberRepo.findMember(room.roomId, userId);
      if (existing) throw new ConflictError('User is already a member of this room');
      await roomMemberRepo.add({ roomId: room.roomId, userId, role: 'member' });
      return room;
    },

    async leave(userId: string, roomId: string): Promise<void> {
      const room = await repo.findById(roomId);
      if (!room) throw new NotFoundError('room', roomId);
      const member = await roomMemberRepo.findMember(roomId, userId);
      if (!member) throw new ForbiddenError('User is not a member of this room');
      if (member.role === 'owner') {
        throw new ForbiddenError('Owner cannot leave room. Transfer ownership first.');
      }
      await roomMemberRepo.remove(roomId, userId);
    },

    async delete(roomId: string): Promise<void> {
      const existing = await repo.findById(roomId);
      if (!existing) throw new NotFoundError('room', roomId);
      await repo.delete(roomId);
    },
  };
};
