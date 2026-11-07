import { api } from '@/api/client';
import type { GenerateOrderResponse, LeaderboardEntry } from '@/api/types';

// Small readers kept from before the shared types carried photos / tie flags.

export function photoUrlOf(person: object): string | null {
  const v = (person as { photoUrl?: unknown }).photoUrl;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function judgePhotoOf(evaluation: object): string | null {
  const v = (evaluation as { judgePhotoUrl?: unknown }).judgePhotoUrl;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function missingPhotosOf(obj: object): number | null {
  const v = (obj as { missingPhotos?: unknown }).missingPhotos;
  return typeof v === 'number' ? v : null;
}

/**
 * Entries share a rank when they are tied (competition ranking). Uses the server's `tied`
 * flag when present, otherwise detects duplicate ranks.
 */
export function tiedRanks(entries: LeaderboardEntry[]): Set<string> {
  const counts = new Map<number, number>();
  for (const e of entries) if (e.rank !== null) counts.set(e.rank, (counts.get(e.rank) ?? 0) + 1);
  const tied = new Set<string>();
  for (const e of entries) {
    const flag = (e as { tied?: unknown }).tied;
    if (flag === true || (e.rank !== null && (counts.get(e.rank) ?? 0) > 1)) tied.add(e.team.id);
  }
  return tied;
}

/** PUT /api/admin/order: manual rearrangement (SPEC section 9). */
export function saveOrder(teamIds: string[]): Promise<GenerateOrderResponse> {
  return api.setOrder({ teamIds });
}
