--- Up migration
ALTER TABLE chat_rooms
  ADD COLUMN IF NOT EXISTS room_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_readonly BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_room_hash_unique
  ON chat_rooms (room_hash)
  WHERE room_hash IS NOT NULL;

--- Down migration
DROP INDEX IF EXISTS chat_rooms_room_hash_unique;
ALTER TABLE chat_rooms
  DROP COLUMN IF EXISTS room_hash,
  DROP COLUMN IF EXISTS is_readonly;
