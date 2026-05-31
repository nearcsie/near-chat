--- Up migration
-- v1 scope: users, chat_rooms, messages, room_members

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  user_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  bio             TEXT,
  avatar_url      VARCHAR(2048),
  warning_enabled BOOLEAN     NOT NULL DEFAULT false,
  warning_days    INTEGER     NOT NULL DEFAULT 0,
  last_activity   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_rooms (
  room_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type             VARCHAR(10) NOT NULL CHECK (type IN ('private', 'group')),
  name             VARCHAR(255),
  avatar_url       VARCHAR(2048),
  invite_code      VARCHAR(255),
  require_approval BOOLEAN     NOT NULL DEFAULT false,
  view_history     BOOLEAN     NOT NULL DEFAULT true,
  is_archived      BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
  message_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID        NOT NULL REFERENCES chat_rooms(room_id) ON DELETE CASCADE,
  sender_id   UUID        REFERENCES users(user_id) ON DELETE SET NULL,
  content     TEXT        NOT NULL,
  reply_to_id UUID        REFERENCES messages(message_id) ON DELETE SET NULL,
  is_recalled BOOLEAN     NOT NULL DEFAULT false,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE room_members (
  room_id      UUID        NOT NULL REFERENCES chat_rooms(room_id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role         VARCHAR(10) NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'pending')),
  nickname     VARCHAR(255),
  is_muted     BOOLEAN     NOT NULL DEFAULT false,
  last_read_id UUID        REFERENCES messages(message_id) ON DELETE SET NULL,
  join_time    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

--- Down migration
DROP TABLE IF EXISTS room_members;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS chat_rooms;
DROP TABLE IF EXISTS users;
