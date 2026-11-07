import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';

export interface DividerProps {
  /** Optional centered text, e.g. "or". */
  label?: string;
  /** Vertical margin (default spacing.lg). */
  spacing?: number;
  style?: StyleProp<ViewStyle>;
}

export function Divider({ label, spacing: gap = spacing.lg, style }: DividerProps) {
  if (!label) return <View style={[styles.line, { marginVertical: gap }, style]} />;
  return (
    <View style={[styles.row, { marginVertical: gap }, style]}>
      <View style={[styles.line, styles.flex]} />
      <AppText variant="caption1" color="muted">
        {label}
      </AppText>
      <View style={[styles.line, styles.flex]} />
    </View>
  );
}

const styles = StyleSheet.create({
  line: { height: 2, backgroundColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
