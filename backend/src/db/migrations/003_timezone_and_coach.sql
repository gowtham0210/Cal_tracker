-- Lets the server work out "today" for each user, and stores the AI coach conversation.

ALTER TABLE profiles ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'UTC' CHECK (length(time_zone) BETWEEN 1 AND 64);

CREATE TABLE coach_messages (
  id         TEXT    PRIMARY KEY,
  user_id    TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role       TEXT    NOT NULL CHECK (role IN ('user', 'assistant')),
  text       TEXT    NOT NULL CHECK (length(text) > 0),
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;
CREATE INDEX idx_coach_messages_user_created ON coach_messages (user_id, created_at, id);
