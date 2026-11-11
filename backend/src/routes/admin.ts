import { Hono } from 'hono';
import { CRITERIA } from '../criteria';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { hashPassword, secureShuffle } from '../lib/crypto';
import type { JudgeRow, ParticipantRow, TeamRow } from '../lib/db';
import { countRows, getTeam, listTeams, loadPublicMembers, nowIso, toJudge, toMember, toPublicTeam, toTeam } from '../lib/db';
import { isEmailConfigured } from '../lib/email';
import { badRequest, conflict, isConstraintError, notFound, resultsPublished, validation } from '../lib/errors';
import { deleteSettingStmt, getEventState, setSettingStmt } from '../lib/settings';
import { loadStandings, relevantGroups, toTieGroup } from '../lib/standings';
import { readBody, Validator } from '../lib/validate';

const app = new Hono<AppEnv>();

app.use('*', requireAuth('admin'));

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

const countEvaluations = (db: D1Database) => countRows(db, 'SELECT COUNT(*) AS n FROM evaluations');

app.get('/overview', async (c) => {
  const db = c.env.DB;
  const [state, teams, participants, judges, evaluations, missingParticipantPhotos, missingJudgePhotos, missingPosters] = await Promise.all([
    getEventState(db),
    countRows(db, 'SELECT COUNT(*) AS n FROM teams'),
    countRows(db, 'SELECT COUNT(*) AS n FROM participants'),
    countRows(db, 'SELECT COUNT(*) AS n FROM judges WHERE active = 1'),
    countEvaluations(db),
    countRows(db, 'SELECT COUNT(*) AS n FROM participants WHERE photo_id IS NULL'),
    countRows(db, 'SELECT COUNT(*) AS n FROM judges WHERE active = 1 AND photo_id IS NULL'),
    countRows(db, 'SELECT COUNT(*) AS n FROM teams WHERE poster_id IS NULL'),
  ]);
  return c.json({
    teams,
    participants,
    judges,
    evaluations,
    expectedEvaluations: teams * judges,
    missingPhotos: missingParticipantPhotos + missingJudgePhotos,
    missingPosters,
    registrationOpen: state.registrationOpen,
    orderGenerated: state.orderGeneratedAt !== null,
    orderGeneratedAt: state.orderGeneratedAt,
    resultsPublished: state.resultsPublishedAt !== null,
    resultsPublishedAt: state.resultsPublishedAt,
    emailConfigured: isEmailConfigured(c.env),
  });
});

app.get('/teams', async (c) => {
  const db = c.env.DB;
  const [{ standings }, { results: participants }] = await Promise.all([
    loadStandings(db),
    db
      .prepare("SELECT * FROM participants ORDER BY CASE role WHEN 'lead' THEN 0 ELSE 1 END, created_at, id")
      .all<ParticipantRow>(),
  ]);
  const membersByTeam = new Map<string, ParticipantRow[]>();
  for (const p of participants) {
    const list = membersByTeam.get(p.team_id) ?? [];
    list.push(p);
    membersByTeam.set(p.team_id, list);
  }
  const position = (t: TeamRow) => t.order_position ?? Number.POSITIVE_INFINITY;
  const teams = standings
    .slice()
    .sort((a, b) => position(a.row) - position(b.row) || a.row.name_key.localeCompare(b.row.name_key))
    .map((s) => {
      const members = membersByTeam.get(s.teamId) ?? [];
      return {
        ...toTeam(s.row),
        members: members.map(toMember),
        evaluationCount: s.evaluationCount,
        average: s.average,
        missingPhotos: members.filter((m) => !m.photo_id).length,
      };
    });
  return c.json({ teams });
});

app.delete('/teams/:id', async (c) => {
  const db = c.env.DB;
  const team = await getTeam(db, c.req.param('id'));
  if (!team) throw notFound('Team not found');
  if ((await countRows(db, 'SELECT COUNT(*) AS n FROM evaluations WHERE team_id = ?', team.id)) > 0) {
    throw conflict('This team has already been evaluated and cannot be deleted');
  }
  const stmts = [
    db
      .prepare(
        "DELETE FROM sessions WHERE role IN ('lead', 'member') AND subject_id IN (SELECT id FROM participants WHERE team_id = ?)",
      )
      .bind(team.id),
    db
      .prepare('DELETE FROM images WHERE id IN (SELECT photo_id FROM participants WHERE team_id = ? AND photo_id IS NOT NULL)')
      .bind(team.id),
    db.prepare('DELETE FROM participants WHERE team_id = ?').bind(team.id),
    db.prepare('DELETE FROM judge_now WHERE team_id = ?').bind(team.id),
    db.prepare('DELETE FROM teams WHERE id = ?').bind(team.id),
  ];
  if (team.image_id) stmts.push(db.prepare('DELETE FROM images WHERE id = ?').bind(team.image_id));
  if (team.poster_id) stmts.push(db.prepare('DELETE FROM images WHERE id = ?').bind(team.poster_id));
  // Keep the queue contiguous (1..N) when a team in the generated order is removed.
  if (team.order_position !== null) {
    stmts.push(
      db.prepare('UPDATE teams SET order_position = order_position - 1 WHERE order_position > ?').bind(team.order_position),
    );
  }
  try {
    await db.batch(stmts);
  } catch (err) {
    if (isConstraintError(err, 'FOREIGN KEY constraint failed')) {
      throw conflict('This team has already been evaluated and cannot be deleted');
    }
    throw err;
  }
  return c.json({ ok: true });
});

app.post('/registration', async (c) => {
  const db = c.env.DB;
  const body = await readBody(c);
  if (typeof body.open !== 'boolean') throw badRequest('Body must include "open": true or false');
  const open = body.open;
  if (open) {
    if ((await countEvaluations(db)) > 0) {
      throw conflict('Registration cannot be reopened after judging has started');
    }
    await db.batch([
      setSettingStmt(db, 'registration_open', '1'),
      db.prepare('UPDATE teams SET order_position = NULL'),
      deleteSettingStmt(db, 'order_generated_at'),
    ]);
  } else {
    await setSettingStmt(db, 'registration_open', '0').run();
  }
  return c.json({ registrationOpen: open });
});

app.post('/order/generate', async (c) => {
  const db = c.env.DB;
  const body = await readBody(c).catch(() => ({}));
  const v = new Validator(body);
  const force = v.optionalBoolean('force') ?? false;
  v.done();

  const state = await getEventState(db);
  if (state.resultsPublishedAt) throw resultsPublished();
  // The first draw is always allowed (judges may have started early); only re-drawing is locked once judging starts.
  if (state.orderGeneratedAt && (await countEvaluations(db)) > 0) {
    throw conflict('The random order cannot be redrawn after judging has started. Rearrange it manually instead.');
  }
  if (state.orderGeneratedAt && !force) {
    throw conflict('The presentation order has already been generated. Use force to regenerate it.');
  }
  const { results: ids } = await db.prepare('SELECT id FROM teams').all<{ id: string }>();
  if (ids.length === 0) throw badRequest('No teams have registered yet');

  const shuffled = secureShuffle(ids.map((r) => r.id));
  const generatedAt = nowIso();
  await db.batch([
    setSettingStmt(db, 'registration_open', '0'),
    ...shuffled.map((id, i) => db.prepare('UPDATE teams SET order_position = ? WHERE id = ?').bind(i + 1, id)),
    setSettingStmt(db, 'order_generated_at', generatedAt),
  ]);

  return c.json({ generatedAt, teams: await orderedPublicTeams(db) });
});

app.put('/order', async (c) => {
  const db = c.env.DB;
  const body = await readBody(c);
  const raw = body.teamIds;
  if (!Array.isArray(raw) || raw.some((id) => typeof id !== 'string')) {
    throw validation({ teamIds: 'teamIds must be a list of team ids' });
  }
  const teamIds = raw as string[];
  const state = await getEventState(db);
  if (state.resultsPublishedAt) throw resultsPublished();

  const { results } = await db.prepare('SELECT id FROM teams').all<{ id: string }>();
  const known = new Set(results.map((r) => r.id));
  const unique = new Set(teamIds);
  if (unique.size !== teamIds.length || teamIds.length !== known.size || teamIds.some((id) => !known.has(id))) {
    throw validation({ teamIds: 'List every team exactly once' });
  }
  if (teamIds.length === 0) throw badRequest('No teams have registered yet');

  const generatedAt = state.orderGeneratedAt ?? nowIso();
  // Positions only decide who presents when; they never feed into scores or ranks.
  await db.batch([
    ...teamIds.map((id, i) => db.prepare('UPDATE teams SET order_position = ? WHERE id = ?').bind(i + 1, id)),
    ...(state.orderGeneratedAt
      ? []
      : [setSettingStmt(db, 'registration_open', '0'), setSettingStmt(db, 'order_generated_at', generatedAt)]),
  ]);
  return c.json({ generatedAt, teams: await orderedPublicTeams(db) });
});

async function orderedPublicTeams(db: D1Database) {
  const [teams, people] = await Promise.all([listTeams(db), loadPublicMembers(db)]);
  return teams.map((t) => toPublicTeam(t, people.get(t.id) ?? []));
}

/** Every app rating with who gave it (names only) and the average. */
app.get('/ratings', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT r.stars, r.feedback, r.updated_at, r.subject_kind,
            COALESCE(p.name, j.name) AS name, t.name AS team_name
       FROM ratings r
       LEFT JOIN participants p ON r.subject_kind = 'participant' AND p.id = r.subject_id
       LEFT JOIN teams t ON t.id = p.team_id
       LEFT JOIN judges j ON r.subject_kind = 'judge' AND j.id = r.subject_id
      ORDER BY r.updated_at DESC`,
  ).all<{ stars: number; feedback: string | null; updated_at: string; subject_kind: string; name: string | null; team_name: string | null }>();
  const count = results.length;
  const average = count ? Math.round((results.reduce((s, r) => s + r.stars, 0) / count) * 10) / 10 : null;
  return c.json({
    count,
    average,
    ratings: results.map((r) => ({
      stars: r.stars,
      feedback: r.feedback,
      updatedAt: r.updated_at,
      role: r.subject_kind === 'judge' ? 'judge' : 'team',
      name: r.name ?? 'Removed user',
      teamName: r.team_name,
    })),
  });
});

app.get('/judges', async (c) => {
  const db = c.env.DB;
  const { results } = await db
    .prepare(
      `SELECT j.*, (SELECT COUNT(*) FROM evaluations e WHERE e.judge_id = j.id) AS evaluated_count
       FROM judges j ORDER BY j.created_at, j.id`,
    )
    .all<JudgeRow & { evaluated_count: number }>();
  return c.json({ judges: results.map((j) => ({ ...toJudge(j), evaluatedCount: j.evaluated_count })) });
});

app.post('/judges', async (c) => {
  const db = c.env.DB;
  const body = await readBody(c);
  const v = new Validator(body);
  const name = v.text('name', 'Name', 2, 60);
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  if (!USERNAME_RE.test(username)) {
    v.fail('username', 'Username must be 3–30 characters: letters, numbers, dot, dash or underscore');
  }
  const password = v.password('password');
  v.done();

  if (await db.prepare('SELECT 1 FROM judges WHERE username = ?').bind(username).first()) {
    throw conflict('Username already exists', { username: 'This username is already taken' });
  }
  const row: JudgeRow = {
    id: crypto.randomUUID(),
    name,
    username,
    password_hash: await hashPassword(password),
    photo_id: null,
    active: 1,
    created_at: nowIso(),
  };
  try {
    await db
      .prepare('INSERT INTO judges (id, name, username, password_hash, active, created_at) VALUES (?, ?, ?, ?, 1, ?)')
      .bind(row.id, row.name, row.username, row.password_hash, row.created_at)
      .run();
  } catch (err) {
    if (isConstraintError(err, 'judges.username')) {
      throw conflict('Username already exists', { username: 'This username is already taken' });
    }
    throw err;
  }
  return c.json({ judge: toJudge(row) }, 201);
});

app.patch('/judges/:id', async (c) => {
  const db = c.env.DB;
  const judge = await db.prepare('SELECT * FROM judges WHERE id = ?').bind(c.req.param('id')).first<JudgeRow>();
  if (!judge) throw notFound('Judge not found');
  const body = await readBody(c);
  const v = new Validator(body);
  const active = v.optionalBoolean('active');
  const name = v.has('name') ? v.text('name', 'Name', 2, 60) : undefined;
  const password = v.has('password') ? v.password('password') : undefined;
  v.done();

  const stmts: D1PreparedStatement[] = [];
  if (name !== undefined) stmts.push(db.prepare('UPDATE judges SET name = ? WHERE id = ?').bind(name, judge.id));
  if (password !== undefined) {
    stmts.push(db.prepare('UPDATE judges SET password_hash = ? WHERE id = ?').bind(await hashPassword(password), judge.id));
  }
  if (active !== undefined) {
    stmts.push(db.prepare('UPDATE judges SET active = ? WHERE id = ?').bind(active ? 1 : 0, judge.id));
  }
  // Deactivation and password resets sign the judge out everywhere.
  if (active === false || password !== undefined) {
    stmts.push(db.prepare("DELETE FROM sessions WHERE role = 'judge' AND subject_id = ?").bind(judge.id));
  }
  if (stmts.length) await db.batch(stmts);
  const updated = (await db.prepare('SELECT * FROM judges WHERE id = ?').bind(judge.id).first<JudgeRow>())!;
  return c.json({ judge: toJudge(updated) });
});

app.get('/leaderboard', async (c) => {
  const data = await loadStandings(c.env.DB);
  return c.json({
    criteria: CRITERIA,
    ties: relevantGroups(data).map((g) => toTieGroup(data, g)),
    teams: data.standings.map((s) => ({
      rank: s.rank,
      tied: s.tied,
      team: s.team,
      average: s.average,
      evaluationCount: s.evaluationCount,
      criteriaAverages: s.criteriaAverages,
      evaluations: s.evaluations,
    })),
  });
});

export default app;
