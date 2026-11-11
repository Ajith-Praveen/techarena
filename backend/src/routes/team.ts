import { Hono } from 'hono';
import { CRITERIA, MAX_PER_JUDGE } from '../criteria';
import type { AppEnv } from '../env';
import { requireAuth, requireLead, requireParticipant } from '../lib/auth';
import { hashPassword, verifyPassword } from '../lib/crypto';
import type { EvaluationRow, ParticipantRow } from '../lib/db';
import {
  countRows,
  getTeam,
  loadJudgeLabels,
  loadMembers,
  nowIso,
  sortByJudgeLabel,
  toEvaluation,
  toMember,
  toTeam,
} from '../lib/db';
import type { EmailStatus } from '../lib/email';
import { sendLoginEmail } from '../lib/email';
import { badRequest, conflict, isConstraintError, notFound, registrationClosed, unauthorized, validation } from '../lib/errors';
import { round2, TOP_N } from '../lib/ranking';
import { getEventState, REGISTRATION_OPEN_SQL, RESULTS_NOT_PUBLISHED_SQL } from '../lib/settings';
import { loadStandings } from '../lib/standings';
import { readBody, Validator } from '../lib/validate';
import { countryCode, maxTeamSize } from './public';
import { COLOR_TAKEN } from '../teamColors';

const app = new Hono<AppEnv>();

app.use('*', requireAuth('lead', 'member'));

async function assertRegistrationOpen(db: D1Database) {
  if (!(await getEventState(db)).registrationOpen) throw registrationClosed();
}

app.get('/', async (c) => {
  const { team } = requireParticipant(c.get('auth'));
  const members = await loadMembers(c.env.DB, team.id);
  return c.json({ team: toTeam(team), members });
});

app.put('/', async (c) => {
  const db = c.env.DB;
  const { team } = requireLead(c.get('auth'));
  const body = await readBody(c);
  await assertRegistrationOpen(db);

  const v = new Validator(body);
  const projectTitle = v.has('projectTitle') ? v.text('projectTitle', 'Project title', 3, 80) : undefined;
  const projectDesc = v.has('projectDesc') ? v.longText('projectDesc', 'Project description', 10, 1000) : undefined;
  const image = v.has('imageBase64') || v.has('imageMime') ? v.image('imageBase64', 'imageMime') : undefined;
  v.done();

  const now = nowIso();
  const stmts: D1PreparedStatement[] = [];
  if (projectTitle !== undefined) {
    stmts.push(db.prepare('UPDATE teams SET project_title = ? WHERE id = ?').bind(projectTitle, team.id));
  }
  if (projectDesc !== undefined) {
    stmts.push(db.prepare('UPDATE teams SET project_desc = ? WHERE id = ?').bind(projectDesc, team.id));
  }
  if (image) {
    const imageId = crypto.randomUUID();
    stmts.push(
      db.prepare('INSERT INTO images (id, mime, data, created_at) VALUES (?, ?, ?, ?)').bind(imageId, image.mime, image.bytes.buffer, now),
      db.prepare('UPDATE teams SET image_id = ? WHERE id = ?').bind(imageId, team.id),
    );
    if (team.image_id) stmts.push(db.prepare('DELETE FROM images WHERE id = ?').bind(team.image_id));
  }
  if (stmts.length) await db.batch(stmts);
  const updated = (await getTeam(db, team.id))!;
  return c.json({ team: toTeam(updated) });
});

// The poster can be added or replaced until the first judge scores the team (registration may be closed).
app.put('/poster', async (c) => {
  const db = c.env.DB;
  const { team } = requireLead(c.get('auth'));
  const v = new Validator(await readBody(c));
  const poster = v.image('posterBase64', 'posterMime', 'Poster');
  v.done();

  const posterId = crypto.randomUUID();
  const unlocked = `${RESULTS_NOT_PUBLISHED_SQL} AND NOT EXISTS (SELECT 1 FROM evaluations WHERE team_id = ?)`;
  const [, updated] = await db.batch([
    db
      .prepare(`INSERT INTO images (id, mime, data, created_at) SELECT ?, ?, ?, ? WHERE ${unlocked}`)
      .bind(posterId, poster!.mime, poster!.bytes.buffer, nowIso(), team.id),
    db.prepare(`UPDATE teams SET poster_id = ? WHERE id = ? AND ${unlocked}`).bind(posterId, team.id, team.id),
  ]);
  if (!updated || updated.meta.changes === 0) {
    await db.prepare('DELETE FROM images WHERE id = ?').bind(posterId).run();
    throw conflict('The poster is locked once the judges have started scoring your team');
  }
  if (team.poster_id) await db.prepare('DELETE FROM images WHERE id = ?').bind(team.poster_id).run();
  return c.json({ team: toTeam((await getTeam(db, team.id))!) });
});

// Remove an uploaded poster so the app shows the auto-generated one again (same lock as uploading).
app.delete('/poster', async (c) => {
  const db = c.env.DB;
  const { team } = requireLead(c.get('auth'));
  if (!team.poster_id) return c.json({ team: toTeam(team) });
  const unlocked = `${RESULTS_NOT_PUBLISHED_SQL} AND NOT EXISTS (SELECT 1 FROM evaluations WHERE team_id = ?)`;
  const res = await db.prepare(`UPDATE teams SET poster_id = NULL WHERE id = ? AND ${unlocked}`).bind(team.id, team.id).run();
  if (res.meta.changes === 0) throw conflict('The poster is locked once the judges have started scoring your team');
  await db.prepare('DELETE FROM images WHERE id = ?').bind(team.poster_id).run();
  return c.json({ team: toTeam((await getTeam(db, team.id))!) });
});

// Team banner colour: any time, as long as no other team has it.
app.put('/color', async (c) => {
  const db = c.env.DB;
  const { team } = requireLead(c.get('auth'));
  const v = new Validator(await readBody(c));
  const color = v.teamColor('color', true);
  v.done();
  if (color !== team.color) {
    try {
      await db.prepare('UPDATE teams SET color = ? WHERE id = ?').bind(color, team.id).run();
    } catch (err) {
      if (isConstraintError(err, 'teams.color')) throw conflict('Colour taken', { color: COLOR_TAKEN });
      throw err;
    }
  }
  return c.json({ team: toTeam((await getTeam(db, team.id))!) });
});

app.post('/members', async (c) => {
  const db = c.env.DB;
  const { team } = requireLead(c.get('auth'));
  const body = await readBody(c);
  await assertRegistrationOpen(db);

  const v = new Validator(body);
  const name = v.text('name', 'Name', 2, 60);
  const phone = v.phone('phone', countryCode(c.env));
  const email = v.email('email');
  const usn = v.usn('usn', false);
  const photo = v.has('photoBase64') || v.has('photoMime') ? v.image('photoBase64', 'photoMime', 'Profile photo') : null;
  v.done();

  const max = maxTeamSize(c.env);
  const phoneTaken = await db.prepare('SELECT 1 FROM participants WHERE phone = ?').bind(phone).first();
  if (phoneTaken) throw conflict('Phone already registered', { phone: 'This phone number is already registered' });
  const size = await countRows(db, 'SELECT COUNT(*) AS n FROM participants WHERE team_id = ?', team.id);
  if (size >= max) throw conflict(`A team can have at most ${max} people including the lead`);

  const row: ParticipantRow = {
    id: crypto.randomUUID(),
    team_id: team.id,
    role: 'member',
    name,
    usn,
    photo_id: photo ? crypto.randomUUID() : null,
    phone,
    email,
    created_at: nowIso(),
  };
  let changes = 0;
  try {
    // Guarded so concurrent adds cannot exceed the size limit or slip in after registration closes.
    const insert = db
      .prepare(
        `INSERT INTO participants (id, team_id, role, name, usn, photo_id, phone, email, created_at)
         SELECT ?, ?, 'member', ?, ?, ?, ?, ?, ?
         WHERE ${REGISTRATION_OPEN_SQL} AND (SELECT COUNT(*) FROM participants WHERE team_id = ?) < ?`,
      )
      .bind(row.id, row.team_id, row.name, row.usn, row.photo_id, row.phone, row.email, row.created_at, team.id, max);
    if (photo && row.photo_id) {
      const [result] = await db.batch([
        insert,
        db
          .prepare('INSERT INTO images (id, mime, data, created_at) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM participants WHERE id = ?)')
          .bind(row.photo_id, photo.mime, photo.bytes.buffer, row.created_at, row.id),
      ]);
      changes = result?.meta.changes ?? 0;
    } else {
      changes = (await insert.run()).meta.changes;
    }
  } catch (err) {
    if (isConstraintError(err, 'participants.phone')) {
      throw conflict('Phone already registered', { phone: 'This phone number is already registered' });
    }
    throw err;
  }
  if (changes === 0) {
    await assertRegistrationOpen(db);
    throw conflict(`A team can have at most ${max} people including the lead`);
  }
  return c.json({ member: toMember(row) }, 201);
});

app.delete('/members/:id', async (c) => {
  const db = c.env.DB;
  const { team } = requireLead(c.get('auth'));
  await assertRegistrationOpen(db);
  const member = await db
    .prepare('SELECT * FROM participants WHERE id = ? AND team_id = ?')
    .bind(c.req.param('id'), team.id)
    .first<ParticipantRow>();
  if (!member) throw notFound('Member not found in your team');
  if (member.role === 'lead') throw badRequest('The team lead cannot be removed');
  const stmts = [
    db.prepare("DELETE FROM sessions WHERE role IN ('lead', 'member') AND subject_id = ?").bind(member.id),
    db.prepare('DELETE FROM participants WHERE id = ?').bind(member.id),
  ];
  if (member.photo_id) stmts.push(db.prepare('DELETE FROM images WHERE id = ?').bind(member.photo_id));
  await db.batch(stmts);
  return c.json({ ok: true });
});

app.post('/password', async (c) => {
  const db = c.env.DB;
  const { team } = requireLead(c.get('auth'));
  const v = new Validator(await readBody(c));
  const currentPassword = v.secret('currentPassword', 'Current password');
  const newPassword = v.password('newPassword', 'New password');
  v.done();
  if (!(await verifyPassword(currentPassword, team.password_hash))) {
    throw validation({ currentPassword: 'Current password is incorrect' }, 'Current password is incorrect');
  }
  await db.prepare('UPDATE teams SET password_hash = ? WHERE id = ?').bind(await hashPassword(newPassword), team.id).run();
  return c.json({ ok: true });
});

app.post('/notify', async (c) => {
  const { participant: lead, team } = requireLead(c.get('auth'));
  const body = await readBody(c);
  const v = new Validator(body);
  const password = v.secret('password');
  const rawIds = body.memberIds;
  if (rawIds !== undefined && rawIds !== null && (!Array.isArray(rawIds) || rawIds.some((id) => typeof id !== 'string'))) {
    v.fail('memberIds', 'memberIds must be a list of member ids');
  }
  v.done();

  if (!(await verifyPassword(password, team.password_hash))) throw unauthorized('Team password is incorrect');

  const { results: participants } = await c.env.DB.prepare(
    "SELECT * FROM participants WHERE team_id = ? ORDER BY CASE role WHEN 'lead' THEN 0 ELSE 1 END, created_at, id",
  )
    .bind(team.id)
    .all<ParticipantRow>();

  let targets: ParticipantRow[];
  if (Array.isArray(rawIds)) {
    const ids = new Set(rawIds as string[]);
    targets = participants.filter((p) => ids.has(p.id));
    if (targets.length !== ids.size) throw validation({ memberIds: 'Some members are not in your team' });
  } else {
    targets = participants.filter((p) => p.id !== lead.id);
  }

  const results = await Promise.all(
    targets.map(async (p) => {
      const outcome = await sendLoginEmail(c.env, {
        memberName: p.name,
        email: p.email,
        phone: p.phone,
        teamName: team.name,
        teamPassword: password,
      });
      const entry: { memberId: string; name: string; email: string; status: EmailStatus; error?: string } = {
        memberId: p.id,
        name: p.name,
        email: p.email,
        status: outcome.status,
      };
      if (outcome.error) entry.error = outcome.error;
      return entry;
    }),
  );
  return c.json({ results });
});

/** Alerts within this window count; older "judge is at team X" records are ignored. */
const TURN_WINDOW_MS = 4 * 60 * 60 * 1000;

/**
 * Where this team is relative to the judges: `next` when a judge is at the team just before it,
 * `after-next` two before. `key` changes whenever the judges move on, so the app rings once per move.
 */
app.get('/turn', async (c) => {
  const db = c.env.DB;
  const { team } = requireParticipant(c.get('auth'));
  const since = new Date(Date.now() - TURN_WINDOW_MS).toISOString();
  const [current, scored, judges, state] = await Promise.all([
    db
      .prepare(
        `SELECT t.id, t.name, t.order_position, n.updated_at FROM judge_now n JOIN teams t ON t.id = n.team_id
          WHERE n.updated_at >= ? AND t.order_position IS NOT NULL
          ORDER BY t.order_position DESC, n.updated_at DESC LIMIT 1`,
      )
      .bind(since)
      .first<{ id: string; name: string; order_position: number; updated_at: string }>(),
    db.prepare('SELECT COUNT(*) AS n FROM evaluations WHERE team_id = ?').bind(team.id).first<{ n: number }>(),
    db.prepare('SELECT COUNT(*) AS n FROM judges WHERE active = 1').first<{ n: number }>(),
    getEventState(db),
  ]);
  const mine = team.order_position;
  let stage: 'now' | 'next' | 'after-next' | null = null;
  const done = (judges?.n ?? 0) > 0 && (scored?.n ?? 0) >= (judges?.n ?? 0);
  if (current && mine !== null && !done && !state.resultsPublishedAt) {
    const gap = mine - current.order_position;
    stage = gap === 0 ? 'now' : gap === 1 ? 'next' : gap === 2 ? 'after-next' : null;
  }
  return c.json({
    stage,
    myPosition: mine,
    judgesAt: current ? { position: current.order_position, teamName: current.name } : null,
    key: stage && current ? `${stage}:${current.id}` : null,
  });
});

app.get('/report', async (c) => {
  const db = c.env.DB;
  const { team } = requireParticipant(c.get('auth'));
  const [state, labels, activeJudgeCount, evalRows] = await Promise.all([
    getEventState(db),
    loadJudgeLabels(db),
    countRows(db, 'SELECT COUNT(*) AS n FROM judges WHERE active = 1'),
    db.prepare('SELECT * FROM evaluations WHERE team_id = ?').bind(team.id).all<EvaluationRow>(),
  ]);
  const evaluations = sortByJudgeLabel(evalRows.results.map((r) => toEvaluation(r, labels)));
  const average = evaluations.length
    ? round2(evaluations.reduce((s, e) => s + e.total, 0) / evaluations.length)
    : null;

  let rank: number | null = null;
  const resultsPublished = state.resultsPublishedAt !== null;
  if (resultsPublished) {
    const standing = (await loadStandings(db)).standings.find((s) => s.teamId === team.id);
    if (standing?.rank && standing.rank <= TOP_N) rank = standing.rank;
  }
  // Marks stay hidden from teams until the results are published; until then they only see how
  // many judges have scored them.
  return c.json({
    criteria: CRITERIA,
    maxPerJudge: MAX_PER_JUDGE,
    activeJudgeCount,
    scoredCount: evaluations.length,
    evaluations: resultsPublished ? evaluations : [],
    average: resultsPublished ? average : null,
    resultsPublished,
    rank,
  });
});

export default app;
