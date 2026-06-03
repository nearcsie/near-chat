--- Up migration
CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_invite_code_unique
  ON chat_rooms (invite_code)
  WHERE invite_code IS NOT NULL;

--- Down migration
DROP INDEX IF EXISTS chat_rooms_invite_code_unique;
