import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Comic book: warm paper, thick black ink outlines, hard offset shadows, flat primary colors
 * (red, yellow, blue). Bangers for shouty headlines and buttons, Space Grotesk for reading text.
 * See FOUNDATION.md "Design rules".
 */

export const palette = {
  paper: '#FFF6DF',
  paper2: '#FFEFC7',
  white: '#FFFFFF',
  ink: '#111111',
  ink2: '#2B2B2B',
  graphite: '#555048',
  pencil: '#8A8478',
  red: '#E4002B',
  yellow: '#FFD400',
  blue: '#1E5BFF',
  green: '#14A44D',
  pink: '#FF4FA3',
  orange: '#FF7A1A',
  cyan: '#22C3E6',
  purple: '#7B3FE4',
  // Older names still referenced in code, mapped onto the palette.
  night: '#FFF6DF',
  night2: '#FFFFFF',
  night3: '#FFEFC7',
  cream: '#111111',
  cream2: '#2B2B2B',
  sand: '#555048',
  stone: '#8A8478',
  thread: '#8A8478',
  gold: '#FFD400',
  gold2: '#FF7A1A',
  sage: '#14A44D',
  terracotta: '#E4002B',
  dustBlue: '#1E5BFF',
  black: '#111111',
  surface1: '#FFFFFF',
  surface2: '#FFEFC7',
  surface3: '#FFE7A8',
  amber: '#FFD400',
  indigo: '#3B3FE4',
  teal: '#11A39A',
  gray: '#8A8478',
  void: '#FFF6DF',
  deep: '#FFF6DF',
  panel: '#FFFFFF',
  panelHi: '#FFEFC7',
  steel: '#8A8478',
} as const;

/** @deprecated iOS names kept for compatibility. */
export const systemColors = {
  blue: palette.blue,
  green: palette.green,
  red: palette.red,
  orange: palette.orange,
  yellow: palette.yellow,
  indigo: palette.indigo,
  purple: palette.purple,
  teal: palette.teal,
  pink: palette.pink,
  gray: palette.pencil,
  gray2: palette.pencil,
  gray3: '#B9B2A3',
  gray4: '#D9D2C2',
  gray5: '#EDE6D4',
  gray6: '#F6F0E0',
} as const;

const a = (hex: string, alpha: number) => {
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return hex;
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((ch) => ch + ch).join('')}` : hex;
  const n = parseInt(full.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export const colors = {
  // Backgrounds
  bg: palette.paper,
  bgElevated: palette.paper,
  surface: palette.paper2,
  card: palette.white,
  cardSolid: palette.white,
  cardPressed: palette.paper2,
  border: palette.ink,
  borderStrong: palette.ink,
  /** Soft divider inside cards. */
  hairline: a(palette.ink, 0.15),
  overlay: 'rgba(17, 17, 17, 0.6)',
  fill: a(palette.ink, 0.05),
  separator: a(palette.ink, 0.15),
  grid: a(palette.ink, 0.06),

  // Text
  text: palette.ink,
  textSecondary: palette.ink2,
  muted: palette.graphite,
  faint: palette.pencil,
  secondaryLabel: palette.graphite,
  tertiaryLabel: palette.pencil,

  // Accent: red is the action color, yellow the highlight.
  accent: palette.red,
  accentDim: a(palette.red, 0.12),
  tint: palette.red,
  highlight: palette.yellow,
  violet: palette.purple,
  violetDim: a(palette.purple, 0.12),
  amber: palette.yellow,
  amberDim: a(palette.yellow, 0.25),
  onAccent: palette.white,
  primary: palette.red,
  onPrimary: palette.white,

  // Status
  success: palette.green,
  successDim: a(palette.green, 0.14),
  danger: palette.red,
  dangerDim: a(palette.red, 0.12),
  warning: '#B88A00',
  warningDim: a(palette.yellow, 0.3),
  info: palette.blue,
  infoDim: a(palette.blue, 0.12),

  // Named colors
  blue: palette.blue,
  green: palette.green,
  red: palette.red,
  orange: palette.orange,
  yellow: palette.yellow,
  indigo: palette.indigo,
  purple: palette.purple,
  teal: palette.teal,
  pink: palette.pink,
  gray: palette.pencil,

  // Podium
  gold: palette.yellow,
  silver: '#C9CED6',
  bronze: '#E09A5B',
} as const;

export type ColorName = keyof typeof colors;

/** Alpha helper for theme colors (`withAlpha(colors.accent, 0.2)`). Hex input only. */
export const withAlpha = a;

/** @deprecated Flat [color, color] pairs kept so older code compiles. */
export const gradients = {
  primary: [palette.red, palette.red],
  cyan: [palette.cyan, palette.cyan],
  violet: [palette.purple, palette.purple],
  blue: [palette.blue, palette.blue],
  green: [palette.green, palette.green],
  orange: [palette.orange, palette.orange],
  pink: [palette.pink, palette.pink],
  red: [palette.red, palette.red],
  gold: [palette.yellow, palette.yellow],
  teal: [palette.teal, palette.teal],
  indigo: [palette.indigo, palette.indigo],
  slate: [palette.pencil, palette.pencil],
} as const satisfies Record<string, readonly [string, string]>;

export type GradientName = keyof typeof gradients;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Chunky comic panels: friendly rounded corners. */
export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 18,
  tile: 14,
  pill: 999,
} as const;

/** Ink outline widths. */
export const ink = {
  thin: 2,
  thick: 3,
} as const;

/** Font families (loaded in src/app/_layout.tsx). One family per weight/style. */
export const fonts = {
  /** Comic display face: headlines, buttons, numbers. Single weight. */
  display: 'Bangers_400Regular',
  // Sans (reading text, labels)
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semibold: 'SpaceGrotesk_700Bold',
  bold: 'SpaceGrotesk_700Bold',
  // Older serif names map onto the sans so existing screens keep working.
  serifLight: 'SpaceGrotesk_400Regular',
  serifLightItalic: 'SpaceGrotesk_400Regular',
  serif: 'SpaceGrotesk_400Regular',
  serifItalic: 'SpaceGrotesk_400Regular',
  serifMedium: 'SpaceGrotesk_500Medium',
  // Mono (codes)
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const fontFamily: string = fonts.regular;
export const monoFontFamily: string = fonts.mono;

/**
 * Picks the family for a weight within the current family (display, sans or mono). Custom fonts
 * ship one family per weight and Android ignores fontWeight on them, so components translate
 * weight -> family instead of setting fontWeight.
 */
export function fontForWeight(weight: TextStyle['fontWeight'] | undefined, family: boolean | string = false): string {
  const w = weight === 'bold' ? 700 : weight === 'normal' || weight === undefined ? 400 : Number(weight) || 400;
  const fam = typeof family === 'string' ? family : family ? 'JetBrainsMono' : 'SpaceGrotesk';
  if (fam.startsWith('Bangers')) return fonts.display;
  if (fam.startsWith('JetBrainsMono')) return w >= 700 ? fonts.monoBold : w >= 500 ? fonts.monoMedium : fonts.mono;
  return w >= 600 ? fonts.bold : w >= 500 ? fonts.medium : fonts.regular;
}

const t = (family: string, fontSize: number, lineHeight: number, extra: TextStyle = {}): TextStyle => ({
  fontFamily: family,
  fontSize,
  lineHeight,
  ...extra,
});

/** Bangers reads best with a little tracking. */
const shout: TextStyle = { letterSpacing: 1 };
const caps: TextStyle = { textTransform: 'uppercase', letterSpacing: 1.2 };

export const typography = {
  largeTitle: t(fonts.display, 44, 46, shout),
  title1: t(fonts.display, 36, 40, shout),
  title2: t(fonts.display, 28, 32, shout),
  title3: t(fonts.bold, 20, 26),
  headline: t(fonts.bold, 17, 23),
  callout: t(fonts.regular, 16, 23),
  subheadline: t(fonts.regular, 15, 21),
  footnote: t(fonts.regular, 14, 20),
  caption1: t(fonts.regular, 13, 18),
  caption2: t(fonts.bold, 11, 15, caps),
  /** Section label: comic caption. */
  sectionHeader: t(fonts.display, 20, 24, shout),

  display: t(fonts.display, 44, 46, shout),
  title: t(fonts.display, 36, 40, shout),
  heading: t(fonts.bold, 20, 26),
  subheading: t(fonts.bold, 17, 23),
  body: t(fonts.regular, 16, 24),
  bodyStrong: t(fonts.bold, 16, 24),
  label: t(fonts.bold, 13, 18),
  caption: t(fonts.regular, 13, 18),
  overline: t(fonts.bold, 12, 16, caps),
  mono: t(fonts.mono, 16, 22),
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/** Hard, unblurred offset shadow (the comic "printed" look). Android has no hard shadows: none. */
export function hardShadow(offset = 4, color: string = palette.ink): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `${offset}px ${offset}px 0 ${color}` } as ViewStyle,
    ios: { shadowColor: color, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: offset, height: offset } },
    default: {},
  })!;
}

export const shadow: { card: ViewStyle; glow: ViewStyle; control: ViewStyle; glowSoft: ViewStyle } = {
  card: hardShadow(5),
  glow: hardShadow(4),
  glowSoft: hardShadow(3),
  control: hardShadow(3),
};

/** @deprecated No text glow in this theme; returns an empty style. */
export const textGlow = (_color?: string): TextStyle => ({});

export const hairline = StyleSheet.hairlineWidth;

export const layout = {
  maxContentWidth: 960,
  touchTarget: 44,
  tabletMinWidth: 600,
  rowHeight: 48,
  rowIcon: 32,
} as const;

export const maxContentWidth = layout.maxContentWidth;

export const rankColors: Record<1 | 2 | 3, string> = {
  1: colors.gold,
  2: colors.silver,
  3: colors.bronze,
};

export const theme = { colors, palette, systemColors, gradients, spacing, radius, ink, typography, shadow, layout, rankColors, fonts } as const;
export default theme;
