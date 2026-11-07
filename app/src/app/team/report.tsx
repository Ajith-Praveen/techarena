import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { ReportResponse } from '@/api/types';
import { AppText, Banner, Button, Card, EmptyState, ErrorView, LoadingView, Screen, SectionTitle } from '@/components';
import { EvaluationCard } from '@/features/team/EvaluationCard';
import { useIsWide } from '@/features/team/notices';
import { ScoreBar } from '@/features/team/ScoreBar';
import { useApi, usePolling } from '@/hooks';
import { formatAverage, formatScore, ordinal } from '@/lib/format';
import { successFeedback } from '@/lib/haptics';
import { colors, rankColors, spacing } from '@/theme';

function criteriaAverages(report: ReportResponse): Record<string, number> {
  const out: Record<string, number> = {};
  const n = report.evaluations.length;
  if (!n) return out;
  for (const c of report.criteria) {
    out[c.key] = report.evaluations.reduce((sum, e) => sum + (e.scores[c.key] ?? 0), 0) / n;
  }
  return out;
}

export default function ReportScreen() {
  const { data, error, loading, refreshing, refresh, reload } = useApi(() => api.report());
  usePolling(reload, 10_000);
  const wide = useIsWide();

  // Banner when something changes while the screen is open: another judge scored the team (marks
  // still sealed), or the results were just published and the marks are revealed.
  const seen = useRef<{ scored: number; published: boolean } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const now = { scored: data.scoredCount ?? data.evaluations.length, published: data.resultsPublished };
    const before = seen.current;
    seen.current = now;
    if (!before) return;
    if (now.published && !before.published) {
      setBanner('Results are out! Your marks are below.');
      successFeedback();
    } else if (!now.published && now.scored > before.scored) {
      setBanner('A judge just scored your team. Marks are revealed when results are published.');
      successFeedback();
    }
  }, [data]);

  if (loading) {
    return (
      <Screen title="Report" backHref="/team">
        <LoadingView message="Loading your scores…" />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen title="Report" backHref="/team">
        <ErrorView error={error} onRetry={refresh} />
      </Screen>
    );
  }

  const count = data.evaluations.length;
  const scored = data.scoredCount ?? count;
  const judges = data.activeJudgeCount;
  const averages = criteriaAverages(data);
  const rank = data.resultsPublished && data.rank && data.rank <= 3 ? (data.rank as 1 | 2 | 3) : null;

  return (
    <Screen title="Report" backHref="/team" refreshing={refreshing} onRefresh={() => void refresh()}>
      {error ? <Banner type="warning" message={`Couldn't refresh: ${error.message}`} /> : null}
      {banner ? <Banner type="success" title="Update" message={banner} onClose={() => setBanner(null)} /> : null}

      {rank ? (
        <Card tone="gold" style={styles.celebrate}>
          <Ionicons name="trophy" size={56} color={rankColors[rank]} />
          <AppText variant="display" align="center" style={{ color: rankColors[rank] }}>
            {ordinal(rank)} place!
          </AppText>
          <AppText color="textSecondary" align="center">
            Congratulations! Your team finished in the top 3.
          </AppText>
          <Button
            title="See the podium"
            icon="podium"
            variant="secondary"
            fullWidth={false}
            onPress={() => router.push('/team/results')}
          />
        </Card>
      ) : data.resultsPublished ? (
        <Banner
          type="info"
          icon="trophy-outline"
          message="Results have been published. Thanks for taking part!"
          action={{ label: 'See results', onPress: () => router.push('/team/results') }}
        />
      ) : null}

      {!data.resultsPublished ? (
        <Card tone="warning">
          <View style={styles.sealed}>
            <Ionicons name="lock-closed" size={40} color={colors.text} />
            <AppText variant="title2" align="center">
              Scores are sealed
            </AppText>
            <AppText color="textSecondary" align="center" style={styles.sealedText}>
              Your marks are revealed when the results are published, for every team at the same time.
            </AppText>
            <AppText variant="headline" align="center">
              {judges > 0 ? `${scored} of ${judges} judges have scored you` : `${scored} judge${scored === 1 ? '' : 's'} scored you`}
            </AppText>
            <ScoreBar value={scored} max={Math.max(judges, scored, 1)} color={colors.success} height={10} style={styles.sealedBar} />
          </View>
        </Card>
      ) : null}

      {data.resultsPublished && count > 0 ? (
        <Card>
          <View style={[styles.summary, wide ? styles.summaryWide : null]}>
            <View style={[styles.summaryMain, wide ? styles.summaryCol : null]}>
              <AppText variant="overline" color="muted">
                Average score
              </AppText>
              <View style={styles.avgRow}>
                <AppText variant="display" color="accent">
                  {formatAverage(data.average)}
                </AppText>
                <AppText color="muted">/ {data.maxPerJudge}</AppText>
              </View>
              <AppText color="textSecondary">
                {judges > 0
                  ? `${count} of ${judges} judge${judges === 1 ? ' has' : 's have'} evaluated you`
                  : `${count} evaluation${count === 1 ? '' : 's'} received`}
              </AppText>
              <ScoreBar
                value={count}
                max={Math.max(judges, count, 1)}
                color={colors.success}
                height={8}
                style={styles.progress}
              />
            </View>
            {count > 0 ? (
              <View style={[styles.summaryCriteria, wide ? styles.summaryCol : null]}>
                {data.criteria.map((c) => (
                  <View key={c.key} style={styles.criterion}>
                    <View style={styles.criterionTop}>
                      <AppText variant="caption" color="textSecondary" numberOfLines={1} style={styles.flex}>
                        {c.label}
                      </AppText>
                      <AppText variant="caption" weight="700">
                        {formatScore(averages[c.key])} / {c.max}
                      </AppText>
                    </View>
                    <ScoreBar value={averages[c.key] ?? 0} max={c.max} color={colors.violet} />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}

      {!data.resultsPublished ? null : count === 0 ? (
        <EmptyState
          icon="hourglass-outline"
          title="No scores"
          message="No judge scored your team."
        />
      ) : (
        <>
          <SectionTitle title="Scores by judge" />
          <View style={wide ? styles.grid : null}>
            {data.evaluations.map((ev) => (
              <View key={ev.id} style={wide ? styles.gridItem : null}>
                <EvaluationCard
                  evaluation={ev}
                  criteria={data.criteria}
                  maxPerJudge={data.maxPerJudge}
                />
              </View>
            ))}
          </View>
        </>
      )}

      <AppText variant="caption" color="faint" align="center" style={styles.footnote}>
        {data.resultsPublished
          ? 'Scores are final once a judge submits them.'
          : 'Marks stay sealed until results are published. This screen updates on its own.'}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sealed: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  sealedText: { maxWidth: 420 },
  sealedBar: { alignSelf: "stretch", marginTop: spacing.xs },
  celebrate: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  summary: { gap: spacing.lg },
  summaryWide: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xxl },
  summaryMain: { gap: spacing.xs },
  summaryCol: { flex: 1 },
  avgRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  progress: { marginTop: spacing.sm },
  summaryCriteria: { gap: spacing.sm },
  criterion: { gap: spacing.xs },
  criterionTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.sm },
  gridItem: { width: '50%', paddingHorizontal: spacing.sm },
  footnote: { marginTop: spacing.lg },
});
