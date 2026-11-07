import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { tapFeedback } from '@/lib/haptics';
import { colors, fonts, hardShadow, ink, palette, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import type { IconName } from './icons';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  /** If it returns a promise, the button shows a spinner and ignores taps until it settles. */
  onPress?: () => void | Promise<unknown>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the container width (default true). */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 40, md: 52, lg: 58 };
const FONT: Record<ButtonSize, number> = { sm: 17, md: 21, lg: 24 };
const SHADOW: Record<ButtonSize, number> = { sm: 3, md: 4, lg: 5 };

// Comic buttons: flat color, thick ink outline, hard offset shadow that "presses in" on tap.
const BG: Record<ButtonVariant, string> = {
  primary: palette.red,
  secondary: palette.white,
  danger: palette.white,
  success: palette.green,
  ghost: 'transparent',
};
const FG: Record<ButtonVariant, string> = {
  primary: palette.white,
  secondary: palette.ink,
  danger: palette.red,
  success: palette.white,
  ghost: palette.ink,
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const [busy, setBusy] = useState(false);
  const showSpinner = loading || busy;
  const inactive = disabled || showSpinner;
  const fg = disabled ? palette.pencil : FG[variant];
  const ghost = variant === 'ghost';
  const offset = SHADOW[size];

  const handlePress = async () => {
    if (inactive || !onPress) return;
    tapFeedback();
    const result = onPress();
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      setBusy(true);
      try {
        await result;
      } catch {
        // Callers handle their own errors; never leave the button stuck.
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: showSpinner }}
      onPress={handlePress}
      disabled={inactive}
      style={({ pressed }) => {
        const down = pressed && !inactive;
        return [
          styles.base,
          { height: HEIGHT[size], backgroundColor: disabled && !ghost ? '#E9E2CF' : BG[variant] },
          fullWidth ? styles.full : styles.inline,
          ghost ? styles.ghost : [styles.inked, disabled ? styles.inkedOff : hardShadow(down ? 1 : offset)],
          down && !ghost ? { transform: [{ translateX: offset - 1 }, { translateY: offset - 1 }] } : null,
          down && ghost ? styles.ghostPressed : null,
          disabled && ghost ? styles.disabled : null,
          style,
        ];
      }}
    >
      <View style={styles.content}>
        {showSpinner ? (
          <ActivityIndicator color={fg} size="small" />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={FONT[size] - 1} color={fg} /> : null}
            <AppText
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={{
                color: fg,
                fontFamily: ghost ? fonts.bold : fonts.display,
                fontSize: ghost ? FONT[size] - 5 : FONT[size],
                lineHeight: FONT[size] + 4,
                letterSpacing: ghost ? 0.2 : 1.2,
                textDecorationLine: ghost ? 'underline' : 'none',
              }}
            >
              {title}
            </AppText>
            {iconRight ? <Ionicons name={iconRight} size={FONT[size] - 1} color={fg} /> : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg, borderRadius: radius.md },
  inked: { borderWidth: ink.thick, borderColor: colors.border },
  // Disabled: flat grey card, pencil outline, no shadow (no see-through opacity).
  inkedOff: { borderColor: palette.pencil, borderStyle: 'dashed' },
  ghost: { paddingHorizontal: spacing.sm },
  ghostPressed: { opacity: 0.5 },
  full: { alignSelf: 'stretch' },
  inline: { alignSelf: 'flex-start' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  disabled: { opacity: 0.45 },
});
