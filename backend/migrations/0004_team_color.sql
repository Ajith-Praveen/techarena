-- Each team picks a banner colour from a fixed palette; no two teams may share one.
ALTER TABLE teams ADD COLUMN color TEXT;
CREATE UNIQUE INDEX idx_teams_color ON teams (color) WHERE color IS NOT NULL;
