import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, Banner, Button, Card, TeamImage } from '@/components';
import { errorFeedback, formatAverage, ordinal, successFeedback, toApiError } from '@/lib';
import { colors, radius, spacing } from '@/theme';

import { judgeApi } from './api';
import type { TieGroup } from './types';

export interface TieBreakCardProps {
  tie: TieGroup;
  myJudgeId: string | undefined;
  /** Called after a vote is saved or when the group turns out to be stale, so the parent can refetch. */
  onChanged: () => void;
}

function initialOrder(tie: TieGroup): string[] {
  const ids = new Set(tie.teams.map((t) => t.id));
  if (tie.myOrdering && tie.myOrdering.length === ids.size && tie.myOrdering.every((id) => ids.has(id))) {
    return tie.myOrdering;
  }
  return [...tie.teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => t.id);
}

/**
 * Tie-break for one relevant tie group (SPEC section 3): each judge orders the tied teams;
 * the group is resolved once every judge submits the same order.
 * Mount with a key that changes with `myOrdering` so a saved vote re-seeds the local order.
 */
export function TieBreakCard({ tie, myJudgeId, onChanged }: TieBreakCardProps) {
  const [order, setOrder] = useState<string[]>(() => initialOrder(tie));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const teamsById = new Map(tie.teams.map((t) => [t.id, t]));
  const nameOf = (id: string) => teamsById.get(id)?.name ?? 'Unknown team';
  const changed = !tie.myOrdering || tie.myOrdering.join(',') !== order.join(',');
  const allSubmitted = tie.votes.length > 0 && tie.votes.every((v) => v.submitted);
  const [from, to] = tie.positions;

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    setOrder((o) => {
      const next = [...o];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await judgeApi.voteTie({ groupKey: tie.groupKey, teamIds: order });
      successFeedback();
      onChanged();
    } catch (e) {
      errorFeedback();
      const err = toApiError(e);
      if (err.status === 404) {
        setError('This tie has changed. Refreshing…');
        onChanged();
      } else if (err.code === 'RESULTS_PUBLISHED') {
        setError('Results are already published.');
        onChanged();
      } else {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card tone={tie.resolved ? 'success' : 'warning'}>
      <View style={styles.header}>
        <Ionicons name="git-compare" size={22} color={tie.resolved ? colors.success : colors.warning} />
        <View style={styles.flex}>
          <AppText variant="heading">Tie-break needed</AppText>
          <AppText variant="caption" color="muted">
            {tie.teams.length} teams tied at {formatAverage(tie.average)} for {ordinal(from)}
            {to !== from ? `–${ordinal(to)}` : ''} place. Put them in order, best first.
          </AppText>
        </View>
        {tie.resolved ? (
          <Badge label="Resolved" tone="success" icon="checkmark-circle" />
        ) : allSubmitted ? (
          <Badge label="Judges disagree" tone="danger" icon="alert-circle" />
        ) : (
          <Badge label="Waiting" tone="warning" icon="time-outline" />
        )}
      </View>

      {order.map((id, i) => {
        const team = teamsById.get(id);
        return (
          <View key={id} style={styles.teamRow}>
            <AppText variant="heading" color="accent" style={styles.place}>
              {ordinal(from + i)}
            </AppText>
            <TeamImage url={team?.imageUrl ?? null} size={48} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {nameOf(id)}
              </AppText>
              <AppText variant="caption" color="muted" numberOfLines={1}>
                {team?.projectTitle ?? ''} · avg {formatAverage(tie.average)}
              </AppText>
            </View>
            <MoveButton icon="chevron-up" label={`Move ${nameOf(id)} up`} disabled={i === 0 || saving} onPress={() => move(i, -1)} />
            <MoveButton
              icon="chevron-down"
              label={`Move ${nameOf(id)} down`}
              disabled={i === order.length - 1 || saving}
              onPress={() => move(i, 1)}
            />
          </View>
        );
      })}

      {error ? <Banner type="error" message={error} style={styles.banner} /> : null}

      <Button
        title={tie.myOrdering ? (changed ? 'Update my order' : 'Order submitted') : 'Submit my order'}
        icon="send"
        onPress={submit}
        loading={saving}
        disabled={!changed}
        style={styles.submit}
      />

      <View style={styles.votes}>
        <AppText variant="overline" color="muted">
          Judges
        </AppText>
        {tie.votes.map((v) => (
          <View key={v.judgeId} style={styles.vote}>
            <Ionicons
              name={v.submitted ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={v.submitted ? colors.success : colors.faint}
            />
            <View style={styles.flex}>
              <AppText variant="label">
                {v.judgeLabel} · {v.judgeName}
                {v.judgeId === myJudgeId ? ' (you)' : ''}
              </AppText>
              <AppText variant="caption" color="muted">
                {v.submitted && v.ordering ? v.ordering.map(nameOf).join('  >  ') : 'Not submitted yet'}
              </AppText>
            </View>
          </View>
        ))}
        {!tie.resolved && allSubmitted ? (
          <AppText variant="caption" color="danger">
            Judges disagree. Discuss and resubmit until every order matches.
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

function MoveButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'chevron-up' | 'chevron-down';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.moveBtn, disabled ? styles.moveDisabled : null, pressed ? styles.movePressed : null]}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  place: { width: 44 },
  moveBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveDisabled: { opacity: 0.3 },
  movePressed: { backgroundColor: colors.cardPressed },
  banner: { marginTop: spacing.md, marginBottom: 0 },
  submit: { marginTop: spacing.md },
  votes: { marginTop: spacing.lg, gap: spacing.sm },
  vote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
});
