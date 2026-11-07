import type { ImageMime, PublicTeam } from '@/api/types';
import type { PickedImage } from '@/lib/image';

/**
 * SPEC section 8 adds `photoUrl` to Member / Judge / Evaluation (`judgePhotoUrl`) and `members` to PublicTeam.
 * The shared client types may not carry these yet, so read them defensively.
 */
export function photoUrlOf(entity: object | null | undefined, key: 'photoUrl' | 'judgePhotoUrl' = 'photoUrl'): string | null {
  if (!entity) return null;
  const value = (entity as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : null;
}

export interface PublicPerson {
  name: string;
  role: 'lead' | 'member' | null;
  photoUrl: string | null;
}

/** Members of a public team (lead first), with photos. */
export function publicMembers(team: PublicTeam): PublicPerson[] {
  if (Array.isArray(team.members)) {
    return team.members.map((m) => ({ name: m.name, role: m.role ?? null, photoUrl: m.photoUrl ?? null }));
  }
  return team.memberNames.map((name) => ({ name, role: null, photoUrl: null }));
}

/** Profile photo fields for register / add-member bodies (SPEC: `photoBase64`, `photoMime`). */
export interface PhotoUpload {
  photoBase64: string;
  photoMime: ImageMime;
}

export function toPhotoUpload(img: PickedImage): PhotoUpload {
  return { photoBase64: img.base64, photoMime: img.mime };
}
