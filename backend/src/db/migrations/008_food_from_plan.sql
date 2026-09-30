-- Food entries logged from a meal plan get source 'plan'. SQLite can't change a CHECK constraint,
-- so the table is rebuilt (nothing references it).
CREATE TABLE food_entries_new (
  id          TEXT    PRIMARY KEY,
  user_id     TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  favorite_id TEXT    REFERENCES favorite_foods (id) ON DELETE SET NULL,
  date        TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(date) IS date),
  meal        TEXT    NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
  name        TEXT    NOT NULL CHECK (length(trim(name)) > 0),
  calories    REAL    NOT NULL CHECK (calories >= 0),
  protein     REAL    NOT NULL DEFAULT 0 CHECK (protein >= 0),
  carbs       REAL    NOT NULL DEFAULT 0 CHECK (carbs >= 0),
  fat         REAL    NOT NULL DEFAULT 0 CHECK (fat >= 0),
  source      TEXT    NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai-text', 'ai-photo', 'favorite', 'plan')),
  created_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  CHECK (favorite_id IS NULL OR source = 'favorite')
) STRICT;

INSERT INTO food_entries_new (id, user_id, favorite_id, date, meal, name, calories, protein, carbs, fat, source, created_at, updated_at)
  SELECT id, user_id, favorite_id, date, meal, name, calories, protein, carbs, fat, source, created_at, updated_at FROM food_entries;
DROP TABLE food_entries;
ALTER TABLE food_entries_new RENAME TO food_entries;

CREATE INDEX idx_food_entries_user_date ON food_entries (user_id, date);
CREATE INDEX idx_food_entries_favorite ON food_entries (favorite_id);
CREATE TRIGGER trg_food_entries_updated_at AFTER UPDATE ON food_entries WHEN NEW.updated_at IS OLD.updated_at
BEGIN UPDATE food_entries SET updated_at = CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE id = NEW.id; END;
