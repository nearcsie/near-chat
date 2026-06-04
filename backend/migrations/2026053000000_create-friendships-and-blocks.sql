--- Up migration
CREATE TABLE friendships (
    requester_id UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    addressee_id UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status       VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'accepted')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (requester_id, addressee_id),
    CONSTRAINT friendships_no_self_friendship CHECK (requester_id <> addressee_id)
);

CREATE TABLE blocks (
    blocker_id UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    blocked_id UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT blocks_no_self_block CHECK (blocker_id <> blocked_id)
);

--- Down migration
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
