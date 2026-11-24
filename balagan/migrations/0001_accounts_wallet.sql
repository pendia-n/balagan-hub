CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE signin_codes (
  digest TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  audience TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE checkout_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  offer_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  stripe_session_id TEXT UNIQUE,
  state TEXT NOT NULL CHECK (state IN ('pending', 'paid', 'refunded', 'expired')),
  created_at INTEGER NOT NULL
);
CREATE TABLE billing_entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  offer_id TEXT NOT NULL,
  paid_until INTEGER,
  next_refill_at INTEGER,
  status TEXT NOT NULL
);
CREATE INDEX billing_entitlements_user ON billing_entitlements(user_id);
CREATE TABLE token_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX token_grants_user ON token_grants(user_id, expires_at);
CREATE TABLE game_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  game TEXT NOT NULL,
  round_id TEXT NOT NULL,
  cost INTEGER NOT NULL CHECK (cost >= 0),
  free_day TEXT,
  state TEXT NOT NULL CHECK (state IN ('reserved', 'spent', 'released')),
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, game, round_id)
);
CREATE UNIQUE INDEX one_daily_free_entry ON game_entries(user_id, game, free_day)
  WHERE free_day IS NOT NULL AND state != 'released';
CREATE TABLE token_allocations (
  entry_id TEXT NOT NULL REFERENCES game_entries(id),
  grant_id TEXT NOT NULL REFERENCES token_grants(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  PRIMARY KEY(entry_id, grant_id)
);
