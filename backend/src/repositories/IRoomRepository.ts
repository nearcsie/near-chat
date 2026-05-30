import type { Room, RoomSummary } from '@shared/types';

export interface IRoomRepository {
  findById(roomId: string): Promise<Room | null>;
  findByInviteCode(code: string): Promise<Room | null>;
  findByRoomHash(roomHash: string): Promise<Room | null>;
  findByMember(userId: string): Promise<RoomSummary[]>;
  create(data: Pick<Room, 'type' | 'name' | 'avatarUrl' | 'inviteCode' | 'roomHash' | 'requireApproval' | 'viewHistory' | 'isReadonly'>): Promise<Room>;
  update(roomId: string, data: Partial<Pick<Room, 'name' | 'avatarUrl' | 'requireApproval' | 'viewHistory' | 'isArchived' | 'isReadonly'>>): Promise<Room>;
  delete(roomId: string): Promise<void>;
}
