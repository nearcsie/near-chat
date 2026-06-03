--- Up migration
ALTER TABLE users
ADD COLUMN IF NOT EXISTS lang_preference VARCHAR(10) NOT NULL DEFAULT 'en';

--- Down migration
ALTER TABLE users
DROP COLUMN IF EXISTS lang_preference;
