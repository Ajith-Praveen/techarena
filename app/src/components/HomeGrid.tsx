import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { tapFeedback } from '@/lib/haptics';
import { colors, fonts, gradients, hardShadow, ink, layout, palette, radius, spacing, type GradientName } from '@/theme';

import { AppText } from './AppText';
import type { IconName } from './icons';

/**
 * Comic "panel page": a grid of white panels, each with a colored icon sticker, a Bangers label
 * and an optional readout (value) or alert count (badge). Logout tiles (label "Logout" / "Log out"
 * or `destructive`) are pulled out of the grid and drawn as a full-width outlined bar underneath.
 */

export interface HomeGridProps {
  children: ReactNode;
  /** Fixed column count. Default: 3 on phones, 4 on tablets, 5 on wide screens. */
  columns?: number;
  /** Optional HUD section label above the grid. */
  title?: string;
  /** Optional note under the grid. */
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

function isDestructiveTile(child: ReactNode): boolean {
  if (!isValidElement(child)) return false;
  const props = child.props as Partial<AppTileProps>;
  if (props.destructive) return true;
  return typeof props.label === 'string' && /^log\s?-?out$/i.test(props.label.trim());
}

function flatten(children: ReactNode): ReactNode[] {
  const out: ReactNode[] = [];
  Children.toArray(children).forEach((c) => {
    if (isValidElement(c) && c.type === Fragment) out.push(...flatten((c as ReactElement<{ children?: ReactNode }>).props.children));
    else out.push(c);
  });
  return out;
}

const GAP = 14;

export function HomeGrid({ children, columns, title, footer, style }: HomeGridProps) {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, layout.maxContentWidth) - spacing.lg * 2;
  const cols = columns ?? (contentWidth >= 820 ? 4 : contentWidth >= 500 ? 3 : 2);
  // Leave room on the right for the grid's padding and the tiles' offset shadows.
  const tileWidth = Math.floor((contentWidth - 8 - GAP * (cols - 1)) / cols);

  const all = flatten(children);
  const main = all.filter((c) => !isDestructiveTile(c));
  const danger = all.filter((c) => isDestructiveTile(c));

  return (
    <View style={[styles.wrap, style]}>
      {title ? (
        <View style={styles.titleRow}>
          <View style={styles.caption}>
            <AppText variant="sectionHeader">{title}</AppText>
          </View>
        </View>
      ) : null}
      {main.length ? (
        <View style={styles.grid}>
          {main.map((tile, i) => (
            <View key={isValidElement(tile) && tile.key != null ? tile.key : i} style={{ width: tileWidth }}>
              {tile}
            </View>
          ))}
        </View>
      ) : null}
      {typeof footer === 'string' ? (
        <AppText variant="footnote" color="muted" style={styles.footer}>
          {footer}
        </AppText>
      ) : (
        footer
      )}
      {danger.length ? <View style={styles.danger}>{danger}</View> : null}
    </View>
  );
}

export interface AppTileProps {
  label: string;
  icon: IconName;
  /** Accent color: theme gradient name or a [from, to] pair (first color used). */
  gradient?: GradientName | readonly [string, string];
  /** Accent color (overrides `gradient`). */
  color?: string;
  href?: Href;
  onPress?: () => void;
  /** Alert count (amber), or `true` for a pulsing dot. */
  badge?: number | string | boolean;
  /** Small mono readout in the tile corner, e.g. "4821" or "#3". */
  value?: string | number;
  /** Red full-width bar with no icon (logout). Automatic for "Logout" / "Log out". */
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
}

/** True for colors that need ink (not white) on top: yellow, cyan, light greens. */
function isLight(hex: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1]!, 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62;
}

function tileColor(gradient: AppTileProps['gradient'], color?: string): string {
  if (color) return color;
  if (!gradient) return colors.accent;
  return typeof gradient === 'string' ? gradients[gradient][0] : gradient[0];
}

export function AppTile({
  label,
  icon,
  gradient = 'primary',
  color,
  href,
  onPress,
  badge,
  value,
  destructive,
  disabled,
  testID,
}: AppTileProps) {
  const isDanger = destructive ?? /^log\s?-?out$/i.test(label.trim());
  const showBadge = badge !== undefined && badge !== false && badge !== 0 && badge !== '';
  const accent = tileColor(gradient, color);
  const iconInk = isLight(accent) ? palette.ink : palette.white;

  const handlePress = () => {
    if (disabled) return;
    tapFeedback();
    if (onPress) onPress();
    else if (href) router.push(href);
  };

  if (isDanger) {
    return (
      <Pressable
        testID={testID}
        onPress={handlePress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.dangerBar, hardShadow(pressed ? 1 : 3), pressed ? styles.dangerPressed : null, disabled ? styles.disabled : null]}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <AppText variant="sectionHeader" color="danger">
          {label}
        </AppText>
      </Pressable>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [styles.tile, hardShadow(pressed && !disabled ? 1 : 4), pressed && !disabled ? styles.tilePressed : null, disabled ? styles.disabled : null]}
    >
      {() => (
        <>
          <View style={styles.tileTop}>
            <View style={[styles.chip, { backgroundColor: accent }]}>
              <Ionicons name={icon} size={20} color={iconInk} />
            </View>
            {showBadge ? (
              badge === true ? (
                <View style={styles.dot} accessibilityLabel="New" />
              ) : (
                <View style={styles.badge}>
                  <AppText variant="caption2" color={colors.onPrimary} style={styles.badgeText} numberOfLines={1}>
                    {String(badge)}
                  </AppText>
                </View>
              )
            ) : value !== undefined && value !== '' ? (
              <AppText variant="caption1" color="muted" numberOfLines={1} style={styles.value}>
                {String(value)}
              </AppText>
            ) : null}
          </View>
          <AppText numberOfLines={2} style={styles.label}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', marginBottom: spacing.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  caption: {
    backgroundColor: palette.yellow,
    borderWidth: ink.thin,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    transform: [{ rotate: '-1.5deg' }],
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingRight: 4 },
  footer: { marginTop: spacing.md },
  tile: {
    minHeight: 112,
    padding: spacing.md + 2,
    backgroundColor: colors.card,
    borderWidth: ink.thick,
    borderColor: colors.border,
    borderRadius: radius.lg,
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  tilePressed: { backgroundColor: colors.cardPressed, transform: [{ translateX: 3 }, { translateY: 3 }] },
  tileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  chip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: ink.thin,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fonts.display, fontSize: 22, lineHeight: 25, letterSpacing: 0.8, color: colors.text },
  value: { maxWidth: '55%', textAlign: 'right', fontVariant: ['tabular-nums'] },
  disabled: { opacity: 0.35 },
  badge: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    borderWidth: ink.thin,
    borderColor: colors.border,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { lineHeight: 15 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: ink.thin, borderColor: colors.border, backgroundColor: colors.accent },
  danger: { marginTop: spacing.lg, gap: spacing.sm, paddingRight: 4 },
  dangerBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: ink.thick,
    borderColor: colors.border,
    backgroundColor: palette.white,
    borderRadius: radius.md,
  },
  dangerPressed: { backgroundColor: '#FFD9DF' },
});
