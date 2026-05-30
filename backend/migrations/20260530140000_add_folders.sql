-- v2 scope: folders, folder_rooms

CREATE TABLE folders (
  folder_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  name       VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE folder_rooms (
  folder_id UUID NOT NULL REFERENCES folders(folder_id) ON DELETE CASCADE,
  room_id   UUID NOT NULL REFERENCES chat_rooms(room_id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  PRIMARY KEY (folder_id, room_id),
  UNIQUE (user_id, room_id)
);