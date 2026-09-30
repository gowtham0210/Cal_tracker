-- Food preferences for the planner. Diet type defaults to non-veg, which rules nothing out.
ALTER TABLE profiles ADD COLUMN diet_type TEXT NOT NULL DEFAULT 'non-veg' CHECK (diet_type IN ('veg', 'eggetarian', 'non-veg'));
ALTER TABLE profiles ADD COLUMN allergies TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(allergies) AND json_type(allergies) = 'array');
ALTER TABLE profiles ADD COLUMN budget TEXT NOT NULL DEFAULT 'medium' CHECK (budget IN ('low', 'medium', 'high'));
-- A daily budget in rupees; when set, it is used instead of the level.
ALTER TABLE profiles ADD COLUMN daily_budget INTEGER CHECK (daily_budget IS NULL OR daily_budget > 0);
