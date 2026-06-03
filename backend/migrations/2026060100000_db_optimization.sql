--- Up migration

-- 1. Fix attachments.uploaded_at to TIMESTAMPTZ for consistency with the rest of the schema
ALTER TABLE attachments ALTER COLUMN uploaded_at TYPE TIMESTAMPTZ USING uploaded_at AT TIME ZONE 'UTC';

-- 2. Self-reference prevention constraints
-- Remove any pre-existing self-referencing rows so VALIDATE CONSTRAINT succeeds
DELETE FROM friendships WHERE requester_id = addressee_id;
DELETE FROM blocks WHERE blocker_id = blocked_id;
DELETE FROM emergency_contacts WHERE user_id = contact_id;

-- Add constraints NOT VALID first: skips full-table scan, uses weaker lock
ALTER TABLE friendships ADD CONSTRAINT friendships_no_self_friendship
  CHECK (requester_id <> addressee_id) NOT VALID;

ALTER TABLE blocks ADD CONSTRAINT blocks_no_self_block
  CHECK (blocker_id <> blocked_id) NOT VALID;

ALTER TABLE emergency_contacts ADD CONSTRAINT emergency_contacts_no_self_contact
  CHECK (user_id <> contact_id) NOT VALID;

-- Validate separately: ShareUpdateExclusiveLock instead of AccessExclusiveLock
ALTER TABLE friendships VALIDATE CONSTRAINT friendships_no_self_friendship;
ALTER TABLE blocks VALIDATE CONSTRAINT blocks_no_self_block;
ALTER TABLE emergency_contacts VALIDATE CONSTRAINT emergency_contacts_no_self_contact;

-- 3. room_members: index on user_id for findByMember (PK is (room_id, user_id), unusable for user_id-only scans)
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members (user_id);

-- 4. friendships: indexes for both sides + status (getPendingRequests, getFriends, areFriends)
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_status ON friendships (addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_requester_status ON friendships (requester_id, status);

-- 5. blocks: index on blocked_id for the second leg of bidirectional isBlocked queries
CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id ON blocks (blocked_id);

-- 6. attachments: index on message_id for correlated subqueries in message fetches
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments (message_id);

-- 7. messages: index on sender_id (unindexed FK)
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages (sender_id);

-- 8. user search: pg_trgm GIN index for efficient ILIKE '%query%', partial for active users only
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING gin (name gin_trgm_ops) WHERE deleted_at IS NULL;

--- Down migration
DROP INDEX IF EXISTS idx_users_name_trgm;
-- pg_trgm extension is not dropped on rollback: it may be shared with other objects
DROP INDEX IF EXISTS idx_messages_sender_id;
DROP INDEX IF EXISTS idx_attachments_message_id;
DROP INDEX IF EXISTS idx_blocks_blocked_id;
DROP INDEX IF EXISTS idx_friendships_requester_status;
DROP INDEX IF EXISTS idx_friendships_addressee_status;
DROP INDEX IF EXISTS idx_room_members_user_id;
ALTER TABLE emergency_contacts DROP CONSTRAINT IF EXISTS emergency_contacts_no_self_contact;
ALTER TABLE blocks DROP CONSTRAINT IF EXISTS blocks_no_self_block;
ALTER TABLE friendships DROP CONSTRAINT IF EXISTS friendships_no_self_friendship;
ALTER TABLE attachments ALTER COLUMN uploaded_at TYPE TIMESTAMP USING uploaded_at AT TIME ZONE 'UTC';
