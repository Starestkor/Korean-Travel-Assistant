CREATE TABLE IF NOT EXISTS photo_spots (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  place_name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')),
  latitude REAL,
  longitude REAL,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_photo_spots_owner_created ON photo_spots(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_spots_public_created ON photo_spots(visibility, created_at DESC);
