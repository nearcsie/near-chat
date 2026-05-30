export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE message_mentions (
      message_id UUID NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      PRIMARY KEY (message_id, user_id)
    );
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS message_mentions CASCADE;
  `);
};
