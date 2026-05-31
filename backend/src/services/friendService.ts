import { AppError, ValidationError } from '../errors/AppError';
import type { makeFriendRepository } from '../repositories/friendRepository';

export function makeFriendService(
  repo: ReturnType<typeof makeFriendRepository>,
  notifyUser?: (userId: string, eventName: string, payload: any) => void,
  privateRooms?: {
    createPrivate(creatorId: string, targetUserId: string): Promise<unknown>;
    markPrivateReadOnly(userA: string, userB: string): Promise<void>;
  }
) {
  return {
    async sendFriendRequest(requesterId: string, targetUserId: string) {
      if (requesterId === targetUserId) {
        throw new ValidationError('Cannot send friend request to yourself');
      }

      const isBlocked = await repo.isBlocked(requesterId, targetUserId);
      if (isBlocked) {
        throw new AppError(403, 'Cannot interact with this user', 'FORBIDDEN');
      }

      const request = await repo.sendFriendRequest(requesterId, targetUserId);
      
      if (notifyUser) {
        notifyUser(targetUserId, 'friend_request', request);
      }
      return request;
    },

    async getPendingRequests(userId: string) {
      return repo.getPendingRequests(userId);
    },

    async respondFriendRequest(userId: string, requesterId: string, status: 'accepted' | 'rejected') {
      if (status === 'accepted') {
        const isBlocked = await repo.isBlocked(requesterId, userId);
        if (isBlocked) {
          throw new AppError(403, 'Cannot interact with this user', 'FORBIDDEN');
        }
        const accepted = await repo.acceptFriendRequest(requesterId, userId);
        if (!accepted) {
          throw new AppError(404, 'Friend request not found', 'NOT_FOUND');
        }
        await privateRooms?.createPrivate(requesterId, userId);
        return accepted;
      } else {
        const rejected = await repo.rejectFriendRequest(requesterId, userId);
        if (!rejected) {
          throw new AppError(404, 'Friend request not found', 'NOT_FOUND');
        }
        return { status: 'rejected' };
      }
    },

    async getFriends(userId: string) {
      return repo.getFriends(userId);
    },

    async removeFriend(userId: string, friendId: string) {
      await repo.deleteFriendship(userId, friendId);
      await privateRooms?.markPrivateReadOnly(userId, friendId);
    },

    async blockUser(userId: string, targetUserId: string) {
      await repo.blockUser(userId, targetUserId);
      await repo.deleteFriendship(userId, targetUserId);
      await privateRooms?.markPrivateReadOnly(userId, targetUserId);
      return { status: 'blocked' };
    },

    async unblockUser(userId: string, blockedId: string) {
      return repo.unblockUser(userId, blockedId);
    }
  };
}
