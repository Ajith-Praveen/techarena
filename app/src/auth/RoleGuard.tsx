import { Redirect, Stack } from 'expo-router';

import type { Role } from '@/api/types';
import { LoadingView } from '@/components/LoadingView';
import { colors } from '@/theme';

import { useAuth } from './AuthContext';

/** Stack layout that only renders for the given roles; everyone else is sent to '/'. */
export function RoleGuardedStack({ roles }: { roles: readonly Role[] }) {
  const { role, loading } = useAuth();
  if (loading) return <LoadingView fullScreen />;
  if (!role || !roles.includes(role)) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
