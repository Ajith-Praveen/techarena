import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { tapFeedback } from '@/lib/haptics';
import { colors, fonts, hardShadow, ink, palette, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export interface ScoreSelectorProps {
  label: string;
  description?: string;
  /** Highest selectable score (buttons 0..max). */
  max: number;
  /** Selected score, or null/undefined when not chosen yet. */
  value: number | null | undefined;
  onChange: (score: number) => void;
  disabled?: boolean;
  testID?: string;
}

const GAP = 6; // between segments
const PAD = 0; // track inset
const MIN_SEG = 44;

/**
 * One scoring criterion: title, description and a UISegmentedControl-style row of numbers
 * 0..max. The row wraps into balanced lines when segments would get narrower than 44 pt.
 */
export function ScoreSelector({ label, description, max, value, onChange, disabled = false, testID }: ScoreSelectorProps) {
  const [width, setWidth] = useState(0);
  const count = max + 1;
  const inner = Math.max(0, width - PAD * 2);
  const perRow = inner ? Math.max(1, Math.min(count, Math.floor((inner + GAP) / (MIN_SEG + GAP)))) : count;
  const rows = Math.ceil(count / perRow);
  const balanced = Math.ceil(count / rows);
  const segW = inner ? Math.floor((inner - (balanced - 1) * GAP) / balanced) : MIN_SEG;
  const segH = width >= 560 ? 52 : 44;
  const selected = value !== null && value !== undefined;

  return (
    <View testID={testID} style={[styles.container, hardShadow(4), disabled ? styles.disabled : null]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="headline" style={styles.title}>
            {label}
          </AppText>
          {description ? (
            <AppText variant="footnote" color="muted" style={styles.description}>
              {description}
            </AppText>
          ) : null}
        </View>
        <AppText style={[styles.value, selected ? styles.valueOn : styles.valueOff]}>
          {selected ? String(value) : '–'}
          <AppText style={styles.valueMax}>/{max}</AppText>
        </AppText>
      </View>
      <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {Array.from({ length: count }, (_, n) => {
          const isSel = value === n;
          // Energy-meter look: everything up to the selected value is lit, the selection glows.
          const lit = selected && n <= (value as number);
          return (
            <Pressable
              key={n}
              disabled={disabled}
              onPress={() => {
                tapFeedback();
                onChange(n);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${n} out of ${max}`}
              accessibilityState={{ selected: isSel, disabled }}
              style={({ pressed }) => [
                styles.seg,
                { width: segW, height: segH },
                lit ? styles.segLit : null,
                isSel ? [styles.segSelected, hardShadow(3)] : null,
                pressed && !isSel ? styles.segPressed : null,
              ]}
            >
              <AppText
                style={{
                  // Bold sans for digits: in Bangers a 7 reads like a 1.
                  fontFamily: fonts.bold,
                  fontSize: segH >= 52 ? 20 : 18,
                  lineHeight: segH >= 52 ? 26 : 24,
                  color: isSel ? palette.white : colors.text,
                }}
              >
                {n}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: ink.thick,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    marginRight: 4,
  },
  title: {},
  disabled: { opacity: 0.5 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  headerText: { flex: 1 },
  description: { marginTop: 2 },
  value: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 38 },
  valueOn: { color: colors.accent },
  valueOff: { color: colors.faint },
  valueMax: { fontFamily: fonts.bold, fontSize: 15, color: colors.muted },
  track: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    padding: PAD,
  },
  // Comic number tiles: everything up to the pick is filled yellow, the pick itself is red.
  seg: {
    borderRadius: radius.sm,
    borderWidth: ink.thin,
    borderColor: colors.border,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segLit: { backgroundColor: palette.yellow },
  segSelected: { backgroundColor: palette.red, borderWidth: ink.thick },
  segPressed: { backgroundColor: palette.paper2 },
});
