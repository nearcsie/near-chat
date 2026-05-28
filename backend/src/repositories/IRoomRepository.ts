import type { Room } from '@shared/types';

export interface IRoomRepository {
  findById(roomId: string): Promise<Room | null>;
  findByMember(userId: string): Promise<Room[]>;
  create(data: Pick<Room, 'type' | 'name' | 'requireApproval' | 'viewHistory'>): Promise<Room>;
  update(roomId: string, data: Partial<Pick<Room, 'name' | 'avatarUrl' | 'requireApproval' | 'viewHistory' | 'isArchived'>>): Promise<Room>;
  delete(roomId: string): Promise<void>;
}
