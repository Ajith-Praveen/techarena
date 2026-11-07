import { RoleGuardedStack } from '@/auth/RoleGuard';

export default function AdminLayout() {
  return <RoleGuardedStack roles={['admin']} />;
}
