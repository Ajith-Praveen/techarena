import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from '../AppText';

export interface HudLabelProps {
  children: string;
  /** Small step number shown before the label, e.g. "01". */
  index?: string;
  color?: string;
  /** @deprecated No rule line any more. */
  rule?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Section heading for long pages: optional step number, then the title. */
export function HudLabel({ children, index, color = colors.text, style }: HudLabelProps) {
  return (
    <View style={[styles.row, style]}>
      {index ? (
        <AppText variant="caption1" color="muted" style={styles.index}>
          {index}
        </AppText>
      ) : null}
      <AppText variant="title3" color={color}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  index: { fontVariant: ['tabular-nums'] },
});
