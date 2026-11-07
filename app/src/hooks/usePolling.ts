import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';

export interface PollingOptions {
  /** Also run `fn` immediately each time the screen gains focus (default false). */
  immediate?: boolean;
}

/**
 * Calls `fn` every `intervalMs` while the screen is focused and `enabled` is true.
 * Skips ticks while a previous call is still running or the browser tab is hidden. Errors are swallowed;
 * surface them through your own state (e.g. useAsync's `reload`).
 */
export function usePolling(
  fn: () => unknown | Promise<unknown>,
  intervalMs: number,
  enabled = true,
  options: PollingOptions = {},
): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const { immediate = false } = options;

  useFocusEffect(
    useCallback(() => {
      if (!enabled || intervalMs <= 0) return;
      let running = false;
      const tick = async () => {
        if (running) return;
        if (Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden) return;
        running = true;
        try {
          await fnRef.current();
        } catch {
          // ignored by design
        } finally {
          running = false;
        }
      };
      if (immediate) void tick();
      const id = setInterval(tick, intervalMs);
      return () => clearInterval(id);
    }, [enabled, intervalMs, immediate]),
  );
}
