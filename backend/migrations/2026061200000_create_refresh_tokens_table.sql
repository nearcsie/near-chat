--- Up migration
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash       VARCHAR(255) NOT NULL UNIQUE,
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at       TIMESTAMPTZ DEFAULT NULL,
  replaced_by      UUID REFERENCES refresh_tokens(token_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
-- Partial index for the revokeAllForUser hot path (active tokens only).
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active ON refresh_tokens(user_id) WHERE revoked_at IS NULL;

--- Down migration
DROP TABLE IF EXISTS refresh_tokens;
