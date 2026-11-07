import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthContext';
import { homeFor } from '@/auth/routes';
import { LoadingView } from '@/components/LoadingView';

export default function Index() {
  const { role, loading } = useAuth();
  if (loading) return <LoadingView fullScreen message="Loading…" />;
  return <Redirect href={homeFor(role)} />;
}
