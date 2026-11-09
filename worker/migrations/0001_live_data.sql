-- MACROSCOPE Live Data Gateway schema.
-- Apply with: npx wrangler d1 migrations apply macroscope-data --remote

CREATE TABLE IF NOT EXISTS live_series_catalog (
  series_key TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT,
  frequency TEXT,
  units TEXT,
  source_agency TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS live_latest (
  series_key TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  observation_date TEXT NOT NULL,
  model_value REAL NOT NULL,
  previous_date TEXT,
  previous_model_value REAL,
  raw_value REAL,
  raw_previous REAL,
  provider TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS live_observation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  series_key TEXT NOT NULL,
  series_id TEXT NOT NULL,
  observation_date TEXT NOT NULL,
  model_value REAL NOT NULL,
  raw_value REAL,
  provider TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_history_unique
  ON live_observation_history(series_key, observation_date, model_value);
CREATE INDEX IF NOT EXISTS idx_live_history_series_date
  ON live_observation_history(series_key, observation_date DESC, first_seen_at DESC);

CREATE TABLE IF NOT EXISTS live_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  series_key TEXT NOT NULL,
  series_id TEXT NOT NULL,
  observation_date TEXT NOT NULL,
  old_value REAL NOT NULL,
  new_value REAL NOT NULL,
  detected_at TEXT NOT NULL,
  provider TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_live_revisions_detected
  ON live_revisions(detected_at DESC);

CREATE TABLE IF NOT EXISTS live_sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  requested_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  details_json TEXT
);
