CREATE TABLE game_reward_rounds (
 id TEXT PRIMARY KEY,
 results_json TEXT NOT NULL CHECK(json_valid(results_json)),
 created_at INTEGER NOT NULL
);
