-- One app rating per person (team member or judge); they can update it later.
CREATE TABLE ratings (
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('participant', 'judge')),
  subject_id TEXT NOT NULL,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  feedback TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (subject_kind, subject_id)
);
