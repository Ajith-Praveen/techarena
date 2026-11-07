import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Platform } from 'react-native';

const STEP_MS = 90;
const MAX_DELAY_MS = 1800;

/**
 * Fades + slides its child in, staggered by `index`, whenever `revealKey` changes.
 * With `revealKey` 0 the child renders immediately (no animation on normal loads).
 */
export function RevealItem({ index, revealKey, children }: { index: number; revealKey: number; children: ReactNode }) {
  const progress = useRef(new Animated.Value(revealKey ? 0 : 1)).current;
  // Only a new revealKey replays the animation; reordering rows must not.
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    if (!revealKey) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      delay: Math.min(indexRef.current * STEP_MS, MAX_DELAY_MS),
      useNativeDriver: Platform.OS !== 'web',
    });
    anim.start();
    return () => anim.stop();
  }, [revealKey, progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}
