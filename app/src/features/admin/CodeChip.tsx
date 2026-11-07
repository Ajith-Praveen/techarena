import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components';
import { colors, radius, spacing, typography } from '@/theme';

/** Compact OTP-style team code: four small digit boxes. */
export function CodeChip({ code }: { code: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`Team code ${code.split('').join(' ')}`}>
      {code.split('').map((d, i) => (
        <View key={i} style={styles.box}>
          <AppText style={[typography.mono, styles.digit]}>{d}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3 },
  box: {
    width: 22,
    height: 28,
    borderRadius: radius.sm - 2,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 15, lineHeight: 19, fontWeight: '800', color: colors.text, paddingHorizontal: spacing.xxs },
});
