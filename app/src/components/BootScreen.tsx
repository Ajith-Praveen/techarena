import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { colors, fonts, ink, palette, spacing } from '@/theme';

import { AppText } from './AppText';
import { HudBackground } from './hud/HudBackground';
import { Burst } from './comic/Burst';


/** Minimum time the boot sequence stays up, so it reads as an intro instead of a flicker. */
const MIN_MS = 1000;
const SEEN_KEY = 'ta.booted';

function seenThisSession(): boolean {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Private mode: the intro just plays again next time.
  }
}

export interface BootOverlayProps {
  /** True once the app has what it needs (fonts, saved session). */
  ready: boolean;
}

/**
 * Launch screen shown over the app while fonts and the saved session load: logo mark, name and a
 * thin progress bar. Plays in full once per launch (once per browser tab session on web); after that
 * it only covers the app until `ready`.
 */
export function BootOverlay({ ready }: BootOverlayProps) {
  const [quick] = useState(seenThisSession);
  const [minDone, setMinDone] = useState(quick);
  const [gone, setGone] = useState(false);
  const progress = useRef(new Animated.Value(quick ? 1 : 0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(quick ? 1 : 0.4)).current;
  const native = Platform.OS !== 'web';

  useEffect(() => {
    if (quick) return;
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: Platform.OS !== 'web' }).start();
    const anim = Animated.timing(progress, { toValue: 0.92, duration: MIN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    const timer = setTimeout(() => setMinDone(true), MIN_MS);
    return () => {
      anim.stop();
      clearTimeout(timer);
    };
  }, [progress, pop, quick]);

  useEffect(() => {
    if (!ready || !minDone || gone) return;
    markSeen();
    Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: false }),
      Animated.timing(fade, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: native }),
    ]).start(() => setGone(true));
  }, [ready, minDone, gone, progress, fade, native]);

  if (gone) return null;

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} pointerEvents={ready && minDone ? 'none' : 'auto'}>
      <HudBackground />
      <View style={styles.center}>
        <Animated.View style={{ transform: [{ scale: pop }, { rotate: '-4deg' }] }}>
          <Burst size={250} color={palette.yellow}>
            <AppText style={styles.name}>TECH{'\n'}ARENA!</AppText>
          </Burst>
        </Animated.View>
        <View style={styles.caption}>
          <AppText style={styles.tagline}>The project expo</AppText>
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width }]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, zIndex: 1000, elevation: 1000 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  name: { fontFamily: fonts.display, fontSize: 46, lineHeight: 46, letterSpacing: 1.5, color: palette.red, textAlign: 'center' },
  caption: {
    marginTop: spacing.lg,
    backgroundColor: palette.white,
    borderWidth: ink.thin,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    transform: [{ rotate: '2deg' }],
  },
  tagline: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.text },
  track: {
    marginTop: spacing.xl,
    width: 160,
    height: 14,
    borderWidth: ink.thin,
    borderColor: colors.border,
    borderRadius: 7,
    backgroundColor: palette.white,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: palette.red },
});
