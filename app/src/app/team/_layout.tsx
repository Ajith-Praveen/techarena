import { RoleGuardedStack } from '@/auth/RoleGuard';

export default function TeamLayout() {
  return <RoleGuardedStack roles={['lead', 'member']} />;
}
