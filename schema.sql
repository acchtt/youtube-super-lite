CREATE TABLE IF NOT EXISTS app_state (
  client_id TEXT PRIMARY KEY,
  settings_json TEXT,
  last_video_json TEXT,
  last_playlist_json TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  client_id TEXT PRIMARY KEY,
  profile_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT,
  channel TEXT,
  source TEXT,
  list_id TEXT,
  played_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_client_played
ON history (client_id, played_at DESC, id DESC);
