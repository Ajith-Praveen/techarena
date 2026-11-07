import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { AppText, Badge, Card, EmptyState, ErrorView, LoadingView, Screen, StatRow, StatTile } from '@/components';
import { useApi, useConfig } from '@/hooks';
import { formatDateTime } from '@/lib/format';
import { openUrl } from '@/lib/share';
import { colors, palette, spacing } from '@/theme';

function Stars({ n, size = 18 }: { n: number; size?: number }) {
  return (
    <View style={styles.stars} accessibilityLabel={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= n ? 'star' : 'star-outline'} size={size} color={i <= n ? palette.yellow : colors.faint} />
      ))}
    </View>
  );
}

/** Admin: every app rating with feedback, the average, and a link to the GitHub repo. */
export default function AdminRatingsScreen() {
  const { config } = useConfig();
  const { data, error, loading, refreshing, refresh } = useApi(() => api.adminRatings());

  if (loading) {
    return (
      <Screen title="Ratings" backHref="/admin">
        <LoadingView />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen title="Ratings" backHref="/admin">
        <ErrorView error={error} onRetry={refresh} />
      </Screen>
    );
  }

  const withFeedback = data.ratings.filter((r) => r.feedback).length;

  return (
    <Screen title="App ratings" backHref="/admin" refreshing={refreshing} onRefresh={() => void refresh()}>
      <StatRow>
        <StatTile label="Average" value={data.average !== null ? data.average.toFixed(1) : '–'} hint="of 5" icon="star" tone="gold" />
        <StatTile label="Ratings" value={data.count} icon="people" tone="accent" />
        <StatTile label="With feedback" value={withFeedback} icon="chatbubble-ellipses" tone="violet" />
      </StatRow>
      {config?.githubUrl ? (
        <AppText variant="footnote" color="muted" style={styles.note}>
          The average also shows as a live badge on your GitHub page.{' '}
          <AppText variant="footnote" color="accent" onPress={() => void openUrl(config.githubUrl!)} style={styles.link}>
            Open GitHub
          </AppText>
        </AppText>
      ) : null}
      {data.ratings.length === 0 ? (
        <EmptyState icon="star-outline" title="No ratings yet" message="Teams are asked to rate once their teammates are added; judges after their first score." />
      ) : (
        data.ratings.map((r, i) => (
          <Card key={`${r.name}-${r.updatedAt}-${i}`}>
            <View style={styles.head}>
              <Stars n={r.stars} />
              <Badge label={r.role === 'judge' ? 'Judge' : 'Team'} tone={r.role === 'judge' ? 'info' : 'neutral'} />
            </View>
            <AppText variant="headline" style={styles.name}>
              {r.name}
              {r.teamName ? <AppText color="muted">{` · ${r.teamName}`}</AppText> : null}
            </AppText>
            {r.feedback ? <AppText style={styles.feedback}>{r.feedback}</AppText> : null}
            <AppText variant="caption" color="faint">
              {formatDateTime(r.updatedAt)}
            </AppText>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { marginTop: spacing.sm },
  feedback: { marginTop: spacing.xs, marginBottom: spacing.sm },
  note: { marginBottom: spacing.lg },
  link: { textDecorationLine: 'underline' },
});
