import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { AppText, Button } from '@/components';
import { useApi, usePolling } from '@/hooks';
import { colors, layout, radius, spacing } from '@/theme';

import { nextUpFor, sortByPosition } from './types';

/**
 * "Your status" bar for the judge's queue screen: which positions this judge has scored.
 * Rendered as a bottom bar because QueueView owns the screen header and safe area.
 */
export function JudgeStatusStrip() {
  const insets = useSafeAreaInsets();
  const { data, error, refresh, reload } = useApi(() => api.progress());
  usePolling(reload, 15_000);

  const content = (() => {
    if (!data) {
      return error ? (
        <Pressable onPress={() => void refresh()} accessibilityRole="button" style={styles.row}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
          <AppText variant="caption" color="muted">
            Could not load your status. Tap to retry.
          </AppText>
        </Pressable>
      ) : (
        <AppText variant="caption" color="muted">
          Loading your status…
        </AppText>
      );
    }
    const teams = sortByPosition(data.teams);
    const done = teams.filter((t) => t.evaluatedByMe).length;
    const next = nextUpFor(data.teams);
    return (
      <>
        <View style={styles.row}>
          <View style={styles.flex}>
            <AppText variant="label">
              You've scored {done} of {data.totalTeams}
            </AppText>
            <AppText variant="caption" color="muted" numberOfLines={1}>
              {next
                ? `Next up: ${next.orderPosition !== null ? `#${next.orderPosition} ` : ''}${next.name}`
                : data.totalTeams > 0
                  ? 'All teams scored'
                  : 'No teams yet'}
            </AppText>
          </View>
          {next && !data.resultsPublished ? (
            <Button
              title="Enter code"
              icon="keypad"
              size="sm"
              fullWidth={false}
              onPress={() => router.push('/judge/enter-code')}
            />
          ) : null}
        </View>
        {teams.some((t) => t.orderPosition !== null) ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {teams
              .filter((t) => t.orderPosition !== null)
              .map((t) => (
                <View
                  key={t.id}
                  style={[styles.chip, t.evaluatedByMe ? styles.chipDone : null, next?.id === t.id ? styles.chipNext : null]}
                  accessibilityLabel={`Position ${t.orderPosition}, ${t.name}, ${t.evaluatedByMe ? 'scored' : 'not scored'}`}
                >
                  {t.evaluatedByMe ? <Ionicons name="checkmark" size={12} color={colors.success} /> : null}
                  <AppText
                    variant="caption"
                    weight="700"
                    color={t.evaluatedByMe ? 'success' : next?.id === t.id ? 'accent' : 'muted'}
                  >
                    {t.orderPosition}
                  </AppText>
                </View>
              ))}
          </ScrollView>
        ) : null}
      </>
    );
  })();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.sm }]}>
      <View style={styles.inner}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: {
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  inner: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: spacing.lg, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chips: { gap: spacing.xs + 2, paddingVertical: spacing.xxs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 34,
    height: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipDone: { borderColor: colors.success, backgroundColor: colors.successDim },
  chipNext: { borderColor: colors.accent, backgroundColor: colors.accentDim },
});
