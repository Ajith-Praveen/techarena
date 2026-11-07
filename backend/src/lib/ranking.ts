import { CRITERIA } from '../criteria';

export interface RankingInput {
  teamId: string;
  name: string;
  orderPosition: number | null;
  evaluations: ReadonlyArray<{ total: number; scores: Record<string, number> }>;
}

export interface RankingEntry {
  teamId: string;
  /** 1-based competition rank, or null when the team has no evaluations. */
  rank: number | null;
  /** True when the team shares its rank (an unresolved or non-relevant tie). */
  tied: boolean;
  /** Mean judge total rounded to 2 decimals, or null when unevaluated. */
  average: number | null;
  evaluationCount: number;
  /** Per-criterion means rounded to 2 decimals (empty when unevaluated). */
  criteriaAverages: Record<string, number>;
}

export interface TieGroupInfo {
  groupKey: string;
  /** Display order: the resolved ordering, else by name. */
  teamIds: string[];
  average: number;
  /** 1-based sorted positions the group spans, e.g. [2, 4]. */
  positions: [number, number];
  /** A tie is relevant when any of its teams would sit at sorted position <= 3. */
  relevant: boolean;
  resolvedOrdering: string[] | null;
}

export interface Ranking {
  /** Ranked teams first (best first), unranked (no evaluations) last. */
  entries: RankingEntry[];
  /** Every group of 2+ teams with exactly equal averages. */
  groups: TieGroupInfo[];
}

/** Returns the agreed ordering for a relevant tie group, or null while unresolved. */
export type TieResolver = (groupKey: string, teamIds: readonly string[]) => string[] | null;

export const TOP_N = 3;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const tieGroupKey = (teamIds: readonly string[]) => [...teamIds].sort().join(',');

export function isPermutationOf(ordering: unknown, teamIds: readonly string[]): ordering is string[] {
  if (!Array.isArray(ordering) || ordering.length !== teamIds.length) return false;
  const want = new Set(teamIds);
  const seen = new Set<string>();
  for (const id of ordering) {
    if (typeof id !== 'string' || !want.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

const byNameThenId = (a: { name: string; teamId: string }, b: { name: string; teamId: string }) => {
  const an = a.name.toLowerCase();
  const bn = b.name.toLowerCase();
  if (an !== bn) return an < bn ? -1 : 1;
  return a.teamId < b.teamId ? -1 : a.teamId > b.teamId ? 1 : 0;
};

/**
 * Ranks teams by average judge total, compared exactly (sumA * countB vs sumB * countA). There is no
 * automatic tiebreak: tied teams share a rank unless the group is relevant to the top 3 and `resolve`
 * returns the judges' agreed ordering. Teams with no evaluations are unranked and returned last.
 */
export function rankTeams(inputs: readonly RankingInput[], resolve: TieResolver): Ranking {
  const scored = inputs.map((t) => {
    const n = t.evaluations.length;
    const sum = t.evaluations.reduce((s, e) => s + e.total, 0);
    const criteriaAverages: Record<string, number> = {};
    if (n) {
      for (const c of CRITERIA) {
        criteriaAverages[c.key] = round2(t.evaluations.reduce((s, e) => s + Number(e.scores[c.key] ?? 0), 0) / n);
      }
    }
    return { teamId: t.teamId, name: t.name, orderPosition: t.orderPosition, n, sum, criteriaAverages };
  });
  type Scored = (typeof scored)[number];
  const compareAverage = (a: Scored, b: Scored) => b.sum * a.n - a.sum * b.n;

  const ranked = scored.filter((s) => s.n > 0).sort((a, b) => compareAverage(a, b) || byNameThenId(a, b));
  const position = (p: number | null) => (p === null ? Number.POSITIVE_INFINITY : p);
  const unranked = scored
    .filter((s) => s.n === 0)
    .sort((a, b) => position(a.orderPosition) - position(b.orderPosition) || byNameThenId(a, b));

  const entries: RankingEntry[] = [];
  const groups: TieGroupInfo[] = [];
  const entry = (s: Scored, rank: number, tied: boolean): RankingEntry => ({
    teamId: s.teamId,
    rank,
    tied,
    average: round2(s.sum / s.n),
    evaluationCount: s.n,
    criteriaAverages: s.criteriaAverages,
  });

  for (let start = 0; start < ranked.length; ) {
    let end = start + 1;
    while (end < ranked.length && compareAverage(ranked[start]!, ranked[end]!) === 0) end++;
    const members = ranked.slice(start, end);
    const firstPosition = start + 1;

    if (members.length === 1) {
      entries.push(entry(members[0]!, firstPosition, false));
    } else {
      const ids = members.map((m) => m.teamId);
      const groupKey = tieGroupKey(ids);
      const relevant = firstPosition <= TOP_N;
      const candidate = relevant ? resolve(groupKey, ids) : null;
      const resolvedOrdering = candidate && isPermutationOf(candidate, ids) ? [...candidate] : null;
      if (resolvedOrdering) {
        const byId = new Map(members.map((m) => [m.teamId, m]));
        resolvedOrdering.forEach((id, i) => entries.push(entry(byId.get(id)!, firstPosition + i, false)));
      } else {
        for (const m of members) entries.push(entry(m, firstPosition, true));
      }
      groups.push({
        groupKey,
        teamIds: resolvedOrdering ?? ids,
        average: round2(members[0]!.sum / members[0]!.n),
        positions: [firstPosition, firstPosition + members.length - 1],
        relevant,
        resolvedOrdering,
      });
    }
    start = end;
  }

  for (const s of unranked) {
    entries.push({ teamId: s.teamId, rank: null, tied: false, average: null, evaluationCount: 0, criteriaAverages: {} });
  }
  return { entries, groups };
}
