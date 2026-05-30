import { testPool } from './testPool';

export async function resetDb(): Promise<void> {
  await testPool.query(
    'TRUNCATE users, chat_rooms, messages, room_members, friendships, blocks RESTART IDENTITY CASCADE'
  );
}

