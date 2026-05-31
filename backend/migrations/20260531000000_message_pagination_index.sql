CREATE INDEX IF NOT EXISTS idx_messages_pagination ON messages (room_id, sent_at DESC, message_id DESC);
