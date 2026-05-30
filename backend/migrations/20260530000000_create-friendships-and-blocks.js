/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE friendships (
      requester_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      addressee_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'accepted')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (requester_id, addressee_id)
    );

    CREATE TABLE blocks (
      blocker_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      blocked_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (blocker_id, blocked_id)
    );
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS blocks CASCADE;
    DROP TABLE IF EXISTS friendships CASCADE;
  `);
};
