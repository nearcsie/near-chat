import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startInactivityJob } from '../../../src/cron/inactivityJob';
import type { IUserRepository } from '../../../src/repositories/IUserRepository';

describe('inactivityJob', () => {
  let mockUserRepo: import('vitest').Mocked<IUserRepository>;
  let mockUserService: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockUserRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      search: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findAllWarningEnabled: vi.fn(),
    };
    mockUserService = {
      checkInactivity: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call checkInactivity for each user and prevent overlapping runs', async () => {
    const mockUsers = [
      { userId: 'u1' },
      { userId: 'u2' }
    ];
    mockUserRepo.findAllWarningEnabled.mockResolvedValue(mockUsers as any);
    
    // Simulate a slow checkInactivity to test lock
    let checkPromiseResolve: () => void;
    mockUserService.checkInactivity.mockImplementation(() => {
      return new Promise<void>((resolve) => {
        checkPromiseResolve = resolve;
      });
    });

    const intervalId = startInactivityJob(mockUserRepo, mockUserService, 1000);
    
    // Fast forward to first execution
    vi.advanceTimersByTime(1000);
    
    // Allow the promise chain to settle so that the first interval execution reaches findAllWarningEnabled
    await Promise.resolve();
    
    expect(mockUserRepo.findAllWarningEnabled).toHaveBeenCalledTimes(1);
    
    // Fast forward to second execution before the first one finishes
    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    
    // It should not call findAllWarningEnabled again because the lock is held
    expect(mockUserRepo.findAllWarningEnabled).toHaveBeenCalledTimes(1);

    clearInterval(intervalId);
  });

  it('continues with remaining users when checkInactivity fails for one user', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUserRepo.findAllWarningEnabled.mockResolvedValue([
      { userId: 'u1' },
      { userId: 'u2' }
    ] as any);
    mockUserService.checkInactivity
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);

    const intervalId = startInactivityJob(mockUserRepo, mockUserService, 1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(mockUserService.checkInactivity).toHaveBeenCalledTimes(2);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error checking inactivity for user u1'),
      expect.any(Error)
    );

    clearInterval(intervalId);
    consoleSpy.mockRestore();
  });

  it('logs and releases the lock when findAllWarningEnabled fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUserRepo.findAllWarningEnabled
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce([] as any);

    const intervalId = startInactivityJob(mockUserRepo, mockUserService, 1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(consoleSpy).toHaveBeenCalledWith('Error running inactivity job:', expect.any(Error));

    // The lock must be released so the next tick runs again
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockUserRepo.findAllWarningEnabled).toHaveBeenCalledTimes(2);

    clearInterval(intervalId);
    consoleSpy.mockRestore();
  });
});
