-- Food style for meal suggestions. Existing profiles get Tamil Nadu.
ALTER TABLE profiles ADD COLUMN cuisine TEXT NOT NULL DEFAULT 'tamil-nadu'
  CHECK (cuisine IN ('tamil-nadu', 'south-indian', 'north-indian', 'any'));
