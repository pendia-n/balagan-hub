CREATE TABLE thiskicks_monthly_votes (
 pitch_id TEXT NOT NULL REFERENCES thiskicks_pitches(id),
 voter TEXT NOT NULL REFERENCES users(id),
 created_at INTEGER NOT NULL,
 PRIMARY KEY(pitch_id,voter)
);
CREATE INDEX thiskicks_monthly_vote_time ON thiskicks_monthly_votes(created_at,pitch_id);
CREATE TABLE thiskicks_reward_months (
 month TEXT PRIMARY KEY,
 results_json TEXT NOT NULL CHECK(json_valid(results_json)),
 closed_at INTEGER NOT NULL
);
