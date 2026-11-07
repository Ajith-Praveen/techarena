import { StyleSheet, View } from 'react-native';

import type { Criterion, Evaluation } from '@/api/types';
import { AppText, Badge, Card } from '@/components';
import { formatDateTime, formatRelative, formatScore } from '@/lib/format';
import { colors, radius, spacing } from '@/theme';

import { photoUrlOf } from './people';
import { PersonAvatar } from './PersonAvatar';
import { ScoreBar } from './ScoreBar';

export interface EvaluationCardProps {
  evaluation: Evaluation;
  criteria: Criterion[];
  maxPerJudge: number;
  /** Highlight briefly when it just arrived. */
  isNew?: boolean;
}

export function EvaluationCard({ evaluation: ev, criteria, maxPerJudge, isNew }: EvaluationCardProps) {
  return (
    <Card tone={isNew ? 'success' : 'default'}>
      <View style={styles.head}>
        <PersonAvatar name={ev.judgeName} photoUrl={photoUrlOf(ev, 'judgePhotoUrl')} size={44} />
        <View style={styles.headText}>
          <View style={styles.titleRow}>
            <AppText variant="bodyStrong">{ev.judgeLabel}</AppText>
            {isNew ? <Badge label="New" tone="success" /> : null}
          </View>
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {ev.judgeName} · {formatRelative(ev.createdAt)}
          </AppText>
        </View>
        <View style={styles.total}>
          <AppText variant="title" color="accent">
            {formatScore(ev.total)}
          </AppText>
          <AppText variant="caption" color="muted">
            / {maxPerJudge}
          </AppText>
        </View>
      </View>

      <View style={styles.criteria}>
        {criteria.map((c) => {
          const score = ev.scores[c.key];
          return (
            <View key={c.key} style={styles.criterion}>
              <View style={styles.criterionTop}>
                <AppText variant="label" color="textSecondary" numberOfLines={1} style={styles.flex}>
                  {c.label}
                </AppText>
                <AppText variant="label">
                  {score ?? '—'}
                  <AppText variant="caption" color="muted">
                    {' '}
                    / {c.max}
                  </AppText>
                </AppText>
              </View>
              <ScoreBar value={score ?? 0} max={c.max} />
            </View>
          );
        })}
      </View>

      {ev.remarks ? (
        <View style={styles.remarks}>
          <AppText variant="overline" color="muted">
            Remarks
          </AppText>
          <AppText color="textSecondary" selectable>
            {ev.remarks}
          </AppText>
        </View>
      ) : null}

      <AppText variant="caption" color="faint" style={styles.time}>
        Submitted {formatDateTime(ev.createdAt)}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headText: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  total: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  criteria: { marginTop: spacing.lg, gap: spacing.md },
  criterion: { gap: spacing.xs },
  criterionTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  remarks: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  time: { marginTop: spacing.md },
});
