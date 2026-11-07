import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, ink, palette, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import type { IconName } from './icons';

export type BannerType = 'info' | 'success' | 'warning' | 'error';

export interface BannerProps {
  type?: BannerType;
  title?: string;
  message?: ReactNode;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
  onClose?: () => void;
  style?: StyleProp<ViewStyle>;
}

// Comic speech-box colors: tinted panel, ink outline, ink icon.
const TONES: Record<BannerType, { bg: string; icon: IconName }> = {
  info: { bg: '#DCE7FF', icon: 'information-circle' },
  success: { bg: '#D5F5DF', icon: 'checkmark-circle' },
  warning: { bg: '#FFF0A3', icon: 'warning' },
  error: { bg: '#FFD9DF', icon: 'alert-circle' },
};

/** Inline status message (info / success / warning / error). */
export function Banner({ type = 'info', title, message, icon, action, onClose, style }: BannerProps) {
  const tone = TONES[type];
  return (
    <View
      accessibilityRole={type === 'error' ? 'alert' : 'summary'}
      style={[styles.banner, { backgroundColor: tone.bg }, style]}
    >
      <Ionicons name={icon ?? tone.icon} size={22} color={type === 'error' ? palette.red : palette.ink} style={styles.icon} />
      <View style={styles.body}>
        {title ? (
          <AppText variant="headline" color="text">
            {title}
          </AppText>
        ) : null}
        {typeof message === 'string' ? (
          <AppText variant="subheadline" color={title ? 'textSecondary' : 'text'}>
            {message}
          </AppText>
        ) : (
          message
        )}
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="button" style={styles.action}>
            <AppText variant="label" color="accent">
              {action.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {onClose ? (
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Ionicons name="close" size={20} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: ink.thin,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  icon: { marginTop: 0 },
  body: { flex: 1, gap: 4 },
  action: { marginTop: spacing.xs, alignSelf: 'flex-start' },
});
