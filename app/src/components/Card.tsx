import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, hardShadow, ink, palette, radius, spacing } from '@/theme';

export type CardTone = 'default' | 'accent' | 'violet' | 'success' | 'warning' | 'danger' | 'gold';

export interface CardProps {
  children?: ReactNode;
  /** Makes the whole card tappable. */
  onPress?: () => void;
  /** Adds a colored band along the top of the panel. */
  tone?: CardTone;
  /** Any colour for the top band (e.g. the team colour); overrides `tone`. */
  bandColor?: string | null;
  /** Inner padding (default true). */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

const TONE: Record<CardTone, string | null> = {
  default: null,
  accent: palette.red,
  violet: palette.purple,
  success: palette.green,
  warning: palette.yellow,
  danger: palette.red,
  gold: palette.yellow,
};

/** Comic panel: white, thick ink outline, hard offset shadow; tone adds a colored top band. */
export function Card({ children, onPress, tone = 'default', bandColor, padded = true, style, testID, accessibilityLabel }: CardProps) {
  const toneColor = bandColor || TONE[tone];
  const band = toneColor ? <View style={[styles.band, { backgroundColor: toneColor }]} /> : null;
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          hardShadow(pressed ? 2 : 5),
          pressed ? styles.pressed : null,
          style,
        ]}
      >
        <View style={styles.clip}>
          {band}
          <View style={padded ? styles.padded : null}>{children}</View>
        </View>
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[styles.card, hardShadow(5), style]}>
      <View style={styles.clip}>
        {band}
        <View style={padded ? styles.padded : null}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: ink.thick,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    marginRight: 5,
  },
  // Clips images and the band to the rounded panel (the outer view keeps the shadow unclipped).
  clip: { borderRadius: radius.lg - ink.thick, overflow: 'hidden' },
  band: {
    height: 10,
    borderBottomWidth: ink.thick,
    borderBottomColor: colors.border,
  },
  padded: { padding: spacing.lg },
  pressed: { backgroundColor: colors.cardPressed, transform: [{ translateX: 3 }, { translateY: 3 }] },
});
