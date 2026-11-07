import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import type { TeamColorOption } from '@/api/types';
import { tapFeedback } from '@/lib/haptics';
import { textOn } from '@/lib/teamColor';
import { colors, fonts, hardShadow, ink, palette, spacing } from '@/theme';

import { AppText } from './AppText';

export interface TeamColorPickerProps {
  options: TeamColorOption[];
  /** Selected hex, or null. */
  value: string | null;
  onChange: (hex: string) => void;
  /** This team's current colour: shown as free even though the server marks it taken. */
  ownColor?: string | null;
  disabled?: boolean;
}

/**
 * Grid of team colour swatches. Colours other teams already use are crossed out and can't be
 * picked, so every team ends up with its own colour.
 */
export function TeamColorPicker({ options, value, onChange, ownColor, disabled = false }: TeamColorPickerProps) {
  return (
    <View style={styles.grid}>
      {options.map((o) => {
        const selected = value?.toUpperCase() === o.hex.toUpperCase();
        const taken = o.taken && o.hex.toUpperCase() !== ownColor?.toUpperCase();
        const fg = textOn(o.hex);
        return (
          <Pressable
            key={o.hex}
            disabled={disabled || taken}
            onPress={() => {
              tapFeedback();
              onChange(o.hex);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: disabled || taken }}
            accessibilityLabel={`${o.name}${taken ? ', taken by another team' : ''}`}
            style={({ pressed }) => [styles.item, pressed && !taken ? styles.pressed : null]}
          >
            <View
              style={[
                styles.swatch,
                { backgroundColor: o.hex },
                selected ? [styles.selected, hardShadow(3)] : null,
                taken ? styles.taken : null,
              ]}
            >
              {selected ? <Ionicons name="checkmark" size={24} color={fg} /> : null}
              {taken ? <Ionicons name="close" size={22} color={fg} /> : null}
            </View>
            <AppText style={[styles.name, taken ? styles.nameTaken : null]} numberOfLines={1}>
              {taken ? 'Taken' : o.name}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'flex-start' },
  item: { width: 66, alignItems: 'center', gap: 4 },
  pressed: { transform: [{ scale: 0.94 }] },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: ink.thin,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { borderWidth: 4, width: 54, height: 54, borderRadius: 27, marginVertical: -3 },
  taken: { opacity: 0.28 },
  name: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: palette.ink, textAlign: 'center' },
  nameTaken: { color: colors.faint },
});
