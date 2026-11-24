ALTER TABLE signin_codes ADD COLUMN challenge TEXT;
CREATE TABLE auth_attempts (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
