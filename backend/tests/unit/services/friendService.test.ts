import { describe, it, expect, vi } from 'vitest';
import { makeFriendService } from '../../../src/services/friendService';
import { AppError } from '../../../src/errors/AppError';

describe('friendService', () => {
  it('respondFriendRequest throws NOT_FOUND when accepting non-existent request', async () => {
    const mockRepo = {
      isBlocked: vi.fn().mockResolvedValue(false),
      acceptFriendRequest: vi.fn().mockResolvedValue(null)
    } as any;
    const service = makeFriendService(mockRepo);
    await expect(service.respondFriendRequest('u1', 'u2', 'accepted')).rejects.toThrow(AppError);
  });

  it('respondFriendRequest throws NOT_FOUND when rejecting non-existent request', async () => {
    const mockRepo = {
      rejectFriendRequest: vi.fn().mockResolvedValue(null)
    } as any;
    const service = makeFriendService(mockRepo);
    await expect(service.respondFriendRequest('u1', 'u2', 'rejected')).rejects.toThrow(AppError);
  });

  it('unblockUser calls repo.unblockUser', async () => {
    const mockRepo = {
      unblockUser: vi.fn().mockResolvedValue(true)
    } as any;
    const service = makeFriendService(mockRepo);
    const result = await service.unblockUser('u1', 'u2');
    expect(mockRepo.unblockUser).toHaveBeenCalledWith('u1', 'u2');
    expect(result).toBe(true);
  });
});
