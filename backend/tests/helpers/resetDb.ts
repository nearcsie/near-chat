import { testPool } from './testPool';

export async function resetDb(): Promise<void> {
  await testPool.query(
    'TRUNCATE users, chat_rooms, messages, room_members, emergency_contacts, friendships, blocks, folders, folder_rooms, attachments RESTART IDENTITY CASCADE'
  );
}
