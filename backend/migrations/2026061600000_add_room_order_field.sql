--- Up migration
ALTER TABLE users
  ADD COLUMN room_order JSONB NOT NULL DEFAULT '{}'::jsonb;

--- Down migration
ALTER TABLE users
  DROP COLUMN room_order;
