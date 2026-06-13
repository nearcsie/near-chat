--- Up migration

-- room_members: index on user_id for findByMember (PK is (room_id, user_id), unusable for user_id-only scans)
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members (user_id);

-- friendships: indexes for both sides + status (getPendingRequests, getFriends, areFriends)
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_status ON friendships (addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_requester_status ON friendships (requester_id, status);

-- blocks: index on blocked_id for the second leg of bidirectional isBlocked queries
CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id ON blocks (blocked_id);

-- attachments: index on message_id for correlated subqueries in message fetches
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments (message_id);

-- messages: index on sender_id (unindexed FK)
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages (sender_id);

-- user search: pg_trgm GIN index for efficient ILIKE '%query%', partial for active users only
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING gin (name gin_trgm_ops) WHERE deleted_at IS NULL;

--- Down migration
DROP INDEX IF EXISTS idx_users_name_trgm;
DROP INDEX IF EXISTS idx_messages_sender_id;
DROP INDEX IF EXISTS idx_attachments_message_id;
DROP INDEX IF EXISTS idx_blocks_blocked_id;
DROP INDEX IF EXISTS idx_friendships_requester_status;
DROP INDEX IF EXISTS idx_friendships_addressee_status;
DROP INDEX IF EXISTS idx_room_members_user_id;
