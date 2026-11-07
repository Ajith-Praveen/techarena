import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { AppText, Banner, Card, ErrorView, LoadingView, Screen, TeamImage } from '@/components';
import { BigCode } from '@/features/team/BigCode';
import { useIsWide } from '@/features/team/notices';
import { useApi } from '@/hooks';
import { colors, spacing } from '@/theme';

export default function TeamCodeScreen() {
  const { session } = useAuth();
  const { data, error, loading, refreshing, refresh } = useApi(() => api.team());
  const wide = useIsWide();
  // The session already carries the team, so the code shows instantly even offline.
  const team = data?.team ?? session?.team;

  if (!team) {
    return (
      <Screen title="My Code" backHref="/team">
        {loading ? <LoadingView /> : <ErrorView error={error} onRetry={refresh} />}
      </Screen>
    );
  }

  return (
    <Screen title="My Code" backHref="/team" refreshing={refreshing} onRefresh={() => void refresh()}>
      {error && !data ? <Banner type="warning" message={`Showing saved details. ${error.message}`} /> : null}

      <View style={styles.center}>
        <AppText variant="overline" color="accent" align="center">
          Team code
        </AppText>
        <AppText variant={wide ? 'title' : 'heading'} align="center" style={styles.instruction}>
          Show this to the judges at your stall
        </AppText>
        <View style={styles.code}>
          <BigCode code={team.code} />
        </View>
        <AppText color="muted" align="center" style={styles.hint}>
          Judges type these 4 digits on their tablet to open your team and enter your scores.
        </AppText>
      </View>

      <Card style={styles.teamCard}>
        <View style={styles.teamRow}>
          <TeamImage url={team.imageUrl} size={wide ? 96 : 72} />
          <View style={styles.teamText}>
            <AppText variant={wide ? 'title' : 'heading'} numberOfLines={2}>
              {team.name}
            </AppText>
            <AppText color="textSecondary" numberOfLines={3}>
              {team.projectTitle}
            </AppText>
          </View>
        </View>
      </Card>

      <AppText variant="caption" color="faint" align="center">
        Keep your screen on and brightness up while the judges are at your stall.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: spacing.xl },
  instruction: { marginTop: spacing.xs, marginBottom: spacing.xl },
  code: { width: '100%', paddingVertical: spacing.md },
  hint: { marginTop: spacing.xl, maxWidth: 460 },
  teamCard: { borderColor: colors.borderStrong },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  teamText: { flex: 1, gap: spacing.xs },
});
