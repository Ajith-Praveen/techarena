import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import {
  AppText,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorView,
  LoadingView,
  Screen,
  SectionTitle,
  StatRow,
  StatTile,
} from '@/components';
import { judgeApi } from '@/features/judge/api';
import { PersonAvatar } from '@/features/judge/PersonAvatar';
import { ProgressBar } from '@/features/judge/ProgressBar';
import { TieBreakCard } from '@/features/judge/TieBreakCard';
import { sortByPosition, type JudgeProgress } from '@/features/judge/types';
import { useApi, useAsync, useConfig, usePolling } from '@/hooks';
import { confirm, errorFeedback, plural, successFeedback, toApiError } from '@/lib';
import { colors, spacing } from '@/theme';

const TITLE = 'Progress';
const POLL_MS = 10_000;

type Notice = { type: 'error' | 'warning' | 'info'; title?: string; message: string };

export default function JudgeProgressScreen() {
  const { session } = useAuth();
  const myId = session?.judge?.id;
  const { refresh: refreshConfig } = useConfig();
  const progress = useApi(() => api.progress() as Promise<JudgeProgress>);
  const data = progress.data;

  // Ties can be decided as soon as they appear (the admin may force-publish before every team is scored).
  const tiesEnabled = Boolean(data && !data.resultsPublished);
  const ties = useAsync(() => judgeApi.ties(), [], { enabled: tiesEnabled });
  // 404 means this server has no tie-break endpoint; treat as "no ties".
  const tiesUnsupported = ties.error?.status === 404;
  const tieGroups = tiesEnabled && !tiesUnsupported ? (ties.data?.ties ?? []) : [];

  usePolling(progress.reload, POLL_MS);
  usePolling(ties.reload, POLL_MS, tiesEnabled && !tiesUnsupported);

  const [notice, setNotice] = useState<Notice | null>(null);

  if (progress.loading) {
    return (
      <Screen title={TITLE} backHref="/judge">
        <LoadingView message="Loading progress…" />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen title={TITLE} backHref="/judge">
        <ErrorView error={progress.error} onRetry={progress.refresh} />
      </Screen>
    );
  }

  const judgeCount = data.judges.length;
  const teams = sortByPosition(data.teams);
  const myDone = teams.filter((t) => t.evaluatedByMe).length;
  const expected = data.totalTeams * judgeCount;
  const done = teams.reduce((s, t) => s + Math.min(t.evaluationCount, judgeCount), 0);
  const pendingTeams = teams.filter((t) => t.evaluationCount < judgeCount);
  const unresolvedTies = data.unresolvedTies ?? tieGroups.filter((t) => !t.resolved).length;
  const canPublish = data.complete && !data.resultsPublished && unresolvedTies === 0;

  const onRefresh = async () => {
    await Promise.all([progress.refresh(), tiesEnabled ? ties.reload() : Promise.resolve()]);
  };

  const onPublish = async () => {
    const ok = await confirm(
      'Publish results?',
      'This releases the top 3 to everyone and closes judging. It cannot be undone.',
      'Publish',
      { destructive: true },
    );
    if (!ok) return;
    setNotice(null);
    try {
      await api.publishResults({});
      // The "Results are published" card replaces the publish card once progress reloads.
      successFeedback();
    } catch (e) {
      errorFeedback();
      const err = toApiError(e);
      if (err.code === 'INCOMPLETE') {
        setNotice({
          type: 'warning',
          title: 'Not all teams are scored yet',
          message:
            err.pending !== undefined
              ? `${plural(err.pending, 'evaluation')} still pending. Every judge must score every team first.`
              : err.message,
        });
      } else if (err.code === 'RESULTS_PUBLISHED') {
        setNotice({ type: 'info', title: 'Already published', message: 'Results were already published by someone else.' });
      } else if (err.code === 'TIES_UNRESOLVED') {
        setNotice({ type: 'warning', title: 'Ties must be resolved first', message: err.message });
        void ties.reload();
      } else {
        setNotice({ type: 'error', title: 'Could not publish results', message: err.message });
      }
    } finally {
      void refreshConfig();
      await progress.reload();
    }
  };

  return (
    <Screen title={TITLE} backHref="/judge" refreshing={progress.refreshing} onRefresh={() => void onRefresh()}>
      {progress.error ? <Banner type="warning" message={`Could not refresh: ${progress.error.message}`} /> : null}

      <StatRow>
        <StatTile label="Teams" value={data.totalTeams} icon="people" tone="accent" />
        <StatTile label="You scored" value={myDone} hint={`of ${data.totalTeams}`} icon="person" tone="violet" />
        <StatTile
          label="All evaluations"
          value={done}
          hint={`of ${expected} (${plural(judgeCount, 'judge')})`}
          icon="checkmark-done"
          tone={data.complete ? 'success' : 'warning'}
        />
      </StatRow>

      {/* Publish */}
      {data.resultsPublished ? (
        <Card tone="gold">
          <View style={styles.publishHead}>
            <Ionicons name="trophy" size={28} color={colors.gold} />
            <View style={styles.flex}>
              <AppText variant="heading">Results are published</AppText>
              <AppText variant="caption" color="muted">
                Judging is closed. Everyone can now see the top 3.
              </AppText>
            </View>
          </View>
          <Button title="View results" icon="trophy-outline" onPress={() => router.push('/judge/results')} />
        </Card>
      ) : null}

      {notice ? <Banner type={notice.type} title={notice.title} message={notice.message} /> : null}

      {tieGroups.length > 0 ? (
        <>
          <SectionTitle title={`Tie-break (${unresolvedTies} unresolved)`} />
          {!data.complete ? (
            <AppText variant="footnote" color="muted" style={{ marginBottom: 8 }}>
              Scoring isn't finished, so these ties can still change. You can decide now or wait.
            </AppText>
          ) : null}
          {tieGroups.map((tie) => (
            <TieBreakCard
              key={`${tie.groupKey}|${tie.myOrdering?.join(',') ?? ''}`}
              tie={tie}
              myJudgeId={myId}
              onChanged={() => {
                void ties.reload();
                void progress.reload();
              }}
            />
          ))}
        </>
      ) : null}
      {tiesEnabled && ties.error && !tiesUnsupported ? (
        <Banner
          type="warning"
          message={`Could not load tie-breaks: ${ties.error.message}`}
          action={{ label: 'Retry', onPress: () => void ties.refresh() }}
        />
      ) : null}

      {!data.resultsPublished ? (
        <Card tone={canPublish ? 'accent' : 'default'}>
          <AppText variant="heading">Publish results</AppText>
          <AppText color="muted" style={styles.publishText}>
            {canPublish
              ? 'Every team has been scored by every judge. Publishing releases the top 3 and closes judging.'
              : !data.complete
                ? `Available once every judge has scored every team. ${plural(expected - done, 'evaluation')} to go.`
                : `Resolve the ${plural(unresolvedTies, 'tie')} above first.`}
          </AppText>
          {!data.complete && pendingTeams.length > 0 ? (
            <View style={styles.pendingList}>
              {pendingTeams.slice(0, 8).map((t) => (
                <Badge
                  key={t.id}
                  label={`${t.orderPosition !== null ? `#${t.orderPosition} ` : ''}${t.name} · ${t.evaluationCount}/${judgeCount}`}
                  tone="warning"
                />
              ))}
              {pendingTeams.length > 8 ? <Badge label={`+${pendingTeams.length - 8} more`} tone="neutral" /> : null}
            </View>
          ) : null}
          <Button title="Publish Results" icon="megaphone" size="lg" onPress={onPublish} disabled={!canPublish} />
        </Card>
      ) : null}

      {/* Judges */}
      <SectionTitle title="Judges" />
      {judgeCount === 0 ? (
        <Card>
          <AppText color="muted">No active judges.</AppText>
        </Card>
      ) : (
        <Card>
          {data.judges.map((j, i) => (
            <View key={j.id} style={[styles.judgeRow, i < judgeCount - 1 ? styles.divider : null]}>
              <PersonAvatar name={j.name} size={40} />
              <View style={styles.flex}>
                <View style={styles.judgeTop}>
                  <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                    {j.label} · {j.name}
                    {j.id === myId ? <AppText color="accent"> (you)</AppText> : null}
                  </AppText>
                  <AppText variant="label" color={j.evaluatedCount >= data.totalTeams && data.totalTeams > 0 ? 'success' : 'textSecondary'}>
                    {j.evaluatedCount} / {data.totalTeams}
                  </AppText>
                </View>
                <ProgressBar
                  value={j.evaluatedCount}
                  max={data.totalTeams}
                  color={j.evaluatedCount >= data.totalTeams && data.totalTeams > 0 ? colors.success : colors.accent}
                />
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* Teams */}
      <SectionTitle title="Teams" />
      {teams.length === 0 ? (
        <EmptyState icon="people-outline" title="No teams yet" message="Teams appear here once they register." />
      ) : (
        <Card padded={false}>
          {teams.map((t, i) => {
            const teamDone = judgeCount > 0 && t.evaluationCount >= judgeCount;
            return (
              <View key={t.id} style={[styles.teamRow, i < teams.length - 1 ? styles.divider : null]}>
                <AppText variant="label" color="muted" style={styles.position}>
                  {t.orderPosition !== null ? `#${t.orderPosition}` : '—'}
                </AppText>
                <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                  {t.name}
                </AppText>
                {t.evaluatedByMe ? (
                  <Badge label="Done" tone="success" icon="checkmark" />
                ) : (
                  <Badge label="Pending" tone="warning" icon="time-outline" />
                )}
                <AppText variant="label" color={teamDone ? 'success' : 'muted'} style={styles.count}>
                  {t.evaluationCount}/{judgeCount}
                </AppText>
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  publishHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  publishText: { marginTop: spacing.xs, marginBottom: spacing.md },
  pendingList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  judgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  judgeTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs + 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
    paddingVertical: spacing.sm,
  },
  position: { width: 40 },
  count: { minWidth: 40, textAlign: 'right' },
});
