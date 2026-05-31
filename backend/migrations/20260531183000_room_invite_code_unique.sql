--- Up migration
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS chat_rooms_invite_code_unique
  ON chat_rooms (invite_code)
  WHERE invite_code IS NOT NULL;

--- Down migration
DROP INDEX CONCURRENTLY IF EXISTS chat_rooms_invite_code_unique;
