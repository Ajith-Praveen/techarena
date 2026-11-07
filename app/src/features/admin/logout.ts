import { router } from 'expo-router';
import { useCallback } from 'react';

import { useAuth } from '@/auth/AuthContext';
import { confirm } from '@/lib/dialogs';

export function useAdminLogout(): () => Promise<void> {
  const { signOut } = useAuth();
  return useCallback(async () => {
    const ok = await confirm('Log out?', 'You will need the admin password to sign in again.', 'Log out');
    if (!ok) return;
    await signOut();
    router.replace('/');
  }, [signOut]);
}
