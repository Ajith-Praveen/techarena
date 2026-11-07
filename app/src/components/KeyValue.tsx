import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { copyToClipboard } from '@/lib/share';
import { colors, fonts, spacing } from '@/theme';

import { AppText } from './AppText';
import type { IconName } from './icons';

export interface KeyValueProps {
  label: string;
  value: ReactNode;
  icon?: IconName;
  /** Show a copy button that copies `copyText` (or `value` if it is a string/number). */
  copyable?: boolean;
  copyText?: string;
  mono?: boolean;
  /** Hide the bottom hairline (e.g. for the last row). */
  last?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** "Label ........ value" row for detail cards. */
export function KeyValue({ label, value, icon, copyable, copyText, mono, last, style }: KeyValueProps) {
  const text = copyText ?? (typeof value === 'string' || typeof value === 'number' ? String(value) : undefined);
  return (
    <View style={[styles.row, last ? null : styles.border, style]}>
      <View style={styles.labelWrap}>
        {icon ? <Ionicons name={icon} size={18} color={colors.muted} /> : null}
        <AppText variant="body" color="muted">
          {label}
        </AppText>
      </View>
      <View style={styles.valueWrap}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <AppText color="text" style={mono ? styles.mono : null} align="right" selectable>
            {value}
          </AppText>
        ) : (
          value
        )}
        {copyable && text ? (
          <Pressable
            onPress={() => void copyToClipboard(text)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Copy ${label}`}
          >
            <Ionicons name="copy-outline" size={18} color={colors.accent} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: 11,
  },
  border: { borderBottomWidth: 1, borderBottomColor: colors.separator },
  mono: { fontFamily: fonts.mono, color: colors.text },
  labelWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  valueWrap: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'flex-end' },
});
