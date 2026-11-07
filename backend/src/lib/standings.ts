import type { Evaluation, PublicTeam, TeamRow } from './db';
import {
  countRows,
  listEvaluations,
  listTeams,
  loadJudgeLabels,
  loadPublicMembers,
  sortByJudgeLabel,
  toEvaluation,
  toPublicTeam,
} from './db';
import type { RankingEntry, TieGroupInfo, TieResolver } from './ranking';
import { isPermutationOf, rankTeams } from './ranking';
import { getEventState } from './settings';

/** Settings key holding the tie orderings frozen at publish time (JSON `{ groupKey: string[] }`). */
export const PUBLISHED_TIES_KEY = 'results_tie_orderings';

export interface Standing extends RankingEntry {
  row: TeamRow;
  team: PublicTeam;
  evaluations: Evaluation[];
}

export interface ActiveJudge {
  id: string;
  name: string;
  label: string;
}

export interface TieGroup {
  groupKey: string;
  average: number;
  positions: [number, number];
  teams: PublicTeam[];
  votes: Array<{ judgeId: string; judgeLabel: string; judgeName: string; submitted: boolean; ordering: string[] | null }>;
  myOrdering: string[] | null;
  resolved: boolean;
  resolvedOrdering: string[] | null;
}

export interface StandingsData {
  standings: Standing[];
  groups: TieGroupInfo[];
  activeJudges: ActiveJudge[];
  /** Judges who decide a tie: see tieVoters(). */
  tieVoters: (teamIds: readonly string[]) => ActiveJudge[];
  /** groupKey -> judgeId -> ordering. */
  votes: Map<string, Map<string, unknown>>;
  teamsById: Map<string, PublicTeam>;
  resultsPublished: boolean;
}

function parseJson(text: string | null | undefined): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * A relevant tie group is resolved when every eligible voter submitted the identical ordering. Once results
 * are published the orderings frozen at publish time are used, so later judge changes cannot move ranks.
 */
function makeResolver(
  tieVoters: (teamIds: readonly string[]) => ActiveJudge[],
  votes: Map<string, Map<string, unknown>>,
  frozen: Record<string, unknown> | null,
): TieResolver {
  if (frozen) {
    return (groupKey, teamIds) => {
      const ordering = frozen[groupKey];
      return isPermutationOf(ordering, teamIds) ? ordering : null;
    };
  }
  return (groupKey, teamIds) => {
    const voters = tieVoters(teamIds);
    if (voters.length === 0) return null;
    const byJudge = votes.get(groupKey);
    let agreed: string[] | null = null;
    for (const judge of voters) {
      const ordering = byJudge?.get(judge.id);
      if (!isPermutationOf(ordering, teamIds)) return null;
      if (agreed && agreed.some((id, i) => ordering[i] !== id)) return null;
      agreed = ordering;
    }
    return agreed;
  };
}

/** Loads every team with its evaluations and ranks them (ranked first, unranked last). */
export async function loadStandings(db: D1Database): Promise<StandingsData> {
  const [teams, evalRows, labels, people, state, { results: judgeRows }, { results: voteRows }, frozenRow] =
    await Promise.all([
      listTeams(db),
      listEvaluations(db),
      loadJudgeLabels(db),
      loadPublicMembers(db),
      getEventState(db),
      db.prepare('SELECT id, name, active FROM judges ORDER BY created_at, id').all<{ id: string; name: string; active: number }>(),
      db.prepare('SELECT judge_id, group_key, ordering FROM tie_votes').all<{ judge_id: string; group_key: string; ordering: string }>(),
      db.prepare('SELECT value FROM settings WHERE key = ?').bind(PUBLISHED_TIES_KEY).first<{ value: string | null }>(),
    ]);

  const evalsByTeam = new Map<string, Evaluation[]>();
  for (const row of evalRows) {
    const list = evalsByTeam.get(row.team_id) ?? [];
    list.push(toEvaluation(row, labels));
    evalsByTeam.set(row.team_id, list);
  }
  const allJudges = judgeRows.map((j) => ({ id: j.id, name: j.name, label: labels.get(j.id)?.label ?? 'Judge' }));
  const activeJudges = allJudges.filter((_, i) => judgeRows[i]!.active === 1);
  const judgesByTeam = new Map<string, Set<string>>();
  for (const row of evalRows) {
    if (!judgesByTeam.has(row.team_id)) judgesByTeam.set(row.team_id, new Set());
    judgesByTeam.get(row.team_id)!.add(row.judge_id);
  }
  // A tie is decided by the judges who scored every tied team, active or not, so the admin can never
  // change the outcome by (de)activating a judge. Only if nobody scored all of them (possible with a
  // forced publish) do the active judges decide.
  const tieVoters = (teamIds: readonly string[]): ActiveJudge[] => {
    const scoredAll = allJudges.filter((j) => teamIds.every((id) => judgesByTeam.get(id)?.has(j.id)));
    return scoredAll.length > 0 ? scoredAll : activeJudges;
  };
  const votes = new Map<string, Map<string, unknown>>();
  for (const v of voteRows) {
    if (!votes.has(v.group_key)) votes.set(v.group_key, new Map());
    votes.get(v.group_key)!.set(v.judge_id, parseJson(v.ordering));
  }
  const resultsPublished = state.resultsPublishedAt !== null;
  const frozenValue = resultsPublished ? parseJson(frozenRow?.value) : null;
  const frozen =
    resultsPublished ? (frozenValue && typeof frozenValue === 'object' ? (frozenValue as Record<string, unknown>) : {}) : null;

  const ranking = rankTeams(
    teams.map((t) => ({
      teamId: t.id,
      name: t.name,
      orderPosition: t.order_position,
      evaluations: evalsByTeam.get(t.id) ?? [],
    })),
    makeResolver(tieVoters, votes, frozen),
  );

  const rowsById = new Map(teams.map((t) => [t.id, t]));
  const teamsById = new Map(teams.map((t) => [t.id, toPublicTeam(t, people.get(t.id) ?? [])]));
  const standings = ranking.entries.map((entry) => ({
    ...entry,
    row: rowsById.get(entry.teamId)!,
    team: teamsById.get(entry.teamId)!,
    evaluations: sortByJudgeLabel(evalsByTeam.get(entry.teamId) ?? []),
  }));
  return { standings, groups: ranking.groups, activeJudges, tieVoters, votes, teamsById, resultsPublished };
}

export function relevantGroups(data: StandingsData): TieGroupInfo[] {
  return data.groups.filter((g) => g.relevant);
}

export function unresolvedGroups(data: StandingsData): TieGroupInfo[] {
  return data.groups.filter((g) => g.relevant && !g.resolvedOrdering);
}

/** True when this judge's vote counts for the group. */
export function canVoteOnTie(data: StandingsData, group: TieGroupInfo, judgeId: string): boolean {
  return data.tieVoters(group.teamIds).some((j) => j.id === judgeId);
}

export function toTieGroup(data: StandingsData, group: TieGroupInfo, viewerJudgeId?: string): TieGroup {
  const byJudge = data.votes.get(group.groupKey);
  const orderingOf = (judgeId: string) => {
    const ordering = byJudge?.get(judgeId);
    return isPermutationOf(ordering, group.teamIds) ? ordering : null;
  };
  return {
    groupKey: group.groupKey,
    average: group.average,
    positions: group.positions,
    teams: group.teamIds.map((id) => data.teamsById.get(id)!),
    votes: data.tieVoters(group.teamIds).map((j) => {
      const ordering = orderingOf(j.id);
      return { judgeId: j.id, judgeLabel: j.label, judgeName: j.name, submitted: ordering !== null, ordering };
    }),
    myOrdering: viewerJudgeId ? orderingOf(viewerJudgeId) : null,
    resolved: group.resolvedOrdering !== null,
    resolvedOrdering: group.resolvedOrdering,
  };
}

/** Evaluations still missing: every team needs one from every active judge. */
export function countPendingEvaluations(db: D1Database): Promise<number> {
  return countRows(
    db,
    `SELECT COUNT(*) AS n FROM teams t CROSS JOIN judges j
     WHERE j.active = 1 AND NOT EXISTS (SELECT 1 FROM evaluations e WHERE e.team_id = t.id AND e.judge_id = j.id)`,
  );
}

/** True when there is at least one team and one active judge and every pair has an evaluation. */
export async function evaluationsComplete(db: D1Database): Promise<boolean> {
  const [teams, judges, pending] = await Promise.all([
    countRows(db, 'SELECT COUNT(*) AS n FROM teams'),
    countRows(db, 'SELECT COUNT(*) AS n FROM judges WHERE active = 1'),
    countPendingEvaluations(db),
  ]);
  return teams > 0 && judges > 0 && pending === 0;
}
