--- Up migration

CREATE OR REPLACE VIEW message_with_sender_view AS
SELECT
  m.message_id,
  m.room_id,
  m.sender_id,
  m.content,
  m.reply_to_id,
  m.is_recalled,
  m.sent_at,
  u.user_id AS sender_user_id,
  u.name AS sender_name,
  u.avatar_url AS sender_avatar_url,
  u.deleted_at AS sender_deleted_at
FROM messages m
LEFT JOIN users u ON u.user_id = m.sender_id;

CREATE OR REPLACE VIEW room_last_message_view AS
SELECT
  m.room_id,
  m.message_id,
  m.sender_id,
  m.content,
  m.sent_at
FROM messages m
WHERE NOT EXISTS (
  SELECT 1
  FROM messages newer
  WHERE newer.room_id = m.room_id
    AND (
      newer.sent_at > m.sent_at
      OR (newer.sent_at = m.sent_at AND newer.message_id > m.message_id)
    )
);

--- Down migration

DROP VIEW IF EXISTS room_last_message_view;
DROP VIEW IF EXISTS message_with_sender_view;
