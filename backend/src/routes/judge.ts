import { Hono } from 'hono';
import { CRITERIA } from '../criteria';
import type { AppEnv } from '../env';
import { requireAuth, requireJudge } from '../lib/auth';
import { secureShuffle } from '../lib/crypto';
import type { EvaluationRow, TeamRow } from '../lib/db';
import { imageUrl, listTeams, loadJudgeLabels, loadPublicMembers, nowIso, toEvaluation, toPublicTeam } from '../lib/db';
import { ApiError, badRequest, conflict, isConstraintError, notFound, resultsPublished, validation } from '../lib/errors';
import { isPermutationOf } from '../lib/ranking';
import { getEventState, RESULTS_NOT_PUBLISHED_SQL, setSettingStmt } from '../lib/settings';
import { canVoteOnTie, evaluationsComplete, loadStandings, relevantGroups, toTieGroup, unresolvedGroups } from '../lib/standings';
import { readBody, Validator } from '../lib/validate';

const app = new Hono<AppEnv>();

app.use('*', requireAuth('judge'));

const alreadyEvaluated = () =>
  new ApiError(409, 'ALREADY_EVALUATED', 'You have already evaluated this team. Scores are final.');

/**
 * One-time random draw of the presentation order by any judge (the admin can also draw or
 * rearrange it). Only the first draw counts: the plain INSERT of `order_generated_at` fails for
 * every later or concurrent request, which rolls back that whole batch.
 */
app.post('/order/generate', async (c) => {
  const db = c.env.DB;
  const state = await getEventState(db);
  if (state.resultsPublishedAt) throw resultsPublished();
  if (state.orderGeneratedAt) throw orderAlreadyDrawn();
  const { results: ids } = await db.prepare('SELECT id FROM teams').all<{ id: string }>();
  if (ids.length === 0) throw badRequest('No teams have registered yet');

  const shuffled = secureShuffle(ids.map((r) => r.id));
  const generatedAt = nowIso();
  try {
    await db.batch([
      db.prepare("INSERT INTO settings (key, value) VALUES ('order_generated_at', ?)").bind(generatedAt),
      setSettingStmt(db, 'registration_open', '0'),
      ...shuffled.map((id, i) => db.prepare('UPDATE teams SET order_position = ? WHERE id = ?').bind(i + 1, id)),
    ]);
  } catch (err) {
    if (isConstraintError(err, 'settings')) throw orderAlreadyDrawn();
    throw err;
  }
  const [teams, people] = await Promise.all([listTeams(db), loadPublicMembers(db)]);
  return c.json({ generatedAt, teams: teams.map((t) => toPublicTeam(t, people.get(t.id) ?? [])) });
});

const orderAlreadyDrawn = () => conflict('The presentation order has already been drawn.');

app.get('/teams/by-code/:code', async (c) => {
  const db = c.env.DB;
  const judge = requireJudge(c.get('auth'));
  const code = c.req.param('code');
  const team = /^\d{4}$/.test(code)
    ? await db.prepare('SELECT * FROM teams WHERE code = ?').bind(code).first<TeamRow>()
    : null;
  if (!team) throw notFound('No team has that code');
  // The judge is now at this team: the next two teams in the order get their alerts.
  await db
    .prepare(
      `INSERT INTO judge_now (judge_id, team_id, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (judge_id) DO UPDATE SET team_id = excluded.team_id, updated_at = excluded.updated_at`,
    )
    .bind(judge.id, team.id, nowIso())
    .run();
  const [people, labels, mine] = await Promise.all([
    loadPublicMembers(db, team.id),
    loadJudgeLabels(db),
    db
      .prepare('SELECT * FROM evaluations WHERE team_id = ? AND judge_id = ?')
      .bind(team.id, judge.id)
      .first<EvaluationRow>(),
  ]);
  return c.json({
    team: toPublicTeam(team, people.get(team.id) ?? []),
    myEvaluation: mine ? toEvaluation(mine, labels) : null,
  });
});

app.post('/evaluations', async (c) => {
  const db = c.env.DB;
  const judge = requireJudge(c.get('auth'));
  const body = await readBody(c);
  const v = new Validator(body);

  const teamId = typeof body.teamId === 'string' ? body.teamId : '';
  if (!teamId) v.fail('teamId', 'teamId is required');
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!/^\d{4}$/.test(code)) v.fail('code', 'Enter the 4-digit team code');

  const scores: Record<string, number> = {};
  const rawScores = body.scores;
  if (!rawScores || typeof rawScores !== 'object' || Array.isArray(rawScores)) {
    v.fail('scores', 'Scores are required');
  } else {
    const input = rawScores as Record<string, unknown>;
    const known = new Set(CRITERIA.map((cr) => cr.key));
    const extra = Object.keys(input).filter((k) => !known.has(k));
    if (extra.length) v.fail('scores', `Unknown criteria: ${extra.join(', ')}`);
    for (const cr of CRITERIA) {
      const value = input[cr.key];
      if (value === undefined || value === null) {
        v.fail(`scores.${cr.key}`, `${cr.label} score is required`);
      } else if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > cr.max) {
        v.fail(`scores.${cr.key}`, `${cr.label} must be a whole number from 0 to ${cr.max}`);
      } else {
        scores[cr.key] = value;
      }
    }
  }
  const remarks = v.optionalText('remarks', 'Remarks', 0, 500, true);
  v.done();

  const team = await db.prepare('SELECT * FROM teams WHERE id = ?').bind(teamId).first<TeamRow>();
  if (!team) throw notFound('Team not found');
  if (team.code !== code) throw new ApiError(400, 'VALIDATION', 'The code does not match this team', { code: 'Wrong team code' });

  const state = await getEventState(db);
  if (state.resultsPublishedAt) throw resultsPublished();

  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const total = Object.values(scores).reduce((s, n) => s + n, 0);
  let changes: number;
  try {
    // UNIQUE(team_id, judge_id) makes this race-safe; the WHERE blocks inserts once results are published.
    const result = await db
      .prepare(
        `INSERT INTO evaluations (id, team_id, judge_id, scores, total, remarks, created_at)
         SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${RESULTS_NOT_PUBLISHED_SQL}`,
      )
      .bind(id, team.id, judge.id, JSON.stringify(scores), total, remarks, createdAt)
      .run();
    changes = result.meta.changes;
  } catch (err) {
    if (isConstraintError(err, 'UNIQUE constraint failed: evaluations.team_id')) throw alreadyEvaluated();
    if (isConstraintError(err, 'FOREIGN KEY constraint failed')) throw notFound('Team not found');
    throw err;
  }
  if (changes === 0) throw resultsPublished();

  const labels = await loadJudgeLabels(db);
  const row: EvaluationRow = {
    id,
    team_id: team.id,
    judge_id: judge.id,
    scores: JSON.stringify(scores),
    total,
    remarks,
    created_at: createdAt,
  };
  return c.json({ evaluation: toEvaluation(row, labels) }, 201);
});

app.get('/evaluations', async (c) => {
  const db = c.env.DB;
  const judge = requireJudge(c.get('auth'));
  const [labels, { results }] = await Promise.all([
    loadJudgeLabels(db),
    db
      .prepare('SELECT * FROM evaluations WHERE judge_id = ? ORDER BY created_at DESC, id DESC')
      .bind(judge.id)
      .all<EvaluationRow>(),
  ]);
  return c.json({ evaluations: results.map((r) => toEvaluation(r, labels)) });
});

app.get('/progress', async (c) => {
  const db = c.env.DB;
  const judge = requireJudge(c.get('auth'));
  const [teams, labels, state, standings, { results: activeJudges }, { results: pairs }] = await Promise.all([
    listTeams(db),
    loadJudgeLabels(db),
    getEventState(db),
    loadStandings(db),
    db.prepare('SELECT id, name FROM judges WHERE active = 1 ORDER BY created_at, id').all<{ id: string; name: string }>(),
    db.prepare('SELECT team_id, judge_id FROM evaluations').all<{ team_id: string; judge_id: string }>(),
  ]);

  const byTeam = new Map<string, Set<string>>();
  const byJudge = new Map<string, number>();
  for (const p of pairs) {
    if (!byTeam.has(p.team_id)) byTeam.set(p.team_id, new Set());
    byTeam.get(p.team_id)!.add(p.judge_id);
    byJudge.set(p.judge_id, (byJudge.get(p.judge_id) ?? 0) + 1);
  }
  const complete =
    teams.length > 0 &&
    activeJudges.length > 0 &&
    teams.every((t) => activeJudges.every((j) => byTeam.get(t.id)?.has(j.id)));

  return c.json({
    totalTeams: teams.length,
    judges: activeJudges.map((j) => ({
      id: j.id,
      name: j.name,
      label: labels.get(j.id)?.label ?? 'Judge',
      evaluatedCount: byJudge.get(j.id) ?? 0,
    })),
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      projectTitle: t.project_title,
      imageUrl: imageUrl(t.image_id),
      color: t.color ?? null,
      orderPosition: t.order_position,
      evaluatedByMe: byTeam.get(t.id)?.has(judge.id) ?? false,
      evaluationCount: byTeam.get(t.id)?.size ?? 0,
    })),
    complete,
    resultsPublished: state.resultsPublishedAt !== null,
    unresolvedTies: unresolvedGroups(standings).length,
  });
});

app.get('/ties', async (c) => {
  const db = c.env.DB;
  const judge = requireJudge(c.get('auth'));
  const [complete, standings] = await Promise.all([evaluationsComplete(db), loadStandings(db)]);
  // Ties are shown as soon as they exist so judges can decide even when the admin force-publishes early.
  // Votes are keyed by group membership, so a vote on a tie that later changes is ignored automatically.
  const ties = relevantGroups(standings).map((g) => toTieGroup(standings, g, judge.id));
  return c.json({ complete, ties });
});

app.put('/ties', async (c) => {
  const db = c.env.DB;
  const judge = requireJudge(c.get('auth'));
  const body = await readBody(c);
  const groupKey = typeof body.groupKey === 'string' ? body.groupKey : '';
  const v = new Validator(body);
  if (!groupKey) v.fail('groupKey', 'groupKey is required');
  if (!Array.isArray(body.teamIds) || body.teamIds.some((id) => typeof id !== 'string')) {
    v.fail('teamIds', 'teamIds must be a list of team ids');
  }
  v.done();

  if ((await getEventState(db)).resultsPublishedAt) throw resultsPublished();
  const current = await loadStandings(db);
  const group = relevantGroups(current).find((g) => g.groupKey === groupKey);
  if (!group) throw notFound('That tie no longer exists. Refresh and try again.');
  if (!canVoteOnTie(current, group, judge.id)) {
    throw new ApiError(403, 'FORBIDDEN', 'Only judges who scored every tied team can decide this tie');
  }
  const teamIds = body.teamIds as string[];
  if (!isPermutationOf(teamIds, group.teamIds)) {
    throw validation({ teamIds: 'List every tied team exactly once' });
  }

  // Votes are frozen once results are published.
  await db
    .prepare(
      `INSERT INTO tie_votes (judge_id, group_key, ordering, updated_at) SELECT ?, ?, ?, ? WHERE ${RESULTS_NOT_PUBLISHED_SQL}
       ON CONFLICT(judge_id, group_key) DO UPDATE SET ordering = excluded.ordering, updated_at = excluded.updated_at`,
    )
    .bind(judge.id, groupKey, JSON.stringify(teamIds), nowIso())
    .run();

  const standings = await loadStandings(db);
  const updated = standings.groups.find((g) => g.groupKey === groupKey) ?? group;
  return c.json({ tie: toTieGroup(standings, updated, judge.id) });
});

export default app;
