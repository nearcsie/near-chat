import { testPool } from './testPool';

export async function resetDb(): Promise<void> {
  await testPool.query(
    'TRUNCATE users, rooms, messages, room_members RESTART IDENTITY CASCADE'
  );
}
