import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText, HudFrame } from '@/components';
import { colors, fonts, layout, radius, spacing } from '@/theme';

/** Extra-large read-only code boxes that scale with the screen, readable from a few metres away. */
export function BigCode({ code, length = 4 }: { code: string; length?: number }) {
  const { width, height } = useWindowDimensions();
  const available = Math.min(width, layout.maxContentWidth) - spacing.lg * 2;
  const gap = width < 400 ? spacing.sm : spacing.lg;
  const byWidth = (available - gap * (length - 1)) / length;
  const boxW = Math.floor(Math.max(56, Math.min(byWidth, 150, height * 0.18)));
  const boxH = Math.round(boxW * 1.25);
  const font = Math.round(boxW * 0.66);
  const digits = Array.from({ length }, (_, i) => code[i] ?? '');

  return (
    <View style={[styles.row, { gap }]} accessible accessibilityLabel={`Team code ${digits.join(' ')}`}>
      {digits.map((d, i) => (
        <View key={i} style={[styles.box, { width: boxW, height: boxH }]}>
          <AppText style={[styles.digit, { fontSize: font, lineHeight: Math.round(font * 1.15) }]}>{d}</AppText>
          <HudFrame color={colors.accent} size={Math.round(boxW * 0.14)} thickness={2} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center' },
  box: {
    borderWidth: 1,
    borderRadius: radius.sm,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  digit: { color: colors.text, fontFamily: fonts.bold },
});
