--- Up migration
DROP INDEX IF EXISTS chat_rooms_room_hash_unique;
ALTER TABLE chat_rooms DROP COLUMN IF EXISTS room_hash;

--- Down migration
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS room_hash VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_room_hash_unique
  ON chat_rooms (room_hash)
  WHERE room_hash IS NOT NULL;
