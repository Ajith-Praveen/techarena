import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { ProgressTeam } from '@/api/types';
import { AppText, Badge, Banner, Card, EmptyState, ErrorView, LoadingView, Screen, StatRow, StatTile } from '@/components';
import { ScoreBreakdown } from '@/features/judge/ScoreBreakdown';
import { useApi, useConfig } from '@/hooks';
import { formatRelative, formatScore, plural } from '@/lib';
import { spacing } from '@/theme';

const TITLE = 'My scores';

export default function JudgeMyEvaluationsScreen() {
  const { config } = useConfig();
  const { data, error, loading, refreshing, refresh } = useApi(async () => {
    const [mine, progress] = await Promise.all([api.myEvaluations(), api.progress()]);
    return { evaluations: mine.evaluations, teams: progress.teams, totalTeams: progress.totalTeams };
  });

  if (loading) {
    return (
      <Screen title={TITLE} backHref="/judge">
        <LoadingView message="Loading your evaluations…" />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen title={TITLE} backHref="/judge">
        <ErrorView error={error} onRetry={refresh} />
      </Screen>
    );
  }

  const teamsById = new Map<string, ProgressTeam>(data.teams.map((t) => [t.id, t]));
  const { evaluations } = data;
  const average = evaluations.length ? evaluations.reduce((s, e) => s + e.total, 0) / evaluations.length : null;
  const maxPerJudge = config?.maxPerJudge;

  return (
    <Screen title={TITLE} backHref="/judge" refreshing={refreshing} onRefresh={refresh}>
      {error ? <Banner type="warning" message={`Could not refresh: ${error.message}`} /> : null}

      {evaluations.length === 0 ? (
        <EmptyState
          icon="clipboard-outline"
          title="No scores yet"
          message="Teams you evaluate will show up here. Scores are final once submitted."
          action={{ label: 'Enter a team code', icon: 'keypad', onPress: () => router.push('/judge/enter-code') }}
        />
      ) : (
        <>
          <StatRow>
            <StatTile label="Scored" value={evaluations.length} hint={`of ${plural(data.totalTeams, 'team')}`} icon="checkmark-done" tone="success" />
            <StatTile
              label="Your average"
              value={formatScore(average, 1)}
              hint={maxPerJudge ? `out of ${maxPerJudge}` : undefined}
              icon="analytics"
              tone="violet"
            />
          </StatRow>

          {evaluations.map((ev) => {
            const team = teamsById.get(ev.teamId);
            return (
              <Card key={ev.id}>
                <View style={styles.head}>
                  {team?.orderPosition != null ? <Badge label={`#${team.orderPosition}`} tone="accent" /> : null}
                  <AppText variant="heading" numberOfLines={1} style={styles.flex}>
                    {team?.name ?? 'Team'}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {formatRelative(ev.createdAt)}
                  </AppText>
                </View>
                <ScoreBreakdown evaluation={ev} criteria={config?.criteria} maxPerJudge={maxPerJudge} />
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
});
