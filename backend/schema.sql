CREATE TABLE IF NOT EXISTS users (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(50)  NOT NULL,
  role       ENUM('parent','child') NOT NULL,
  pin_hash   VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  type       ENUM('text','image','file') NOT NULL DEFAULT 'text',
  body       TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL DEFAULT NULL,
  INDEX idx_id_desc (id DESC),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS message_reads (
  message_id INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  read_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id),
  INDEX idx_read_at (read_at),
  FOREIGN KEY (message_id) REFERENCES messages(id),
  FOREIGN KEY (user_id)    REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS presence (
  user_id   INT UNSIGNED PRIMARY KEY,
  last_ping DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ログイン試行記録（IPベースのレート制限用）
CREATE TABLE IF NOT EXISTS login_attempts (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ip           VARCHAR(45) NOT NULL,
  attempted_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ip_time (ip, attempted_at)
);

-- アップロードファイルのメタデータ（実ファイルはwebroot外に保存）
CREATE TABLE IF NOT EXISTS uploads (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  orig_name   VARCHAR(255) NOT NULL,
  stored_name VARCHAR(64)  NOT NULL UNIQUE,
  mime_type   VARCHAR(100) NOT NULL,
  size        BIGINT UNSIGNED NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- SSE専用の短命トークン（URLに長期JWTを露出させないため）
CREATE TABLE IF NOT EXISTS sse_tokens (
  token      CHAR(64)     PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  expires_at DATETIME     NOT NULL,
  INDEX idx_expires (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
