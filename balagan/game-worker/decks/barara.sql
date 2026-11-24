CREATE TABLE IF NOT EXISTS prompt_deck (id TEXT PRIMARY KEY, template TEXT NOT NULL, slots_json TEXT NOT NULL CHECK(json_valid(slots_json)));
INSERT INTO prompt_deck VALUES ('B001','The missing cookie|The accused was seen near an empty plate and a trail of crumbs.','{}') ON CONFLICT(id) DO UPDATE SET template=excluded.template,slots_json=excluded.slots_json;
INSERT INTO prompt_deck VALUES ('B002','The borrowed umbrella|A yellow umbrella disappeared just before it rained.','{}') ON CONFLICT(id) DO UPDATE SET template=excluded.template,slots_json=excluded.slots_json;
