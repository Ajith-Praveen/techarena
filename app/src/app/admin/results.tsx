import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { AppText, Banner, Button } from '@/components';
import { ProgressBar } from '@/features/admin/ProgressBar';
import { ResultsView } from '@/features/shared/ResultsView';
import { fetchConfig, useApi, usePolling } from '@/hooks';
import { confirm, errorFeedback, plural, successFeedback, toApiError } from '@/lib';
import { colors, layout, spacing } from '@/theme';

function sentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

export default function AdminResultsScreen() {
  const { data, error, reload, setData } = useApi(() => api.adminOverview());
  // Remounting ResultsView makes it fetch the freshly published podium.
  const [viewKey, setViewKey] = useState(0);
  const published = data?.resultsPublished ?? false;
  usePolling(reload, 15_000, !published);

  return (
    <View style={styles.root}>
      <View style={styles.flex}>
        <ResultsView key={viewKey} />
      </View>
      {Platform.OS === 'web' ? (
        <View style={styles.showBar}>
          <Button
            title="Big screen reveal with music"
            icon="musical-notes"
            variant="secondary"
            fullWidth={false}
            onPress={() => router.push('/admin/reveal')}
          />
        </View>
      ) : null}
      {!data && error ? (
        <PublishBarShell>
          <Banner type="error" message={`Could not load judging status: ${error.message}`} action={{ label: 'Retry', onPress: () => void reload() }} />
        </PublishBarShell>
      ) : data && !published ? (
        <PublishBar
          evaluations={data.evaluations}
          expected={data.expectedEvaluations}
          onPublished={(publishedAt) => {
            setData((d) => (d ? { ...d, resultsPublished: true, resultsPublishedAt: publishedAt } : d));
            setViewKey((k) => k + 1);
            void fetchConfig(true);
            void reload();
          }}
        />
      ) : null}
    </View>
  );
}

function PublishBarShell({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.barInner}>{children}</View>
    </View>
  );
}

function PublishBar({
  evaluations,
  expected,
  onPublished,
}: {
  evaluations: number;
  expected: number;
  onPublished: (publishedAt: string) => void;
}) {
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const stacked = useWindowDimensions().width < 480;
  const complete = expected > 0 && evaluations >= expected;
  const pending = Math.max(0, expected - evaluations);

  const publish = async (force: boolean) => {
    setError(null);
    const ok = force
      ? await confirm(
          'Force publish results?',
          `${pending > 0 ? `${plural(pending, 'evaluation')} still missing will be ignored: ` : ''}the ranking uses only the scores submitted so far. Judges can no longer submit scores afterwards.\n\nThis cannot be undone.`,
          'Force publish',
          { destructive: true },
        )
      : await confirm(
          'Publish results?',
          'Everyone will see the top 3 teams. Judges can no longer submit scores.\n\nThis cannot be undone.',
          'Publish',
          { destructive: true },
        );
    if (!ok) return;
    try {
      const res = await api.publishResults({ force });
      successFeedback();
      onPublished(res.publishedAt);
    } catch (e) {
      errorFeedback();
      const err = toApiError(e);
      if (err.code === 'INCOMPLETE') {
        setError({
          title: 'Judging is not finished',
          message: `${sentence(err.message)} Use Force publish to publish with the scores submitted so far.`,
        });
      } else if (err.code === 'TIES_UNRESOLVED') {
        setError({
          title: 'Tie in the top 3',
          message: `${sentence(err.message)} Judges must agree on the order from their Progress screen. Admin cannot break ties.`,
        });
      } else if (err.code === 'RESULTS_PUBLISHED') {
        onPublished(new Date().toISOString());
      } else {
        setError({ title: 'Could not publish', message: err.message });
      }
    }
  };

  return (
    <PublishBarShell>
      {error ? <Banner type="error" title={error.title} message={error.message} onClose={() => setError(null)} /> : null}
      <View style={styles.progressRow}>
        <AppText variant="label" color="textSecondary">
          {expected > 0 ? `${evaluations} of ${expected} evaluations` : 'No evaluations expected yet'}
        </AppText>
        <AppText variant="label" color={complete ? 'success' : 'warning'}>
          {complete ? 'Complete' : `${pending} pending`}
        </AppText>
      </View>
      <ProgressBar value={evaluations} max={expected} color={complete ? colors.success : colors.accent} height={6} style={styles.progress} />
      <View style={[styles.buttons, stacked ? styles.stacked : null]}>
        <Button
          title="Publish results"
          icon="trophy"
          fullWidth={stacked}
          style={stacked ? null : styles.flex}
          onPress={() => publish(false)}
        />
        <Button
          title="Force publish"
          icon="flash-outline"
          variant="danger"
          fullWidth={stacked}
          style={stacked ? null : styles.flex}
          onPress={() => publish(true)}
        />
      </View>
    </PublishBarShell>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  showBar: { alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bgElevated },
  bar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  barInner: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progress: { marginTop: spacing.xs, marginBottom: spacing.md },
  buttons: { flexDirection: 'row-reverse', gap: spacing.md },
  stacked: { flexDirection: 'column', gap: spacing.sm },
});
