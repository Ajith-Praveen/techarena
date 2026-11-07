import type { Evaluation, ProgressResponse, ProgressTeam, PublicPerson, PublicTeam } from '@/api/types';

export type { JudgeTiesResponse, TieGroup, TieVote, TieVoteRequest, TieVoteResponse } from '@/api/types';

export type TeamMemberPublic = PublicPerson;

export type JudgePublicTeam = PublicTeam;

export type JudgeEvaluation = Evaluation;

export type JudgeProgress = ProgressResponse;

/** Members to show on a team card: photo-aware list when the server sends it, else names only. */
export function teamPeople(team: JudgePublicTeam): TeamMemberPublic[] {
  if (team.members && team.members.length > 0) return team.members;
  return team.memberNames.map((name, i) => ({ name, role: i === 0 ? 'lead' : 'member', photoUrl: null }));
}

/** Teams in presentation order; teams without a position go last, by name. */
export function sortByPosition<T extends { orderPosition: number | null; name: string }>(teams: T[]): T[] {
  return [...teams].sort((a, b) => {
    if (a.orderPosition === null && b.orderPosition === null) return a.name.localeCompare(b.name);
    if (a.orderPosition === null) return 1;
    if (b.orderPosition === null) return -1;
    return a.orderPosition - b.orderPosition;
  });
}

/** The lowest-position team this judge has not evaluated yet. */
export function nextUpFor(teams: ProgressTeam[]): ProgressTeam | null {
  return sortByPosition(teams).find((t) => !t.evaluatedByMe) ?? null;
}
