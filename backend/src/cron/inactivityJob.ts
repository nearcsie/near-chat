import type { makeUserService } from '../services/userService';
import type { IUserRepository } from '../repositories/IUserRepository';

export function startInactivityJob(
  userRepo: IUserRepository,
  userService: ReturnType<typeof makeUserService>,
  intervalMs = 60 * 60 * 1000 // default 1 hour
) {
  return setInterval(async () => {
    try {
      const users = await userRepo.findAllWarningEnabled();
      const now = new Date();
      for (const user of users) {
        try {
          await userService.checkInactivity(user.userId, now);
        } catch (err) {
          console.error(`Error checking inactivity for user ${user.userId}:`, err);
        }
      }
    } catch (err) {
      console.error('Error running inactivity job:', err);
    }
  }, intervalMs);
}
