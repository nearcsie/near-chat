--- Up migration

-- 1. messages.reply_to_id (messages table)
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON messages (reply_to_id) WHERE reply_to_id IS NOT NULL;

-- 2. room_members.last_read_id (room_members table)
CREATE INDEX IF NOT EXISTS idx_room_members_last_read_id ON room_members (last_read_id) WHERE last_read_id IS NOT NULL;

-- 3. attachments.uploaded_by (attachments table)
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON attachments (uploaded_by);

-- 4. emergency_contacts.contact_id (emergency_contacts table)
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_contact_id ON emergency_contacts (contact_id);

-- 5. folders.user_id (folders table)
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders (user_id);

-- 6. folder_rooms.room_id (folder_rooms table)
CREATE INDEX IF NOT EXISTS idx_folder_rooms_room_id ON folder_rooms (room_id);

-- 7. message_mentions.user_id (message_mentions table)
CREATE INDEX IF NOT EXISTS idx_message_mentions_user_id ON message_mentions (user_id);

-- 8. refresh_tokens.replaced_by (refresh_tokens table)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_replaced_by ON refresh_tokens (replaced_by) WHERE replaced_by IS NOT NULL;

--- Down migration

DROP INDEX IF EXISTS idx_refresh_tokens_replaced_by;
DROP INDEX IF EXISTS idx_message_mentions_user_id;
DROP INDEX IF EXISTS idx_folder_rooms_room_id;
DROP INDEX IF EXISTS idx_folders_user_id;
DROP INDEX IF EXISTS idx_emergency_contacts_contact_id;
DROP INDEX IF EXISTS idx_attachments_uploaded_by;
DROP INDEX IF EXISTS idx_room_members_last_read_id;
DROP INDEX IF EXISTS idx_messages_reply_to_id;
