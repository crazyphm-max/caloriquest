-- Banco D1 do CaloriQuest
-- Aplicar com: npx wrangler d1 execute caloriquest-db --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS states (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  data TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
