CREATE TABLE thiskicks_pitches (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_key TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX thiskicks_pitches_by_owner ON thiskicks_pitches(owner_id,created_at);
CREATE TABLE thiskicks_comments (
  id TEXT PRIMARY KEY,
  pitch_id TEXT NOT NULL REFERENCES thiskicks_pitches(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  actor TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX thiskicks_comments_by_pitch ON thiskicks_comments(pitch_id,created_at);
CREATE INDEX thiskicks_comments_by_actor ON thiskicks_comments(actor,created_at);
CREATE TABLE thiskicks_votes (
  pitch_id TEXT NOT NULL REFERENCES thiskicks_pitches(id) ON DELETE CASCADE,
  voter TEXT NOT NULL,
  PRIMARY KEY(pitch_id,voter)
);
