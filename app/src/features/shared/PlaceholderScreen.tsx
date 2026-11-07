import { router } from 'expo-router';

import { useAuth } from '@/auth/AuthContext';
import { AppTile, HomeGrid } from '@/components/HomeGrid';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

/** Temporary content for routes a feature agent has not implemented yet. */
export function PlaceholderScreen({ title, home = false }: { title: string; home?: boolean }) {
  const { session, signOut } = useAuth();
  return (
    <Screen title={title} back={!home}>
      <EmptyState icon="construct-outline" title="Not Available Yet" message="This screen is being built." />
      {home && session ? (
        <HomeGrid>
          <AppTile
            label="Log Out"
            icon="log-out-outline"
            destructive
            onPress={async () => {
              await signOut();
              router.replace('/');
            }}
          />
        </HomeGrid>
      ) : null}
    </Screen>
  );
}
