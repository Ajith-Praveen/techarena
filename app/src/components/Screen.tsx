import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, ink, layout, spacing } from '@/theme';

import { AppText } from './AppText';
import { HudBackground } from './hud/HudBackground';

export interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  /** Show a back button (default true). */
  back?: boolean;
  /** Where back goes when there is no history (deep link / web reload). Default '/'. */
  backHref?: Href;
  right?: ReactNode;
  /** Text next to the back chevron (default "Back"). */
  backLabel?: string;
  /** Hide the centered title (used when the screen shows a large title instead). */
  hideTitle?: boolean;
}

export function goBack(fallback: Href = '/'): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

/** iOS navigation bar: blue "< Back" on the left, centered 17 pt semibold title, optional right item. */
export function ScreenHeader({
  title,
  subtitle,
  back = true,
  backHref = '/',
  right,
  backLabel = 'Back',
  hideTitle = false,
}: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {back ? (
          <Pressable
            onPress={() => goBack(backHref)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.backBtn, pressed ? styles.backPressed : null]}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} style={styles.backIcon} />
            <AppText variant="label" numberOfLines={1} style={styles.backText}>
              {backLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.headerCenter} pointerEvents="none">
        {title && !hideTitle ? (
          <AppText numberOfLines={1} align="center" style={styles.barTitle}>
            {title}
          </AppText>
        ) : null}
        {subtitle && !hideTitle ? (
          <AppText variant="caption1" color="muted" numberOfLines={1} align="center">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
    </View>
  );
}

export interface ScreenProps extends Omit<ScreenHeaderProps, 'hideTitle'> {
  children?: ReactNode;
  /** Render the navigation bar (default: when title, back or right is set). */
  header?: boolean;
  /**
   * Show the title as an iOS large title (34 pt bold) at the top of the content instead of in
   * the bar. Default: true on top-level screens (`back={false}`), false otherwise.
   */
  largeTitle?: boolean;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
  /** Pull-to-refresh (scroll mode only; no-op on web). */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Horizontal + vertical content padding (default true). */
  padded?: boolean;
  /** Content max width, centered (default 900). */
  maxWidth?: number;
  contentStyle?: StyleProp<ViewStyle>;
  /** Pinned below the content, above the home indicator (e.g. a submit button). */
  footer?: ReactNode;
  /** Drawn over the whole screen (not scrolled), e.g. a full-screen animation. */
  overlay?: ReactNode;
}

/**
 * Standard page: grouped background, safe areas, iOS nav bar (or large title on top-level
 * screens), centered max-width column, optional scroll + pull-to-refresh, keyboard avoidance
 * and a pinned toolbar footer.
 */
export function Screen({
  children,
  title,
  subtitle,
  back = true,
  backHref,
  backLabel,
  right,
  header,
  largeTitle,
  scroll = true,
  refreshing = false,
  onRefresh,
  padded = true,
  maxWidth = layout.maxContentWidth,
  contentStyle,
  footer,
  overlay,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const large = Boolean(title) && (largeTitle ?? !back);
  const showHeader = header ?? Boolean(title || subtitle || right || back);
  // A large-title screen with nothing in the bar only needs a little top breathing room.
  const showBar = showHeader && (!large || back || Boolean(right));
  const column = [styles.column, { maxWidth }, padded ? styles.padded : null, contentStyle];
  const bottomPad = footer ? 0 : insets.bottom;

  const largeTitleBlock = large ? (
    <View style={[styles.largeTitle, padded ? null : styles.largeTitlePadded, !showBar ? styles.largeTitleTop : null]}>
      <AppText variant="largeTitle" numberOfLines={2} accessibilityRole="header">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="subheadline" color="muted" style={styles.largeSubtitle}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  ) : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <HudBackground />
      {showBar ? (
        <View style={[styles.headerWrap, large ? styles.headerWrapLarge : null]}>
          <View style={[styles.headerColumn, { maxWidth }]}>
            <ScreenHeader
              title={title}
              subtitle={subtitle}
              back={back}
              backHref={backHref}
              backLabel={backLabel}
              right={right}
              hideTitle={large}
            />
          </View>
        </View>
      ) : null}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + spacing.xl }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.cardSolid} />
              ) : undefined
            }
          >
            <View style={column}>
              {largeTitleBlock}
              {children}
            </View>
          </ScrollView>
        ) : (
          <View style={[styles.flex, { paddingBottom: bottomPad }]}>
            <View style={[column, styles.flex]}>
              {largeTitleBlock}
              {children}
            </View>
          </View>
        )}
        {footer ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            <View style={[styles.column, styles.footerInner, { maxWidth }]}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  flex: { flex: 1 },
  headerWrap: {
    borderBottomWidth: ink.thick,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  headerWrapLarge: { borderBottomWidth: 0, backgroundColor: 'transparent' },
  barTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, letterSpacing: 1, color: colors.text },
  headerColumn: { width: '100%', alignSelf: 'center' },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  headerSide: { flex: 1, flexBasis: 0, flexDirection: 'row', alignItems: 'center', minWidth: 72 },
  headerRight: { justifyContent: 'flex-end', paddingRight: spacing.sm, gap: spacing.md },
  headerCenter: { flexShrink: 1, maxWidth: '60%', alignItems: 'center' },
  backBtn: { height: 44, flexDirection: 'row', alignItems: 'center', paddingRight: spacing.sm },
  backPressed: { opacity: 0.35 },
  backIcon: { marginLeft: -2, marginRight: 0 },
  backText: { flexShrink: 1 },
  scrollContent: { flexGrow: 1 },
  column: { width: '100%', alignSelf: 'center' },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  largeTitle: { marginTop: -spacing.sm, marginBottom: spacing.lg },
  largeTitlePadded: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  largeTitleTop: { marginTop: spacing.lg },
  largeSubtitle: { marginTop: spacing.xs },
  footer: {
    borderTopWidth: ink.thick,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  footerInner: { paddingTop: spacing.md, paddingHorizontal: spacing.lg },
});
