--- Up migration
-- E2E encryption: per-user public keys + per-room wrapped symmetric keys.
-- The server never stores private keys or plaintext room keys; `encrypted_key`
-- is the room key wrapped with the member's public key on the client.

ALTER TABLE users ADD COLUMN public_key TEXT;

CREATE TABLE room_keys (
  room_id       UUID        NOT NULL REFERENCES chat_rooms(room_id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  encrypted_key TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

--- Down migration
DROP TABLE IF EXISTS room_keys;
ALTER TABLE users DROP COLUMN IF EXISTS public_key;
