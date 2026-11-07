import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, ink, palette, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import type { IconName } from './icons';

export type BadgeTone =
  | 'neutral'
  | 'accent'
  | 'violet'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'gold'
  | 'silver'
  | 'bronze';

export interface BadgeProps {
  label: string | number;
  tone?: BadgeTone;
  icon?: IconName;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

// Comic sticker: flat color fill, ink outline, bold caps.
const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: palette.white, fg: palette.ink },
  accent: { bg: palette.red, fg: palette.white },
  violet: { bg: palette.purple, fg: palette.white },
  success: { bg: palette.green, fg: palette.white },
  warning: { bg: palette.yellow, fg: palette.ink },
  danger: { bg: palette.red, fg: palette.white },
  info: { bg: palette.blue, fg: palette.white },
  gold: { bg: colors.gold, fg: palette.ink },
  silver: { bg: colors.silver, fg: palette.ink },
  bronze: { bg: colors.bronze, fg: palette.ink },
};

/** Small pill label (status, role, rank). */
export function Badge({ label, tone = 'neutral', icon, size = 'sm', style }: BadgeProps) {
  const { bg, fg } = TONES[tone];
  const font = size === 'sm' ? 10 : 12;
  return (
    <View
      style={[
        styles.badge,
        size === 'md' ? styles.md : null,
        { backgroundColor: bg },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={font + 2} color={fg} /> : null}
      <AppText
        style={{ color: fg, fontFamily: fonts.semibold, fontSize: font, lineHeight: font + 5, letterSpacing: 0.8, textTransform: 'uppercase' }}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: ink.thin,
    borderColor: colors.border,
  },
  md: { paddingHorizontal: spacing.md - 2, paddingVertical: 4 },
});
