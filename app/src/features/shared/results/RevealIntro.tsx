import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components';
import { Burst } from '@/components/comic/Burst';
import { HudBackground } from '@/components/hud/HudBackground';
import { tapFeedback } from '@/lib/haptics';
import { fonts, palette, spacing } from '@/theme';

const NATIVE = Platform.OS !== 'web';
const STEPS = ['3', '2', '1'] as const;
const BURST_COLORS = [palette.blue, palette.pink, palette.red];

export interface RevealIntroProps {
  eventName: string;
  onDone: () => void;
}

/** Full-screen drum roll before the podium: "And the winners are…", then a 3-2-1 countdown in popping bursts. */
export function RevealIntro({ eventName, onDone }: RevealIntroProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(-1); // -1 = title card, 0..2 = countdown
  const fade = useRef(new Animated.Value(1)).current;
  const titleIn = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: NATIVE }).start(() => onDone());
  };

  useEffect(() => {
    Animated.spring(titleIn, { toValue: 1, friction: 5, tension: 70, useNativeDriver: NATIVE }).start();
    const timers = [
      setTimeout(() => setStep(0), 1500),
      setTimeout(() => setStep(1), 2300),
      setTimeout(() => setStep(2), 3100),
      setTimeout(finish, 3950),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step < 0) return;
    tapFeedback();
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: NATIVE }).start();
  }, [step, pop]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]}>
      <HudBackground />
      <View style={styles.center}>
        {step < 0 ? (
          <Animated.View
            style={{
              alignItems: 'center',
              transform: [
                { scale: titleIn.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                { rotate: titleIn.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '-3deg'] }) },
              ],
            }}
          >
            <View style={styles.caption}>
              <AppText style={styles.captionText}>{`${eventName} · Results`}</AppText>
            </View>
            <AppText style={styles.title}>{'AND THE\nWINNERS\nARE…'}</AppText>
          </Animated.View>
        ) : (
          <Animated.View
            key={step}
            style={{
              transform: [
                { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
                { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: [step % 2 ? '18deg' : '-18deg', step % 2 ? '4deg' : '-4deg'] }) },
              ],
            }}
          >
            <Burst size={260} color={BURST_COLORS[step] ?? palette.yellow} points={16}>
              <AppText style={styles.count}>{STEPS[step]}</AppText>
            </Burst>
          </Animated.View>
        )}
      </View>
      <Pressable
        onPress={() => {
          tapFeedback();
          finish();
        }}
        accessibilityRole="button"
        accessibilityLabel="Skip the reveal"
        hitSlop={12}
        style={[styles.skip, { top: insets.top + spacing.lg }]}
      >
        <AppText style={styles.skipText}>Skip</AppText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 50, elevation: 50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  caption: {
    backgroundColor: palette.yellow,
    borderWidth: 2,
    borderColor: palette.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginBottom: spacing.lg,
  },
  captionText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17, letterSpacing: 1.4, textTransform: 'uppercase', color: palette.ink },
  title: { fontFamily: fonts.display, fontSize: 64, lineHeight: 62, letterSpacing: 2, color: palette.red, textAlign: 'center' },
  // Bold sans for the digits: in Bangers a 1 and a 7 look alike.
  count: { fontFamily: fonts.bold, fontSize: 120, lineHeight: 130, color: palette.white, textShadowColor: palette.ink, textShadowOffset: { width: 4, height: 4 }, textShadowRadius: 0 },
  skip: {
    position: 'absolute',
    right: spacing.lg,
    backgroundColor: palette.white,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
  },
  skipText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18, color: palette.ink },
});
