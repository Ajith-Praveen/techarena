import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { nowIso } from '../lib/db';
import { badRequest, notFound } from '../lib/errors';
import { deleteSettingStmt, setSettingStmt } from '../lib/settings';

/**
 * Music + timings for the big-screen results reveal. Admin only: the song is the organiser's own copy, kept so
 * the show can run with music from any browser the admin signs in on. It is never served to anyone else.
 */
const app = new Hono<AppEnv>();

app.use('*', requireAuth('admin'));

const MAX_SONG_BYTES = 20 * 1024 * 1024;
const CHUNK_BYTES = 1_000_000;
const SONG_KEY = 'reveal_song';
const TIMES_KEY = 'reveal_times';
const TIME_FIELDS = ['countdown', 'zero', 'congrats', 'top3', 'build3', 'third', 'second', 'build1', 'first', 'finale', 'bpm', 'beat'];

interface SongMeta {
  name: string;
  mime: string;
  size: number;
  chunks: number;
  updatedAt: string;
}

async function readSetting<T>(db: D1Database, key: string): Promise<T | null> {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string | null }>();
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

function toBytes(data: ArrayBuffer | ArrayBufferView | number[]): Uint8Array {
  if (Array.isArray(data)) return Uint8Array.from(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

/** What is saved: the song's details (not the audio) and the timeline. */
app.get('/', async (c) => {
  const db = c.env.DB;
  const [song, times] = await Promise.all([readSetting<SongMeta>(db, SONG_KEY), readSetting<Record<string, number>>(db, TIMES_KEY)]);
  return c.json({
    song: song ? { name: song.name, mime: song.mime, size: song.size, updatedAt: song.updatedAt } : null,
    times,
  });
});

/** Upload (or replace) the song. Raw audio bytes in the body; file name in ?name=. */
app.put('/song', async (c) => {
  const db = c.env.DB;
  const mime = (c.req.header('Content-Type') ?? '').split(';')[0]!.trim().toLowerCase() || 'audio/mpeg';
  if (!mime.startsWith('audio/') && mime !== 'application/octet-stream') throw badRequest('Please choose an audio file (MP3, M4A, WAV).');
  const declared = Number(c.req.header('Content-Length') ?? '0');
  if (declared > MAX_SONG_BYTES) throw badRequest('That file is too big (max 20 MB).');
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength === 0) throw badRequest('The file is empty.');
  if (bytes.byteLength > MAX_SONG_BYTES) throw badRequest('That file is too big (max 20 MB).');
  const name = (c.req.query('name') ?? 'song').trim().slice(0, 160) || 'song';

  const chunks: D1PreparedStatement[] = [];
  for (let i = 0, idx = 0; i < bytes.byteLength; i += CHUNK_BYTES, idx++) {
    chunks.push(db.prepare('INSERT INTO reveal_song_chunks (idx, data) VALUES (?, ?)').bind(idx, bytes.slice(i, i + CHUNK_BYTES).buffer));
  }
  const meta: SongMeta = {
    name,
    mime: mime === 'application/octet-stream' ? 'audio/mpeg' : mime,
    size: bytes.byteLength,
    chunks: chunks.length,
    updatedAt: nowIso(),
  };
  await db.batch([db.prepare('DELETE FROM reveal_song_chunks'), ...chunks, setSettingStmt(db, SONG_KEY, JSON.stringify(meta))]);
  return c.json({ song: { name: meta.name, mime: meta.mime, size: meta.size, updatedAt: meta.updatedAt } });
});

/** Download the song (admin only). */
app.get('/song', async (c) => {
  const db = c.env.DB;
  const meta = await readSetting<SongMeta>(db, SONG_KEY);
  if (!meta) throw notFound('No song has been uploaded yet.');
  const out = new Uint8Array(meta.size);
  let at = 0;
  for (let idx = 0; idx < meta.chunks; idx++) {
    const row = await db
      .prepare('SELECT data FROM reveal_song_chunks WHERE idx = ?')
      .bind(idx)
      .first<{ data: ArrayBuffer | ArrayBufferView | number[] }>();
    if (!row) throw notFound('The saved song is incomplete. Please upload it again.');
    const part = toBytes(row.data);
    if (at + part.byteLength > out.byteLength) throw notFound('The saved song is damaged. Please upload it again.');
    out.set(part, at);
    at += part.byteLength;
  }
  if (at !== meta.size) throw notFound('The saved song is incomplete. Please upload it again.');
  return c.body(out, 200, {
    'Content-Type': meta.mime,
    'Content-Length': String(meta.size),
    'Cache-Control': 'private, no-store',
  });
});

app.delete('/song', async (c) => {
  const db = c.env.DB;
  await db.batch([db.prepare('DELETE FROM reveal_song_chunks'), deleteSettingStmt(db, SONG_KEY)]);
  return c.json({ ok: true });
});

/** Save the timeline (seconds into the song for each moment, plus the beat grid). */
app.put('/times', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body || typeof body !== 'object') throw badRequest('Send the timings as JSON.');
  const times: Record<string, number> = {};
  for (const k of TIME_FIELDS) {
    const v = body[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 3600) throw badRequest(`"${k}" must be a number of seconds.`);
    times[k] = Math.round(v * 1000) / 1000;
  }
  await setSettingStmt(c.env.DB, TIMES_KEY, JSON.stringify(times)).run();
  return c.json({ times });
});

export default app;
