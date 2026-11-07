import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/theme';

export interface HudSpinnerProps {
  size?: number;
  color?: string;
  /** Center dot (default true). */
  core?: boolean;
  style?: StyleProp<ViewStyle>;
}

const useSpin = (duration: number, reverse = false) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }),
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration]);
  return v.interpolate({ inputRange: [0, 1], outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'] });
};

/** Two counter-rotating HUD arcs around a steady core dot. */
export function HudSpinner({ size = 48, color = '#FAFAFA', core = false, style }: HudSpinnerProps) {
  const outer = useSpin(1400);
  const inner = useSpin(2200, true);
  const r1 = size / 2 - 2;
  const r2 = size / 2 - size * 0.2;
  const c1 = 2 * Math.PI * r1;
  const c2 = 2 * Math.PI * r2;
  const ring = { width: size, height: size };
  return (
    <View style={[ring, style]} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: outer }] }]}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r1} stroke={colors.border} strokeWidth={1} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r1}
            stroke={color}
            strokeWidth={1}
            fill="none"
            strokeDasharray={`${c1 * 0.22} ${c1 * 0.78}`}
            strokeLinecap="butt"
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: inner }] }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r2}
            stroke={colors.faint}
            strokeWidth={1}
            fill="none"
            strokeDasharray={`${c2 * 0.1} ${c2 * 0.15} ${c2 * 0.1} ${c2 * 0.65}`}
          />
        </Svg>
      </Animated.View>
      {core ? <View style={[styles.core, { left: size / 2 - 3, top: size / 2 - 3, backgroundColor: color }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  core: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
});
