-- Food library: one entry per food per user, with fixed nutrition per serving.
-- Plans compute every number from these values, so the planner and tracker always agree.

CREATE TABLE library_foods (
  id          TEXT    PRIMARY KEY,
  user_id     TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name        TEXT    NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
  meal        TEXT    NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
  serving     TEXT    NOT NULL CHECK (length(trim(serving)) > 0),
  calories    REAL    NOT NULL CHECK (calories >= 0),
  protein     REAL    NOT NULL DEFAULT 0 CHECK (protein >= 0),
  carbs       REAL    NOT NULL DEFAULT 0 CHECK (carbs >= 0),
  fat         REAL    NOT NULL DEFAULT 0 CHECK (fat >= 0),
  source      TEXT    NOT NULL CHECK (source IN ('logged', 'favorite', 'curated', 'ai')),
  confidence  TEXT    CHECK (confidence IN ('high', 'medium', 'low')),
  cuisine     TEXT,
  diet        TEXT    CHECK (diet IN ('veg', 'eggetarian', 'non-veg')),
  allergens   TEXT    NOT NULL DEFAULT '[]' CHECK (json_valid(allergens) AND json_type(allergens) = 'array'),
  -- Approximate ingredients per serving, for the grocery list. NULL until known.
  ingredients TEXT    CHECK (ingredients IS NULL OR (json_valid(ingredients) AND json_type(ingredients) = 'array')),
  use_count   INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  last_used   TEXT,
  created_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  UNIQUE (user_id, name)
) STRICT;
CREATE INDEX idx_library_foods_user_use ON library_foods (user_id, use_count DESC);

CREATE TRIGGER trg_library_foods_updated_at AFTER UPDATE ON library_foods WHEN NEW.updated_at IS OLD.updated_at
BEGIN UPDATE library_foods SET updated_at = CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE id = NEW.id; END;
