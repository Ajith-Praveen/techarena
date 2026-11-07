-- Tech Arena initial schema
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,          -- lower(trim(name))
  code TEXT NOT NULL UNIQUE,              -- 4 digits
  project_title TEXT NOT NULL,
  project_desc TEXT NOT NULL,
  image_id TEXT,
  password_hash TEXT NOT NULL,
  order_position INTEGER,                 -- NULL until order generated
  created_at TEXT NOT NULL
);

CREATE TABLE participants (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('lead','member')),
  name TEXT NOT NULL,
  usn TEXT,
  phone TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE judges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,          -- lowercased
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE evaluations (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  judge_id TEXT NOT NULL REFERENCES judges(id),
  scores TEXT NOT NULL,                   -- JSON {criterionKey: int}
  total INTEGER NOT NULL,
  remarks TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (team_id, judge_id)
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('lead','member','judge','admin')),
  subject_id TEXT NOT NULL,               -- participant id, judge id, or 'admin'
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE images (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start TEXT NOT NULL);

CREATE INDEX idx_participants_team_id ON participants(team_id);
CREATE INDEX idx_teams_order_position ON teams(order_position);
CREATE INDEX idx_evaluations_team_id ON evaluations(team_id);
CREATE INDEX idx_evaluations_judge_id ON evaluations(judge_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_subject ON sessions(role, subject_id);

INSERT INTO settings (key, value) VALUES ('registration_open', '1');
