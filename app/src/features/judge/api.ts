import { api } from '@/api/client';

/** Tie-break endpoints (SPEC section 9, judge). */
export const judgeApi = {
  ties: api.judgeTies,
  voteTie: api.voteTie,
} as const;
