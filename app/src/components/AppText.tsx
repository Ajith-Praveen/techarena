import type { ReactNode } from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { colors, fontForWeight, fonts, typography, type ColorName, type TypographyVariant } from '@/theme';

export interface AppTextProps extends TextProps {
  /** Typography preset (default 'body'). */
  variant?: TypographyVariant;
  /** Theme color name or any CSS color (default 'text'). */
  color?: ColorName | (string & {});
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
  children?: ReactNode;
}

export function resolveColor(color: ColorName | (string & {}) | undefined, fallback: string = colors.text): string {
  if (!color) return fallback;
  return color in colors ? colors[color as ColorName] : color;
}

/** Numbers like "17", "#7" or "8/10". */
const NUMERIC = /^[#\s\d.,:/%+–-]*\d[#\s\d.,:/%+–-]*$/;

export function AppText({ variant = 'body', color, weight, align, style, children, ...rest }: AppTextProps) {
  // In the comic display face a 7 reads like a 1: numbers in display variants use the bold sans.
  const numericDisplay =
    typography[variant].fontFamily === fonts.display && (typeof children === 'number' || (typeof children === 'string' && NUMERIC.test(children)));
  return (
    <Text
      {...rest}
      style={[
        styles.base,
        typography[variant],
        { color: resolveColor(color) },
        weight ? { fontFamily: fontForWeight(weight, typography[variant].fontFamily ?? fonts.serif) } : null,
        align ? { textAlign: align } : null,
        numericDisplay ? styles.numeric : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { color: colors.text, fontFamily: fonts.serif },
  numeric: { fontFamily: fonts.bold, letterSpacing: 0 },
});
