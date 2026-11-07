import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { AppText, Badge, Card, TeamImage } from '@/components';
import { useApi } from '@/hooks';
import { spacing } from '@/theme';

import { nextUpFor } from './types';
import { teamColorOf } from '@/lib/teamColor';

export interface NextUpCardProps {
  /** Skip this team (e.g. the one that was just scored, before progress catches up). */
  excludeTeamId?: string;
}

/**
 * "Up next" for the judge: the lowest-position team they have not scored yet, with its project
 * image, slot and name, so they know which stall to walk to and whose code to ask for.
 * Renders nothing until the presentation order exists.
 */
export function NextUpCard({ excludeTeamId }: NextUpCardProps) {
  const { data } = useApi(() => api.progress());
  if (!data || data.resultsPublished) return null;
  const teams = data.teams.filter((t) => t.id !== excludeTeamId);
  if (!teams.some((t) => t.orderPosition !== null)) return null;
  const next = nextUpFor(teams);

  if (!next) {
    return (
      <Card tone="success">
        <AppText variant="headline">You've scored every team</AppText>
        <AppText variant="footnote" color="muted">
          Open Progress to see where the other judges are.
        </AppText>
      </Card>
    );
  }

  return (
    <Card bandColor={teamColorOf(next)} accessibilityLabel={`Up next: position ${next.orderPosition}, ${next.name}`}>
      <View style={styles.row}>
        <TeamImage url={next.imageUrl} size={76} />
        <View style={styles.flex}>
          <View style={styles.top}>
            <Badge label="Up next" tone="warning" size="md" />
            {next.orderPosition !== null ? <Badge label={`Slot #${next.orderPosition}`} tone="neutral" size="md" /> : null}
          </View>
          <AppText variant="title2" numberOfLines={2}>
            {next.name}
          </AppText>
          <AppText variant="subheadline" color="textSecondary" numberOfLines={1}>
            {next.projectTitle}
          </AppText>
          <AppText variant="caption" color="muted">
            {`${next.evaluationCount} of ${data.judges.length} judges done · ask the team for its code`}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  top: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
});
