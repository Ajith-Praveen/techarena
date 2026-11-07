import { useCallback, useRef } from 'react';
import { Animated, Platform } from 'react-native';

/** Horizontal "wrong code" shake. Spread `style` on an Animated.View and call `shake()`. */
export function useShake() {
  const offset = useRef(new Animated.Value(0)).current;
  const useNativeDriver = Platform.OS !== 'web';

  const shake = useCallback(() => {
    offset.setValue(0);
    const step = (toValue: number) => Animated.timing(offset, { toValue, duration: 55, useNativeDriver });
    Animated.sequence([step(12), step(-12), step(9), step(-9), step(5), step(-5), step(0)]).start();
  }, [offset, useNativeDriver]);

  return { shake, style: { transform: [{ translateX: offset }] } };
}
