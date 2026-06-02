import type { Room, RoomSummary } from '@shared/types';

export type CreateRoomData = Pick<Room, 'type' | 'name' | 'avatarUrl' | 'inviteCode' | 'requireApproval' | 'viewHistory'> & {
  roomHash?: string;
};

export type UpdateRoomData = Partial<Pick<Room, 'name' | 'avatarUrl' | 'requireApproval' | 'viewHistory' | 'isArchived'>>;

export interface IRoomRepository {
  findById(roomId: string): Promise<Room | null>;
  findByInviteCode(code: string): Promise<Room | null>;
  findByRoomHash(roomHash: string): Promise<Room | null>;
  findByMember(userId: string): Promise<RoomSummary[]>;
  create(data: CreateRoomData): Promise<Room>;
  update(roomId: string, data: UpdateRoomData): Promise<Room>;
  delete(roomId: string): Promise<void>;
}
