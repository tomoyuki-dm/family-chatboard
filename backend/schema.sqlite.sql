CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK(role IN ('parent','child','admin')),
  pin_hash   TEXT NOT NULL,
  banned_at  TEXT NULL DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS log_sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_log_current ON log_sessions(is_current);

CREATE TABLE IF NOT EXISTS messages (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL,
  log_session_id INTEGER NOT NULL DEFAULT 1,
  type           TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text','image','file')),
  body           TEXT NOT NULL,
  created_at     TEXT DEFAULT (datetime('now')),
  deleted_at     TEXT NULL DEFAULT NULL,
  FOREIGN KEY (user_id)        REFERENCES users(id),
  FOREIGN KEY (log_session_id) REFERENCES log_sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_id_desc   ON messages(id DESC);
CREATE INDEX IF NOT EXISTS idx_msg_log   ON messages(log_session_id, id);

CREATE TABLE IF NOT EXISTS message_reads (
  message_id INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  read_at    TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (message_id, user_id),
  FOREIGN KEY (message_id) REFERENCES messages(id),
  FOREIGN KEY (user_id)    REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_read_at ON message_reads(read_at);

CREATE TABLE IF NOT EXISTS presence (
  user_id   INTEGER PRIMARY KEY,
  last_ping TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ip           TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ip_time ON login_attempts(ip, attempted_at);

CREATE TABLE IF NOT EXISTS uploads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  orig_name   TEXT NOT NULL,
  stored_name TEXT NOT NULL UNIQUE,
  mime_type   TEXT NOT NULL,
  size        INTEGER NOT NULL,
  created_at  TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sse_tokens (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_expires ON sse_tokens(expires_at);
