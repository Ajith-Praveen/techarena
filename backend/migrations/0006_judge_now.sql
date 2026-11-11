-- Which team each judge is currently at (set when they open a team by its code). Drives the
-- "you're next" / "you're after next" alerts on the teams' phones.
CREATE TABLE judge_now (
  judge_id TEXT PRIMARY KEY REFERENCES judges(id),
  team_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
