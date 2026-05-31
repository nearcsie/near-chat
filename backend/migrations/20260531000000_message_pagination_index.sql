--- Up migration
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_pagination ON messages (room_id, sent_at DESC, message_id DESC);

--- Down migration
DROP INDEX CONCURRENTLY IF EXISTS idx_messages_pagination;
