-- Banco D1 do CaloriQuest
-- Aplicar com: npx wrangler d1 execute caloriquest-db --remote --file=schema.sql

-- pass_hash/salt ficam vazios em quem entra pelo Google, e google_sub fica
-- vazio em quem entra por senha. Quem usa os dois tem tudo preenchido.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  pass_hash TEXT,
  salt TEXT,
  google_sub TEXT,
  name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google ON users(google_sub);

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
