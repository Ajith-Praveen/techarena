import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { countRows, listTeams, loadPublicMembers, nowIso, toPublicTeam } from '../lib/db';
import { ApiError, badRequest, resultsPublished } from '../lib/errors';
import { TOP_N } from '../lib/ranking';
import { getEventState } from '../lib/settings';
import {
  countPendingEvaluations,
  loadStandings,
  PUBLISHED_TIES_KEY,
  relevantGroups,
  toTieGroup,
  unresolvedGroups,
} from '../lib/standings';
import { readBody, Validator } from '../lib/validate';

const app = new Hono<AppEnv>();

app.get('/order', requireAuth(), async (c) => {
  const db = c.env.DB;
  const state = await getEventState(db);
  if (!state.orderGeneratedAt) return c.json({ generated: false, generatedAt: null, teams: [] });
  const [teams, people, { results: counts }] = await Promise.all([
    listTeams(db),
    loadPublicMembers(db),
    db
      .prepare('SELECT team_id, COUNT(*) AS n FROM evaluations GROUP BY team_id')
      .all<{ team_id: string; n: number }>(),
  ]);
  const countByTeam = new Map(counts.map((r) => [r.team_id, r.n]));
  return c.json({
    generated: true,
    generatedAt: state.orderGeneratedAt,
    teams: teams
      .filter((t) => t.order_position !== null)
      .map((t) => ({ ...toPublicTeam(t, people.get(t.id) ?? []), evaluationCount: countByTeam.get(t.id) ?? 0 })),
  });
});

app.get('/results', requireAuth(), async (c) => {
  const db = c.env.DB;
  const state = await getEventState(db);
  if (!state.resultsPublishedAt) return c.json({ published: false });
  const top = (await loadStandings(db)).standings
    .filter((s) => s.rank !== null && s.rank <= TOP_N)
    .map((s) => ({ rank: s.rank, team: s.team, average: s.average, evaluationCount: s.evaluationCount }));
  return c.json({ published: true, publishedAt: state.resultsPublishedAt, top });
});

app.post('/results/publish', requireAuth('judge', 'admin'), async (c) => {
  const db = c.env.DB;
  const auth = c.get('auth');
  const body = await readBody(c).catch(() => ({}));
  const v = new Validator(body);
  const force = v.optionalBoolean('force') ?? false;
  v.done();

  if ((await getEventState(db)).resultsPublishedAt) throw resultsPublished(409);

  const [teamCount, evalCount, pending] = await Promise.all([
    countRows(db, 'SELECT COUNT(*) AS n FROM teams'),
    countRows(db, 'SELECT COUNT(*) AS n FROM evaluations'),
    countPendingEvaluations(db),
  ]);
  if (teamCount === 0) throw badRequest('There are no teams to publish results for');
  if (evalCount === 0) throw badRequest('No evaluations have been submitted yet');
  const forced = auth.role === 'admin' && force;
  if (pending > 0 && !forced) {
    throw new ApiError(
      409,
      'INCOMPLETE',
      `${pending} evaluation${pending === 1 ? ' is' : 's are'} still pending`,
      undefined,
      { pending },
    );
  }

  // Ties touching the top 3 must be decided by the judges first; admin force does not bypass this.
  const standings = await loadStandings(db);
  const unresolved = unresolvedGroups(standings);
  if (unresolved.length > 0) {
    throw new ApiError(
      409,
      'TIES_UNRESOLVED',
      unresolved.length === 1
        ? 'A tie in the top 3 must be decided by the judges before publishing'
        : `${unresolved.length} ties in the top 3 must be decided by the judges before publishing`,
      undefined,
      { ties: unresolved.map((g) => toTieGroup(standings, g)) },
    );
  }
  const frozenTies = Object.fromEntries(
    relevantGroups(standings).map((g) => [g.groupKey, g.resolvedOrdering]),
  );

  const publishedAt = nowIso();
  const publishedBy = auth.role === 'admin' ? 'admin' : `judge:${auth.judge?.name ?? 'unknown'}`;
  const ifWinner = "(SELECT value FROM settings WHERE key = 'results_published_at') = ?";
  // OR IGNORE + the conditional statements make concurrent publishes resolve to a single winner.
  const [first] = await db.batch([
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('results_published_at', ?)").bind(publishedAt),
    db
      .prepare(
        `INSERT INTO settings (key, value) SELECT 'results_published_by', ? WHERE ${ifWinner}
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .bind(publishedBy, publishedAt),
    db
      .prepare(
        `INSERT INTO settings (key, value) SELECT ?, ? WHERE ${ifWinner}
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .bind(PUBLISHED_TIES_KEY, JSON.stringify(frozenTies), publishedAt),
  ]);
  if (!first || first.meta.changes === 0) throw resultsPublished(409);
  return c.json({ publishedAt });
});

export default app;
