import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { shade, textOn, tint } from '@/lib/teamColor';
import { colors, fonts, hardShadow, ink, palette, radius, spacing } from '@/theme';

import { AppText } from '../AppText';
import { TeamImage } from '../TeamImage';

export interface TeamBannerProps {
  name: string;
  /** Team banner colour (hex). */
  color: string;
  projectTitle?: string;
  imageUrl?: string | null;
  /** Small label above the name, e.g. "Slot #3". */
  kicker?: string;
  /** Rendered on the right of the coloured area (e.g. an avatar). */
  right?: ReactNode;
  /** White strip under the coloured area (status lines, actions). */
  children?: ReactNode;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}

/** Comic team banner in the team's own colour: halftone panel, big name, project sticker, image. */
export function TeamBanner({ name, color, projectTitle, imageUrl, kicker, right, children, size = 'lg', style }: TeamBannerProps) {
  const fg = textOn(color);
  const dots = fg === palette.white ? tint(color, 0.18) : shade(color, 0.12);
  const big = size === 'lg';
  return (
    <View style={[styles.outer, hardShadow(5), style]}>
      <View style={styles.clip}>
        <View style={[styles.top, { backgroundColor: color }]}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <Pattern id={`dots-${color}`} width={12} height={12} patternUnits="userSpaceOnUse">
                <Circle cx={6} cy={6} r={1.8} fill={dots} />
              </Pattern>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#dots-${color})`} />
          </Svg>
          {imageUrl !== undefined ? (
            <View style={[styles.image, hardShadow(3)]}>
              <TeamImage url={imageUrl} size={big ? 84 : 60} borderRadius={radius.sm} />
            </View>
          ) : null}
          <View style={styles.text}>
            {kicker ? (
              <View style={styles.kicker}>
                <AppText style={styles.kickerText}>{kicker}</AppText>
              </View>
            ) : null}
            <AppText
              numberOfLines={2}
              style={[
                styles.name,
                big ? styles.nameBig : null,
                { color: fg, textShadowColor: fg === palette.white ? palette.ink : 'transparent' },
              ]}
            >
              {name}
            </AppText>
            {projectTitle ? (
              <View style={styles.sticker}>
                <AppText style={styles.stickerText} numberOfLines={2}>
                  {projectTitle}
                </AppText>
              </View>
            ) : null}
          </View>
          {right}
        </View>
        {children ? <View style={styles.bottom}>{children}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: ink.thick,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: palette.white,
    marginBottom: spacing.xl,
    marginRight: 5,
  },
  clip: { borderRadius: radius.xl - ink.thick, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, minHeight: 110 },
  image: { borderWidth: ink.thin, borderColor: palette.ink, borderRadius: radius.sm + 2, backgroundColor: palette.white, transform: [{ rotate: '-3deg' }] },
  text: { flex: 1, gap: spacing.xs },
  kicker: { alignSelf: 'flex-start', backgroundColor: palette.white, borderWidth: ink.thin, borderColor: palette.ink, paddingHorizontal: 8, paddingVertical: 1 },
  kickerText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 15, letterSpacing: 1, textTransform: 'uppercase', color: palette.ink },
  name: { fontFamily: fonts.display, fontSize: 30, lineHeight: 33, letterSpacing: 1, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  nameBig: { fontSize: 40, lineHeight: 42 },
  sticker: {
    alignSelf: 'flex-start',
    backgroundColor: palette.white,
    borderWidth: ink.thin,
    borderColor: palette.ink,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    transform: [{ rotate: '-1.5deg' }],
    maxWidth: '100%',
  },
  stickerText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17, color: palette.ink },
  bottom: { borderTopWidth: ink.thick, borderTopColor: colors.border, padding: spacing.lg, gap: 4, backgroundColor: palette.white },
});
