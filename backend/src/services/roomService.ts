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

export const makeRoomService = (repo: IRoomRepository, roomMemberRepo: IRoomMemberRepository, emitRoomEvent?: (roomId: string, eventName: string, payload: any) => void) => {
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

    async listMembers(roomId: string, callerId: string) {
      const room = await repo.findById(roomId);
      if (!room) throw new NotFoundError('room', roomId);
      const caller = await roomMemberRepo.findMember(roomId, callerId);
      if (!caller) throw new ForbiddenError('User is not a member of this room');
      return roomMemberRepo.findByRoom(roomId);
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
      const role = room.requireApproval ? 'pending' : 'member';
      await roomMemberRepo.add({ roomId: room.roomId, userId, role });
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

    async approveMember(roomId: string, callerId: string, targetUserId: string): Promise<void> {
      const room = await repo.findById(roomId);
      if (!room) throw new NotFoundError('room', roomId);
      if (!room.requireApproval) throw new ValidationError('Room does not require approval');
      const caller = await roomMemberRepo.findMember(roomId, callerId);
      if (!caller || (caller.role !== 'owner' && caller.role !== 'admin')) {
        throw new ForbiddenError('Only owner or admin can approve members');
      }
      const target = await roomMemberRepo.findMember(roomId, targetUserId);
      if (!target) throw new NotFoundError('member', targetUserId);
      if (target.role !== 'pending') throw new ValidationError('Member is not pending approval');

      await roomMemberRepo.update(roomId, targetUserId, { role: 'member' });
      if (emitRoomEvent) {
        emitRoomEvent(roomId, 'room_update', { type: 'MEMBER_APPROVED', data: { userId: targetUserId } });
      }
    },

    async updateMember(roomId: string, callerId: string, targetUserId: string, data: { role?: string; nickname?: string; isMuted?: boolean }): Promise<void> {
      const room = await repo.findById(roomId);
      if (!room) throw new NotFoundError('room', roomId);
      const caller = await roomMemberRepo.findMember(roomId, callerId);
      if (!caller) throw new ForbiddenError('Not a member');
      
      const target = await roomMemberRepo.findMember(roomId, targetUserId);
      if (!target) throw new NotFoundError('member', targetUserId);

      if (callerId !== targetUserId) {
        if (caller.role !== 'owner' && caller.role !== 'admin') {
          throw new ForbiddenError('Only owner or admin can update other members');
        }
        if (caller.role === 'admin' && (target.role === 'owner' || target.role === 'admin')) {
          throw new ForbiddenError('Admin cannot update owner or other admins');
        }
        if (data.role && caller.role !== 'owner') {
          throw new ForbiddenError('Only owner can change roles');
        }
      } else {
        if (data.role || data.isMuted !== undefined) {
          throw new ForbiddenError('Cannot update your own role or mute status');
        }
      }

      await roomMemberRepo.update(roomId, targetUserId, data as any);
      if (emitRoomEvent) {
        emitRoomEvent(roomId, 'room_update', { type: 'MEMBER_UPDATED', data: { userId: targetUserId, ...data } });
      }
    },

    async kickMember(roomId: string, callerId: string, targetUserId: string): Promise<void> {
      const room = await repo.findById(roomId);
      if (!room) throw new NotFoundError('room', roomId);
      
      const caller = await roomMemberRepo.findMember(roomId, callerId);
      if (!caller || (caller.role !== 'owner' && caller.role !== 'admin')) {
        throw new ForbiddenError('Only owner or admin can kick members');
      }
      
      const target = await roomMemberRepo.findMember(roomId, targetUserId);
      if (!target) throw new NotFoundError('member', targetUserId);
      
      if (caller.role === 'admin' && (target.role === 'owner' || target.role === 'admin')) {
        throw new ForbiddenError('Admin cannot kick owner or other admins');
      }
      if (target.role === 'owner') {
        throw new ForbiddenError('Owner cannot be kicked');
      }

      await roomMemberRepo.remove(roomId, targetUserId);
      if (emitRoomEvent) {
        emitRoomEvent(roomId, 'room_update', { type: 'MEMBER_KICKED', data: { userId: targetUserId } });
      }
    },
  };
};
