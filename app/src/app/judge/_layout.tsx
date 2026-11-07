import { RoleGuardedStack } from '@/auth/RoleGuard';

export default function JudgeLayout() {
  return <RoleGuardedStack roles={['judge']} />;
}
