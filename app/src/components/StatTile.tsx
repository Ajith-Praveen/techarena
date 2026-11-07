import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, hardShadow, ink, palette, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import type { IconName } from './icons';

export type StatTone = 'accent' | 'violet' | 'success' | 'warning' | 'danger' | 'gold' | 'neutral';

export interface StatTileProps {
  label: string;
  value: string | number;
  icon?: IconName;
  tone?: StatTone;
  /** Small text under the value, e.g. "of 24". */
  hint?: string;
  style?: StyleProp<ViewStyle>;
}

const TONE: Record<StatTone, string> = {
  accent: palette.red,
  violet: palette.purple,
  success: palette.green,
  warning: palette.yellow,
  danger: palette.red,
  gold: palette.yellow,
  neutral: palette.blue,
};

/** Comic stat panel: big Bangers number, colored corner tab, small caps label. Lay several out with <StatRow>. */
export function StatTile({ label, value, icon, tone = 'accent', hint, style }: StatTileProps) {
  const c = TONE[tone];
  return (
    <View style={[styles.tile, hardShadow(3), style]}>
      <View style={[styles.tab, { backgroundColor: c }]} />
      <View style={styles.top}>
        <AppText numberOfLines={1} adjustsFontSizeToFit style={styles.value}>
          {value}
        </AppText>
        {icon ? <Ionicons name={icon} size={20} color={colors.text} /> : null}
      </View>
      <AppText variant="caption2" color="muted" numberOfLines={1}>
        {label}
        {hint ? ` · ${hint}` : ''}
      </AppText>
    </View>
  );
}

/** Wrapping row of StatTiles (2 per row on phones, more on wide screens). */
export function StatRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 130,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: ink.thick,
    borderColor: colors.border,
    overflow: 'visible',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: 4,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  value: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 32, lineHeight: 38, color: colors.text },
  tab: { position: 'absolute', top: -ink.thick, right: 14, width: 18, height: 12, borderWidth: ink.thin, borderColor: palette.ink, borderTopWidth: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md + 2, marginBottom: spacing.xl, paddingRight: 3 },
});
