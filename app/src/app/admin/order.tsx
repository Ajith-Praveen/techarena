import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { QueueTeam } from '@/api/types';
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
  TeamImage,
} from '@/components';
import { saveOrder } from '@/features/admin/compat';
import { RevealItem } from '@/features/admin/RevealItem';
import { useIsWide } from '@/features/admin/useIsWide';
import { fetchConfig, useApi } from '@/hooks';
import { confirm, errorMessage, formatDateTime, plural, successFeedback, toApiError } from '@/lib';
import { colors, radius, spacing } from '@/theme';

async function loadOrderScreen() {
  const [order, overview] = await Promise.all([api.order(), api.adminOverview()]);
  return { order, overview };
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function AdminOrderScreen() {
  const { data, error, loading, refreshing, refresh, reload } = useApi(loadOrderScreen);
  const [revealKey, setRevealKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draft, setDraft] = useState<QueueTeam[] | null>(null);

  if (loading) {
    return (
      <Screen title="Presentation order" backHref="/admin">
        <LoadingView message="Loading order…" />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen title="Presentation order" backHref="/admin">
        <ErrorView error={error} onRetry={refresh} />
      </Screen>
    );
  }

  const { order, overview } = data;
  const judgingStarted = overview.evaluations > 0;
  const published = overview.resultsPublished;
  const teams = draft ?? order.teams;
  const dirty = draft !== null;

  const generate = async (force: boolean) => {
    setActionError(null);
    const ok = force
      ? await confirm(
          'Regenerate the order?',
          'Every team gets a new random slot and the current order is replaced. Teams may already have seen it.',
          'Regenerate',
          { destructive: true },
        )
      : await confirm(
          'Generate the presentation order?',
          `All ${plural(overview.teams, 'team')} are shuffled into a random order. This also CLOSES registration.`,
          'Generate',
        );
    if (!ok) return;
    try {
      await api.generateOrder({ force });
      successFeedback();
      setDraft(null);
      setRevealKey((k) => k + 1);
      await reload();
      void fetchConfig(true);
    } catch (e) {
      setActionError(errorMessage(e));
    }
  };

  const save = async () => {
    if (!draft) return;
    setActionError(null);
    const ok = await confirm(
      'Save the new order?',
      'Teams will see their new slots in the queue right away. Scores are not affected.',
      'Save order',
    );
    if (!ok) return;
    try {
      await saveOrder(draft.map((t) => t.id));
      successFeedback();
      setDraft(null);
      await reload();
    } catch (e) {
      const err = toApiError(e);
      setActionError(
        err.status === 404
          ? 'This server does not support manual reordering yet. Update the Worker and try again.'
          : err.message,
      );
    }
  };

  const edit = (from: number, to: number) => {
    if (to < 0 || to >= teams.length || from === to) return;
    setDraft(move(teams, from, to));
  };

  const footer = dirty ? (
    <View style={styles.footer}>
      <Button title="Discard" variant="secondary" fullWidth={false} style={styles.flex} onPress={() => setDraft(null)} />
      <Button title="Save order" icon="save-outline" fullWidth={false} style={styles.flex} onPress={save} />
    </View>
  ) : undefined;

  return (
    <Screen
      title="Presentation order"
      subtitle={order.generated ? `Generated ${formatDateTime(order.generatedAt)}` : 'Not generated yet'}
      backHref="/admin"
      refreshing={refreshing}
      onRefresh={refresh}
      footer={footer}
    >
      {error ? <Banner type="error" message={`Could not refresh: ${error.message}`} action={{ label: 'Retry', onPress: () => void refresh() }} /> : null}
      {actionError ? <Banner type="error" message={actionError} onClose={() => setActionError(null)} /> : null}

      {!order.generated ? (
        <Card tone="accent">
          <EmptyState
            icon="shuffle"
            title="No order yet"
            message={
              overview.teams === 0
                ? 'No teams have registered yet. The order can be generated once teams have signed up.'
                : `${plural(overview.teams, 'team')} registered. On expo day, generate a random presentation order. This closes registration.`
            }
          />
          <Button
            title="Generate random order"
            icon="shuffle"
            size="lg"
            disabled={overview.teams === 0 || published}
            onPress={() => generate(false)}
          />
        </Card>
      ) : (
        <>
          <Banner
            type="info"
            icon="shield-checkmark"
            message="Rearranging only changes who presents when. Scores can't be changed by anyone."
          />
          {!published ? (
            <Card>
              <View style={styles.regenRow}>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">Shuffle again</AppText>
                  <AppText variant="caption" color="muted">
                    {judgingStarted
                      ? 'Judging has started, so the order can no longer be reshuffled. You can still move teams manually.'
                      : 'Replace the order with a fresh random shuffle. Only before judging starts.'}
                  </AppText>
                </View>
                <Button
                  title="Regenerate"
                  icon="refresh"
                  variant="secondary"
                  fullWidth={false}
                  disabled={judgingStarted || dirty}
                  onPress={() => generate(true)}
                />
              </View>
            </Card>
          ) : (
            <Banner type="success" message="Results are published. The order is final." />
          )}
          {dirty ? <Banner type="warning" message="You have unsaved changes to the order." /> : null}

          <SectionTitle title={`${plural(teams.length, 'team')}`} />
          {teams.length === 0 ? (
            <EmptyState icon="list-outline" title="No teams in the order" />
          ) : (
            teams.map((team, i) => (
              <RevealItem key={team.id} index={i} revealKey={revealKey}>
                <OrderRow
                  team={team}
                  position={i + 1}
                  moved={dirty && team.orderPosition !== i + 1}
                  editable={!published}
                  isFirst={i === 0}
                  isLast={i === teams.length - 1}
                  onUp={() => edit(i, i - 1)}
                  onDown={() => edit(i, i + 1)}
                  onEnd={() => edit(i, teams.length - 1)}
                />
              </RevealItem>
            ))
          )}
        </>
      )}
    </Screen>
  );
}

function IconBtn({
  icon,
  text,
  label,
  onPress,
  disabled,
}: {
  icon?: 'arrow-up' | 'arrow-down';
  text?: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconBtn,
        text ? styles.textBtn : styles.squareBtn,
        pressed ? styles.iconBtnPressed : null,
        disabled ? styles.iconBtnDisabled : null,
      ]}
    >
      {icon ? <Ionicons name={icon} size={20} color={colors.accent} /> : null}
      {text ? (
        <AppText variant="label" color="accent" weight="600">
          {text}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function OrderRow({
  team,
  position,
  moved,
  editable,
  isFirst,
  isLast,
  onUp,
  onDown,
  onEnd,
}: {
  team: QueueTeam;
  position: number;
  moved: boolean;
  editable: boolean;
  isFirst: boolean;
  isLast: boolean;
  onUp: () => void;
  onDown: () => void;
  onEnd: () => void;
}) {
  const wide = useIsWide();
  const controls = editable ? (
    <View style={[styles.controls, wide ? null : styles.controlsBelow]}>
      <IconBtn icon="arrow-up" label={`Move ${team.name} up`} onPress={onUp} disabled={isFirst} />
      <IconBtn icon="arrow-down" label={`Move ${team.name} down`} onPress={onDown} disabled={isLast} />
      <IconBtn text="To end" label={`Move ${team.name} to the end`} onPress={onEnd} disabled={isLast} />
    </View>
  ) : null;
  return (
    <Card tone={moved ? 'warning' : 'default'} style={styles.rowCard}>
      <View style={styles.row}>
        <View style={[styles.pos, position <= 3 ? styles.posTop : null]}>
          <AppText variant="heading" weight="800" color={position <= 3 ? 'accent' : 'text'}>
            {position}
          </AppText>
        </View>
        <TeamImage url={team.imageUrl} size={wide ? 56 : 44} borderRadius={radius.sm} />
        <View style={styles.rowText}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {team.name}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {team.projectTitle}
          </AppText>
          {wide && team.memberNames.length ? (
            <AppText variant="caption" color="faint" numberOfLines={1}>
              {team.memberNames.join(', ')}
            </AppText>
          ) : null}
        </View>
        {team.evaluationCount > 0 ? (
          <Badge label={wide ? plural(team.evaluationCount, 'eval') : String(team.evaluationCount)} tone="accent" icon="checkmark-done" />
        ) : null}
        {wide ? controls : null}
      </View>
      {wide ? null : controls}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { flexDirection: 'row', gap: spacing.md },
  regenRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  rowCard: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pos: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  posTop: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  rowText: { flex: 1, minWidth: 0 },
  controls: { flexDirection: 'row', gap: spacing.xs },
  controlsBelow: { justifyContent: 'flex-end', marginTop: spacing.sm },
  iconBtn: {
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  squareBtn: { width: 40 },
  textBtn: { paddingHorizontal: spacing.md },
  iconBtnPressed: { backgroundColor: colors.cardPressed },
  iconBtnDisabled: { opacity: 0.3 },
});
