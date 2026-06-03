--- Up migration
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE attachments ALTER COLUMN message_id DROP NOT NULL;
ALTER TABLE attachments ADD COLUMN uploaded_by UUID REFERENCES users(user_id) ON DELETE SET NULL;

--- Down migration
ALTER TABLE attachments DROP COLUMN IF EXISTS uploaded_by;
ALTER TABLE attachments ALTER COLUMN message_id SET NOT NULL;

ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
