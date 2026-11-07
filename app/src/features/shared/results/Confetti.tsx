import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { palette } from '@/theme';

const COLORS = [palette.red, palette.yellow, palette.blue, palette.green, palette.pink, palette.purple, palette.orange, palette.cyan];
const NATIVE = Platform.OS !== 'web';

interface Piece {
  x: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  sway: number;
  spin: number;
  round: boolean;
}

export interface ConfettiProps {
  /** Number of pieces (default 70). */
  count?: number;
  /** Change this to fire another round. */
  burstKey?: number | string;
}

/** Comic confetti: outlined paper bits that fall, sway and spin once across the screen. */
export const Confetti = memo(function Confetti({ count = 70, burstKey = 0 }: ConfettiProps) {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo<Piece[]>(() => {
    // Deterministic per burst so a re-render does not reshuffle mid-fall.
    let seed = 1 + (typeof burstKey === 'number' ? burstKey : String(burstKey).length) * 97;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    return Array.from({ length: count }, () => ({
      x: rnd() * width,
      size: 8 + rnd() * 9,
      color: COLORS[Math.floor(rnd() * COLORS.length)]!,
      delay: rnd() * 900,
      duration: 2600 + rnd() * 1800,
      sway: 20 + rnd() * 50,
      spin: (rnd() > 0.5 ? 1 : -1) * (2 + rnd() * 4),
      round: rnd() > 0.7,
    }));
  }, [count, width, burstKey]);

  const progress = useRef(pieces.map(() => new Animated.Value(0))).current;
  if (progress.length !== pieces.length) progress.splice(0, progress.length, ...pieces.map(() => new Animated.Value(0)));

  useEffect(() => {
    progress.forEach((v) => v.setValue(0));
    const anims = pieces.map((p, i) =>
      Animated.timing(progress[i]!, {
        toValue: 1,
        duration: p.duration,
        delay: p.delay,
        easing: Easing.in(Easing.quad),
        useNativeDriver: NATIVE,
      }),
    );
    const all = Animated.parallel(anims);
    all.start();
    return () => all.stop();
  }, [pieces, progress]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const v = progress[i]!;
        return (
          <Animated.View
            key={i}
            style={[
              styles.piece,
              {
                left: p.x,
                width: p.size,
                height: p.round ? p.size : p.size * 0.6,
                borderRadius: p.round ? p.size / 2 : 2,
                backgroundColor: p.color,
                opacity: v.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
                transform: [
                  { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-40, height + 120] }) },
                  { translateX: v.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, p.sway, 0, -p.sway, 0] }) },
                  { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin * 360}deg`] }) },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, borderWidth: 1.5, borderColor: palette.ink },
});
