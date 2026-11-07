import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useState } from 'react';

import { api, ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { AppText, AppTile, Badge, Banner, Button, Card, ErrorView, HomeGrid, LoadingView, Screen } from '@/components';
import { PersonAvatar } from '@/features/judge/PersonAvatar';
import { ProgressBar } from '@/features/judge/ProgressBar';
import { nextUpFor, type JudgeProgress } from '@/features/judge/types';
import { useApi, useConfig, usePolling } from '@/hooks';
import { alert, confirm } from '@/lib';
import { colors, spacing } from '@/theme';

export default function JudgeHomeScreen() {
  const { session, signOut } = useAuth();
  const { config, refresh: refreshConfig } = useConfig();
  const [drawing, setDrawing] = useState(false);
  const { data, error, loading, refreshing, refresh, reload } = useApi(() => api.progress() as Promise<JudgeProgress>);
  usePolling(reload, 15_000);

  const judge = session?.judge;
  const judgeName = judge?.name ?? 'Judge';
  const eventName = config?.eventName || 'Tech Arena';

  const onLogout = async () => {
    const ok = await confirm('Log out?', 'You will need your username and password to sign in again.', 'Log out', {
      destructive: true,
    });
    if (!ok) return;
    await signOut();
    router.replace('/');
  };

  // Any judge can draw the random order once; the first tap wins for everyone.
  const onDrawOrder = async (teamCount: number) => {
    const ok = await confirm(
      'Draw the order?',
      `All ${teamCount} teams get a random presentation slot and registration closes. Judges can't redraw it afterwards.`,
      'Draw order',
    );
    if (!ok) return;
    setDrawing(true);
    try {
      await api.judgeGenerateOrder();
      void refreshConfig();
      await reload();
      router.push('/judge/queue');
    } catch (e) {
      await reload();
      if (e instanceof ApiError && e.status === 409) {
        await alert('Already drawn', 'Another judge drew the order a moment ago. Open Queue to see it.');
      } else {
        await alert('Could not draw the order', e instanceof Error ? e.message : 'Try again.');
      }
    } finally {
      setDrawing(false);
    }
  };

  const header = (
    <View style={styles.hero}>
      <PersonAvatar name={judgeName} photoUrl={(judge as { photoUrl?: string | null } | undefined)?.photoUrl} size={56} />
      <View style={styles.flex}>
        <AppText variant="overline" color="muted">
          {eventName} · Judge
        </AppText>
        <AppText variant="title" numberOfLines={1}>
          {judgeName}
        </AppText>
      </View>
    </View>
  );

  if (loading) {
    return (
      <Screen back={false} header={false}>
        {header}
        <LoadingView message="Loading your progress…" />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen back={false} header={false}>
        {header}
        <ErrorView error={error} onRetry={refresh} />
        <Button title="Log out" icon="log-out-outline" variant="secondary" onPress={onLogout} />
      </Screen>
    );
  }

  const myDone = data.teams.filter((t) => t.evaluatedByMe).length;
  const total = data.totalTeams;
  const nextUp = nextUpFor(data.teams);
  const publishReady = data.complete && !data.resultsPublished;
  const orderDrawn = data.teams.some((t) => t.orderPosition !== null);

  return (
    <Screen back={false} header={false} refreshing={refreshing} onRefresh={refresh}>
      {header}

      {error ? <Banner type="warning" message={`Could not refresh: ${error.message}`} /> : null}
      {data.resultsPublished ? (
        <Banner
          type="success"
          title="Results are published"
          message="Judging is closed. The top 3 are visible to everyone."
          action={{ label: 'View results', onPress: () => router.push('/judge/results') }}
        />
      ) : publishReady ? (
        <Banner
          type="info"
          title="All teams evaluated"
          message="Every team has been scored by every judge. Review progress and publish the results."
          action={{ label: 'Go to Progress', onPress: () => router.push('/judge/progress') }}
        />
      ) : null}

      {!orderDrawn && !data.resultsPublished && total > 0 ? (
        <Card tone="warning">
          <AppText variant="title2">Draw the order</AppText>
          <AppText variant="subheadline" color="textSecondary" style={styles.drawText}>
            {`No presentation order yet. One tap shuffles all ${total} teams into a random order for everyone. Only one judge needs to do this.`}
          </AppText>
          <Button title="Draw the order" icon="shuffle" size="lg" loading={drawing} onPress={() => onDrawOrder(total)} />
        </Card>
      ) : null}

      <Card tone="accent">
        <View style={styles.progressTop}>
          <AppText variant="overline" color="muted">
            Your progress
          </AppText>
          <AppText variant="bodyStrong">
            {myDone} <AppText color="muted">of {total} teams</AppText>
          </AppText>
        </View>
        <ProgressBar value={myDone} max={total} height={10} color={myDone === total && total > 0 ? colors.success : colors.accent} />
        <View style={styles.cta}>
          <Button
            title="Enter Team Code"
            icon="keypad"
            size="lg"
            onPress={() => router.push('/judge/enter-code')}
            disabled={data.resultsPublished}
          />
        </View>
      </Card>

      {!data.resultsPublished ? (
        nextUp ? (
          <Card onPress={() => router.push('/judge/enter-code')} accessibilityLabel={`Next up: ${nextUp.name}`}>
            <View style={styles.nextRow}>
              <View style={styles.position}>
                <AppText variant="caption" color="muted">
                  Next up
                </AppText>
                <AppText variant="title" color="accent">
                  {nextUp.orderPosition !== null ? `#${nextUp.orderPosition}` : '—'}
                </AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="heading" numberOfLines={1}>
                  {nextUp.name}
                </AppText>
                <AppText variant="caption" color="muted">
                  {nextUp.orderPosition === null
                    ? 'Presentation order not generated yet.'
                    : `${nextUp.evaluationCount} of ${data.judges.length} judges done. Ask the team for its code.`}
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.muted} />
            </View>
          </Card>
        ) : total > 0 ? (
          <Card tone="success">
            <View style={styles.nextRow}>
              <Ionicons name="checkmark-done-circle" size={36} color={colors.success} />
              <View style={styles.flex}>
                <AppText variant="heading">You're all done</AppText>
                <AppText variant="caption" color="muted">
                  You have scored every team. Check Progress for the other judges.
                </AppText>
              </View>
            </View>
          </Card>
        ) : (
          <Card>
            <AppText color="muted">No teams have registered yet.</AppText>
          </Card>
        )
      ) : null}

      <HomeGrid style={styles.grid}>
        <AppTile label="Enter Code" icon="keypad" gradient="cyan" href="/judge/enter-code" disabled={data.resultsPublished} />
        <AppTile label="Queue" icon="list" gradient="blue" href="/judge/queue" />
        <AppTile label="My Scores" icon="clipboard" gradient="violet" href="/judge/my-evaluations" value={myDone} />
        <AppTile label="Progress" icon="stats-chart" gradient="green" href="/judge/progress" badge={publishReady ? true : undefined} />
        <AppTile label="Results" icon="trophy" gradient="gold" href="/judge/results" badge={data.resultsPublished ? true : undefined} />
        <AppTile label="Logout" icon="log-out" gradient="slate" onPress={onLogout} />
      </HomeGrid>

      {data.resultsPublished ? null : (
        <View style={styles.footerNote}>
          <Badge label="Scores are final once submitted" tone="neutral" icon="lock-closed" style={styles.centered} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm },
  cta: { marginTop: spacing.lg },
  drawText: { marginTop: spacing.xs, marginBottom: spacing.lg },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  position: { alignItems: 'center', minWidth: 64 },
  grid: { marginTop: spacing.sm },
  footerNote: { alignItems: 'center', marginTop: spacing.lg },
  centered: { alignSelf: 'center' },
});
