import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { colors, fonts, hardShadow, ink, palette, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export interface CodeDisplayProps {
  /** e.g. "4821". Missing digits render as empty boxes. */
  code: string;
  /** Number of boxes (default 4). */
  length?: number;
  size?: 'md' | 'lg';
}

const BOX = { md: { w: 60, h: 72, font: 38 }, lg: { w: 76, h: 92, font: 50 } };

/** Read-only OTP-style code: big digit boxes. */
export function CodeDisplay({ code, length = 4, size = 'lg' }: CodeDisplayProps) {
  const { width } = useWindowDimensions();
  const dims = BOX[size === 'lg' && width < 400 ? 'md' : size];
  const digits = Array.from({ length }, (_, i) => code[i] ?? '');
  return (
    <View style={styles.row} accessible accessibilityLabel={`Code ${digits.join(' ')}`}>
      {digits.map((d, i) => (
        <View key={i} style={[styles.box, hardShadow(4), { width: dims.w, height: dims.h, transform: [{ rotate: i % 2 ? '2deg' : '-2deg' }] }]}>
          <AppText style={[styles.digit, { fontSize: dims.font, lineHeight: dims.font + 8 }]}>{d}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  box: {
    borderRadius: radius.md,
    borderWidth: ink.thick,
    borderColor: colors.borderStrong,
    backgroundColor: palette.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  // Digits use the bold sans: in Bangers a 7 reads like a 1.
  digit: { color: colors.text, fontFamily: fonts.bold },
});
