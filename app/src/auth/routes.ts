import type { Href } from 'expo-router';

import type { Role } from '@/api/types';

/** Home route for a signed-in role ('/' resolves this automatically). */
export function homeFor(role: Role | null | undefined): Href {
  switch (role) {
    case 'lead':
    case 'member':
      return '/team';
    case 'judge':
      return '/judge';
    case 'admin':
      return '/admin';
    default:
      return '/welcome';
  }
}
