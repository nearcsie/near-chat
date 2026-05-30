import { testPool } from './testPool';

export async function resetDb(): Promise<void> {
  await testPool.query(
    'TRUNCATE users, chat_rooms, messages, room_members, emergency_contacts RESTART IDENTITY CASCADE'
  );
}

