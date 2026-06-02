--- Up migration
ALTER TABLE users
ADD COLUMN IF NOT EXISTS app_theme VARCHAR(10) NOT NULL DEFAULT 'light',
ADD COLUMN IF NOT EXISTS notify_desktop BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_sound BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_app_theme_check;

ALTER TABLE users
ADD CONSTRAINT users_app_theme_check CHECK (app_theme IN ('light', 'dark'));

--- Down migration
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_app_theme_check;

ALTER TABLE users
DROP COLUMN IF EXISTS notify_sound,
DROP COLUMN IF EXISTS notify_desktop,
DROP COLUMN IF EXISTS app_theme;
