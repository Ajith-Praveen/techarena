import { StyleSheet, View } from 'react-native';

import type { Criterion, Evaluation } from '@/api/types';
import { AppText } from '@/components';
import { formatDateTime } from '@/lib';
import { colors, radius, spacing } from '@/theme';

import { ProgressBar } from './ProgressBar';

export interface ScoreBreakdownProps {
  evaluation: Evaluation;
  /** From /api/config. When missing, rows fall back to the raw score keys. */
  criteria?: Criterion[] | null;
  maxPerJudge?: number | null;
  showRemarks?: boolean;
  showTime?: boolean;
}

/** Read-only per-criterion scores with the total. Evaluations are final, so there is no edit control. */
export function ScoreBreakdown({ evaluation, criteria, maxPerJudge, showRemarks = true, showTime = true }: ScoreBreakdownProps) {
  const rows: Criterion[] =
    criteria && criteria.length > 0
      ? criteria
      : Object.keys(evaluation.scores).map((key) => ({ key, label: key, description: '', max: 10 }));
  const max = maxPerJudge ?? rows.reduce((s, c) => s + c.max, 0);

  return (
    <View>
      {rows.map((c) => {
        const score = evaluation.scores[c.key];
        return (
          <View key={c.key} style={styles.row}>
            <View style={styles.rowTop}>
              <AppText variant="label" color="textSecondary" style={styles.flex} numberOfLines={1}>
                {c.label}
              </AppText>
              <AppText variant="bodyStrong">
                {score ?? '—'}
                <AppText variant="caption" color="muted">
                  {' '}
                  / {c.max}
                </AppText>
              </AppText>
            </View>
            <ProgressBar value={score ?? 0} max={c.max} height={6} />
          </View>
        );
      })}
      <View style={styles.total}>
        <AppText variant="overline" color="muted">
          Total
        </AppText>
        <AppText variant="title" color="accent">
          {evaluation.total}
          <AppText variant="subheading" color="muted">
            {' '}
            / {max}
          </AppText>
        </AppText>
      </View>
      {showRemarks && evaluation.remarks ? (
        <View style={styles.remarks}>
          <AppText variant="overline" color="muted">
            Remarks
          </AppText>
          <AppText color="textSecondary">{evaluation.remarks}</AppText>
        </View>
      ) : null}
      {showTime ? (
        <AppText variant="caption" color="faint" style={styles.time}>
          Submitted {formatDateTime(evaluation.createdAt)}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { marginBottom: spacing.md, gap: spacing.xs + 2 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  remarks: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  time: { marginTop: spacing.md },
});
