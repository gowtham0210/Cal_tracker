-- Plan templates: a saved week, as weekday offsets, that can be applied to any week.
-- Items don't reference library_foods, so deleting a food never touches templates; foods that
-- no longer exist are skipped when a template is shown or applied.

CREATE TABLE plan_templates (
  id         TEXT    PRIMARY KEY,
  user_id    TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name       TEXT    NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  UNIQUE (user_id, name)
) STRICT;

CREATE TABLE template_items (
  id          TEXT    PRIMARY KEY,
  template_id TEXT    NOT NULL REFERENCES plan_templates (id) ON DELETE CASCADE,
  day_offset  INTEGER NOT NULL CHECK (day_offset BETWEEN 0 AND 6),
  meal        TEXT    NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id     TEXT    NOT NULL,
  quantity    REAL    NOT NULL CHECK (quantity >= 0.25 AND quantity <= 10 AND quantity * 4 = CAST(quantity * 4 AS INTEGER)),
  position    INTEGER NOT NULL CHECK (position >= 0)
) STRICT;
CREATE INDEX idx_template_items_template ON template_items (template_id, day_offset, meal, position);
