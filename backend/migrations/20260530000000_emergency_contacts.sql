CREATE TABLE emergency_contacts (
  user_id    UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  contact_id UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  message    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, contact_id)
);
