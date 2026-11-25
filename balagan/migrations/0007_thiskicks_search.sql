CREATE INDEX thiskicks_board_order ON thiskicks_pitches(created_at, id);
CREATE INDEX thiskicks_board_with_image ON thiskicks_pitches(created_at, id) WHERE image_key IS NOT NULL;
CREATE VIRTUAL TABLE thiskicks_pitch_search USING fts5(title, body, content='thiskicks_pitches', content_rowid='rowid');
INSERT INTO thiskicks_pitch_search(thiskicks_pitch_search) VALUES('rebuild');
CREATE TRIGGER thiskicks_search_insert AFTER INSERT ON thiskicks_pitches BEGIN
  INSERT INTO thiskicks_pitch_search(rowid,title,body) VALUES(new.rowid,new.title,new.body);
END;
