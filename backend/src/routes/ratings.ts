import { Hono } from 'hono';
import type { AppEnv, AuthInfo } from '../env';
import { requireAuth } from '../lib/auth';
import { nowIso } from '../lib/db';
import { forbidden } from '../lib/errors';
import { readBody, Validator } from '../lib/validate';

/**
 * App ratings: every team member and judge can rate Tech Arena once (1-5 stars, optional
 * feedback) and change it later. The average is published as a live badge for the GitHub README.
 */
const app = new Hono<AppEnv>();

function subjectOf(auth: AuthInfo): { kind: 'participant' | 'judge'; id: string } {
  if (auth.participant) return { kind: 'participant', id: auth.participant.id };
  if (auth.judge) return { kind: 'judge', id: auth.judge.id };
  throw forbidden('Only team members and judges rate the app');
}

interface RatingRow {
  stars: number;
  feedback: string | null;
  updated_at: string;
}

const toRating = (r: RatingRow) => ({ stars: r.stars, feedback: r.feedback, updatedAt: r.updated_at });

app.get('/rating', requireAuth('lead', 'member', 'judge'), async (c) => {
  const s = subjectOf(c.get('auth'));
  const row = await c.env.DB.prepare('SELECT stars, feedback, updated_at FROM ratings WHERE subject_kind = ? AND subject_id = ?')
    .bind(s.kind, s.id)
    .first<RatingRow>();
  return c.json({ rating: row ? toRating(row) : null });
});

app.put('/rating', requireAuth('lead', 'member', 'judge'), async (c) => {
  const s = subjectOf(c.get('auth'));
  const body = await readBody(c);
  const v = new Validator(body);
  const stars = body.stars;
  if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > 5) v.fail('stars', 'Pick 1 to 5 stars');
  const feedback = v.optionalText('feedback', 'Feedback', 1, 1000, true);
  v.done();
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO ratings (subject_kind, subject_id, stars, feedback, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (subject_kind, subject_id) DO UPDATE SET stars = excluded.stars, feedback = excluded.feedback, updated_at = excluded.updated_at`,
  )
    .bind(s.kind, s.id, stars, feedback, now, now)
    .run();
  return c.json({ rating: { stars, feedback, updatedAt: now } });
});

/** Shields.io "endpoint" badge: https://img.shields.io/endpoint?url=<this URL>. Public. */
app.get('/rating/badge', async (c) => {
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS n, AVG(stars) AS avg FROM ratings').first<{ n: number; avg: number | null }>();
  const n = row?.n ?? 0;
  const avg = row?.avg ?? 0;
  c.header('Cache-Control', 'public, max-age=300');
  return c.json({
    schemaVersion: 1,
    label: 'app rating',
    message: n ? `★ ${avg.toFixed(1)} / 5 · ${n} rating${n === 1 ? '' : 's'}` : 'no ratings yet',
    color: !n ? 'lightgrey' : avg >= 4.5 ? 'brightgreen' : avg >= 4 ? 'green' : avg >= 3 ? 'yellow' : 'orange',
  });
});

export default app;
