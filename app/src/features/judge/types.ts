import { getAuthToken } from '@/api/client';
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

/**
 * Teams this judge scored on this device in this session. The server's progress can lag a moment behind a
 * submit; counting these as scored stops the just-scored team from showing as "Now presenting" again.
 */
const scoredHere = new Map<string, string | null>(); // team id -> the judge login that scored it
export function markScoredHere(teamId: string) {
  scoredHere.set(teamId, getAuthToken());
}

const isScored = (t: ProgressTeam) =>
  t.evaluatedByMe || (scoredHere.has(t.id) && scoredHere.get(t.id) === getAuthToken() && getAuthToken() !== null);

/** Index (in presentation order) of the last team this judge has scored, or -1. */
function lastScoredIndex(sorted: ProgressTeam[]): number {
  for (let i = sorted.length - 1; i >= 0; i--) if (isScored(sorted[i]!)) return i;
  return -1;
}

/**
 * The team presenting to this judge now: the first unscored team after the last one they scored (so a skipped
 * or absent team does not pull them backwards). Once nothing is left after that, it wraps to any skipped team.
 */
export function nextUpFor(teams: ProgressTeam[]): ProgressTeam | null {
  const sorted = sortByPosition(teams);
  const last = lastScoredIndex(sorted);
  return sorted.slice(last + 1).find((t) => !isScored(t)) ?? sorted.find((t) => !isScored(t)) ?? null;
}

/** Unscored teams that come before the judge's current position (skipped or absent so far). */
export function skippedFor(teams: ProgressTeam[]): ProgressTeam[] {
  const sorted = sortByPosition(teams);
  const last = lastScoredIndex(sorted);
  return sorted.slice(0, Math.max(0, last)).filter((t) => !isScored(t) && t.orderPosition !== null);
}
