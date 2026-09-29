-- Initial schema. Mirrors frontend/src/lib/types.ts, scoped per user.
--
-- Conventions:
--   * STRICT tables, so SQLite rejects values of the wrong type.
--   * Ids are UUID strings; dates are YYYY-MM-DD (validated); timestamps are epoch ms.
--   * Every row belongs to a user and is deleted with them (ON DELETE CASCADE).
--   * updated_at is maintained by triggers at the bottom of this file.

CREATE TABLE users (
  id         TEXT    PRIMARY KEY,
  email      TEXT    NOT NULL UNIQUE COLLATE NOCASE CHECK (email LIKE '%_@_%'),
  name       TEXT    NOT NULL CHECK (length(trim(name)) > 0),
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

-- One row per user: goals and preferences.
-- Start weight is not stored; it is the user's weight entry on start_date.
CREATE TABLE profiles (
  user_id      TEXT    PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  height_cm    REAL    NOT NULL CHECK (height_cm > 0),
  goal_weight  REAL    NOT NULL CHECK (goal_weight > 0),
  start_date   TEXT    NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(start_date) IS start_date),
  calorie_goal INTEGER NOT NULL CHECK (calorie_goal > 0),
  protein_goal REAL    NOT NULL CHECK (protein_goal >= 0),
  carbs_goal   REAL    NOT NULL CHECK (carbs_goal >= 0),
  fat_goal     REAL    NOT NULL CHECK (fat_goal >= 0),
  track_macros INTEGER NOT NULL DEFAULT 1 CHECK (track_macros IN (0, 1)),
  water_goal   INTEGER NOT NULL DEFAULT 8 CHECK (water_goal > 0),
  glass_ml     INTEGER NOT NULL DEFAULT 250 CHECK (glass_ml > 0),
  units        TEXT    NOT NULL DEFAULT 'metric' CHECK (units IN ('metric', 'imperial')),
  theme        TEXT    NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  created_at   INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at   INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;

CREATE TABLE favorite_foods (
  id         TEXT    PRIMARY KEY,
  user_id    TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name       TEXT    NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
  meal       TEXT    NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
  calories   REAL    NOT NULL CHECK (calories >= 0),
  protein    REAL    NOT NULL DEFAULT 0 CHECK (protein >= 0),
  carbs      REAL    NOT NULL DEFAULT 0 CHECK (carbs >= 0),
  fat        REAL    NOT NULL DEFAULT 0 CHECK (fat >= 0),
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  UNIQUE (user_id, name)
) STRICT;

-- Name and nutrition are a snapshot: editing or deleting a favorite does not change past entries.
CREATE TABLE food_entries (
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
  source      TEXT    NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai-text', 'ai-photo', 'favorite')),
  created_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  CHECK (favorite_id IS NULL OR source = 'favorite')
) STRICT;
CREATE INDEX idx_food_entries_user_date ON food_entries (user_id, date);
CREATE INDEX idx_food_entries_favorite ON food_entries (favorite_id);

CREATE TABLE weight_entries (
  id         TEXT    PRIMARY KEY,
  user_id    TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  date       TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(date) IS date),
  weight     REAL    NOT NULL CHECK (weight > 0), -- kg
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  UNIQUE (user_id, date)
) STRICT;

CREATE TABLE measurement_entries (
  id         TEXT    PRIMARY KEY,
  user_id    TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  date       TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(date) IS date),
  waist      REAL    CHECK (waist > 0), -- cm
  hips       REAL    CHECK (hips > 0),
  chest      REAL    CHECK (chest > 0),
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  UNIQUE (user_id, date),
  CHECK (coalesce(waist, hips, chest) IS NOT NULL)
) STRICT;

CREATE TABLE exercise_entries (
  id         TEXT    PRIMARY KEY,
  user_id    TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  date       TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(date) IS date),
  name       TEXT    NOT NULL CHECK (length(trim(name)) > 0),
  minutes    INTEGER NOT NULL CHECK (minutes > 0),
  calories   REAL    NOT NULL CHECK (calories >= 0),
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;
CREATE INDEX idx_exercise_entries_user_date ON exercise_entries (user_id, date);

CREATE TABLE journal_entries (
  user_id     TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  date        TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(date) IS date),
  mood        INTEGER CHECK (mood BETWEEN 1 AND 5),
  energy      INTEGER CHECK (energy BETWEEN 1 AND 3),
  sleep_hours REAL    CHECK (sleep_hours BETWEEN 0 AND 24),
  cravings    INTEGER CHECK (cravings BETWEEN 0 AND 3),
  note        TEXT,
  created_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at  INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (user_id, date)
) STRICT;

CREATE TABLE water_entries (
  user_id    TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  date       TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(date) IS date),
  glasses    INTEGER NOT NULL CHECK (glasses BETWEEN 0 AND 30),
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (user_id, date)
) STRICT;

-- Keep updated_at current. The WHEN clause stops the trigger from re-firing on its own update.
CREATE TRIGGER trg_users_updated_at AFTER UPDATE ON users WHEN NEW.updated_at IS OLD.updated_at
BEGIN UPDATE users SET updated_at = CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE id = NEW.id; END;

CREATE TRIGGER trg_profiles_updated_at AFTER UPDATE ON profiles WHEN NEW.updated_at IS OLD.updated_at
BEGIN UPDATE profiles SET updated_at = CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE user_id = NEW.user_id; END;

CREATE TRIGGER trg_favorite_foods_updated_at AFTER UPDATE ON favorite_foods WHEN NEW.updated_at IS OLD.updated_at
BEGIN UPDATE favorite_foods SET updated_at = CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE id = NEW.id; END;

CREATE TRIGGER trg_food_entries_updated_at AFTER UPDATE ON food_entries WHEN NEW.updated_at IS OLD.updated_at
BEGIN UPDATE food_entries SET updated_at = CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE id = NEW.id; END;

CREATE TRIGGER trg_weight_entries_updated_at AFTER UPDATE ON weight_entries WHEN NEW.updated_at IS OLD.updated_at
BEGIN UPDATE weight_entries SET updated_at = CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE id = NEW.id; END;

CREATE TRIGGER trg_measurement_entries_updated_at AFTER UPDATE ON measurement_entries WHEN NEW.updated_at IS OLD.updated_at
BEGIN UPDATE measurement_entries SET updated_at = CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE id = NEW.id; END;

CREATE TRIGGER trg_exercise_entries_updated_at AFTER UPDATE ON exercise_entries WHEN NEW.updated_at IS OLD.updated_at
BEGIN UPDATE exercise_entries SET updated_at = CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE id = NEW.id; END;

CREATE TRIGGER trg_journal_entries_updated_at AFTER UPDATE ON journal_entries WHEN NEW.updated_at IS OLD.updated_at
BEGIN UPDATE journal_entries SET updated_at = CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE user_id = NEW.user_id AND date = NEW.date; END;

CREATE TRIGGER trg_water_entries_updated_at AFTER UPDATE ON water_entries WHEN NEW.updated_at IS OLD.updated_at
BEGIN UPDATE water_entries SET updated_at = CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE user_id = NEW.user_id AND date = NEW.date; END;
