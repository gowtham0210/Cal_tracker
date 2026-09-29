-- Weekly meal plans. Items reference library foods; all nutrition is computed from the library.

CREATE TABLE meal_plans (
  id             TEXT    PRIMARY KEY,
  user_id        TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  week_start     TEXT    NOT NULL CHECK (week_start GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(week_start) IS week_start AND strftime('%w', week_start) = '1'),
  status         TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft')),
  source         TEXT    CHECK (source IN ('manual', 'ai', 'rules', 'template')),
  -- While a draft is open, the items it replaced, so Discard can restore them.
  previous_items TEXT    CHECK (previous_items IS NULL OR json_valid(previous_items)),
  created_at     INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at     INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  UNIQUE (user_id, week_start)
) STRICT;

CREATE TABLE plan_items (
  id         TEXT    PRIMARY KEY,
  plan_id    TEXT    NOT NULL REFERENCES meal_plans (id) ON DELETE CASCADE,
  date       TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(date) IS date),
  meal       TEXT    NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
  -- Deleting a library food that is still planned is refused.
  food_id    TEXT    NOT NULL REFERENCES library_foods (id) ON DELETE RESTRICT,
  quantity   REAL    NOT NULL CHECK (quantity >= 0.25 AND quantity <= 10 AND quantity * 4 = CAST(quantity * 4 AS INTEGER)),
  position   INTEGER NOT NULL CHECK (position >= 0),
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
) STRICT;
CREATE INDEX idx_plan_items_plan_slot ON plan_items (plan_id, date, meal, position);
CREATE INDEX idx_plan_items_food ON plan_items (food_id);

CREATE TRIGGER trg_meal_plans_updated_at AFTER UPDATE ON meal_plans WHEN NEW.updated_at IS OLD.updated_at
BEGIN UPDATE meal_plans SET updated_at = CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE id = NEW.id; END;
