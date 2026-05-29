import type { Room } from '@shared/types';
import type { IRoomRepository } from '../repositories/IRoomRepository';
import { NotFoundError, ValidationError } from '../errors/AppError';
import {
  createRoomSchema,
  updateRoomSchema,
  type CreateRoomInput,
  type UpdateRoomInput,
} from '../validators/roomSchemas';

const validationMessage = (issues: { message: string }[]) =>
  issues[0]?.message ?? 'Invalid room payload';

export const makeRoomService = (repo: IRoomRepository) => {
  return {
    async create(data: CreateRoomInput): Promise<Room> {
      const parsed = createRoomSchema.safeParse(data);
      if (!parsed.success) {
        throw new ValidationError(validationMessage(parsed.error.issues));
      }

      return repo.create(parsed.data);
    },

    async getById(roomId: string): Promise<Room> {
      const room = await repo.findById(roomId);
      if (!room) {
        throw new NotFoundError('room', roomId);
      }
      return room;
    },

    async list(userId: string): Promise<Room[]> {
      return repo.findByMember(userId);
    },

    async update(roomId: string, data: UpdateRoomInput): Promise<Room> {
      const parsed = updateRoomSchema.safeParse(data);
      if (!parsed.success) {
        throw new ValidationError(validationMessage(parsed.error.issues));
      }

      const existing = await repo.findById(roomId);
      if (!existing) {
        throw new NotFoundError('room', roomId);
      }

      return repo.update(roomId, parsed.data);
    },

    async delete(roomId: string): Promise<void> {
      const existing = await repo.findById(roomId);
      if (!existing) {
        throw new NotFoundError('room', roomId);
      }

      await repo.delete(roomId);
    },
  };
};
