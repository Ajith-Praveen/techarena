-- Profile photos (participants + judges) and judge tie-break votes.
ALTER TABLE participants ADD COLUMN photo_id TEXT;  -- images.id; required by the app gate
ALTER TABLE judges ADD COLUMN photo_id TEXT;        -- images.id

CREATE TABLE tie_votes (
  judge_id TEXT NOT NULL REFERENCES judges(id),
  group_key TEXT NOT NULL,                -- sorted team ids joined by ','
  ordering TEXT NOT NULL,                 -- JSON string[] of team ids, best first
  updated_at TEXT NOT NULL,
  PRIMARY KEY (judge_id, group_key)
);
