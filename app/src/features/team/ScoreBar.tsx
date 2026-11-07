import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, withAlpha } from '@/theme';

export interface ScoreBarProps {
  value: number;
  max: number;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/** Thin horizontal progress bar for a score out of `max`. */
export function ScoreBar({ value, max, color = colors.accent, height = 6, style }: ScoreBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View
      style={[styles.track, { height }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max, now: value }}
    >
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', backgroundColor: withAlpha(colors.accent, 0.08), overflow: 'hidden', borderRadius: radius.sm },
  fill: { height: '100%' },
});
