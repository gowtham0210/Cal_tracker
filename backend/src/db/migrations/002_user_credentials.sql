-- Password credentials, kept apart from users so other sign-in methods can be added later.
-- password_hash is a PHC string, e.g. $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>.

CREATE TABLE user_credentials (
  user_id       TEXT    PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  password_hash TEXT    NOT NULL CHECK (password_hash LIKE '$argon2id$%'),
  created_at    INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at    INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

CREATE TRIGGER trg_user_credentials_updated_at AFTER UPDATE ON user_credentials WHEN NEW.updated_at IS OLD.updated_at
BEGIN UPDATE user_credentials SET updated_at = CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE user_id = NEW.user_id; END;
