-- The organiser's music for the big-screen results reveal (admin only, never public).
-- Stored in pieces: a D1 value is limited to about 2 MB and a song is usually larger.
-- Name, type, size and timings live in settings ('reveal_song', 'reveal_times').
CREATE TABLE reveal_song_chunks (
  idx INTEGER PRIMARY KEY,
  data BLOB NOT NULL
);
