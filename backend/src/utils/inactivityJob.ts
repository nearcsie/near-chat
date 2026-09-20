import type { makeUserService } from '../services/userService';
import type { IUserRepository } from '../models/IUserRepository';
import { presenceOf, type PresenceState } from '../realtime/presence';
import { logger } from './logger';

export function startInactivityJob(
  userRepo: IUserRepository,
  userService: ReturnType<typeof makeUserService>,
  intervalMs = 60 * 60 * 1000, // default 1 hour
  // Injected rather than imported at the call site so a test can decide who is
  // online without reaching for `mock.module`. See backend/tests/CLAUDE.md.
  readPresence: (userId: string) => Promise<PresenceState> = presenceOf,
) {
  let isRunning = false;
  return setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const users = await userRepo.findAllWarningEnabled();
      const now = new Date();
      for (const user of users) {
        try {
          const presence = await readPresence(user.userId);
          if (presence === 'online') {
            await userRepo.update(user.userId, { lastActivity: now });
            continue;
          }
          // `unknown` means Redis could not be reached, not that the user is
          // gone. Escalating on it would let a Redis blip notify a connected
          // user's emergency contacts — a one-shot delivery that the next tick
          // cannot take back — whereas skipping costs one hour of delay.
          if (presence === 'unknown') continue;
          await userService.checkInactivity(user.userId, now);
        } catch (err) {
          logger.error({ err, userId: user.userId }, 'Error checking inactivity for user');
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error running inactivity job');
    } finally {
      isRunning = false;
    }
  }, intervalMs);
}
