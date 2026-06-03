--- Up migration
CREATE TABLE message_mentions (
    message_id UUID NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    PRIMARY KEY (message_id, user_id)
);

--- Down migration
DROP TABLE IF EXISTS message_mentions CASCADE;
