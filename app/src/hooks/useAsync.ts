import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type DependencyList, type Dispatch, type SetStateAction } from 'react';

import type { ApiError } from '@/api/client';
import { toApiError } from '@/lib/errors';

export interface AsyncOptions {
  /** Skip fetching while false (default true). */
  enabled?: boolean;
  /** Silently re-fetch whenever the screen regains focus (default false). */
  refetchOnFocus?: boolean;
}

export interface AsyncState<T> {
  data: T | undefined;
  error: ApiError | null;
  /** True while fetching and there is no data yet. */
  loading: boolean;
  /** True during a user-triggered refresh (bind to pull-to-refresh). */
  refreshing: boolean;
  /** User-triggered refresh: sets `refreshing`. */
  refresh: () => Promise<void>;
  /** Background re-fetch without spinners (polling, after a mutation). */
  reload: () => Promise<void>;
  /** Optimistic/local update of the data. */
  setData: Dispatch<SetStateAction<T | undefined>>;
}

type Mode = 'initial' | 'refresh' | 'silent';

/**
 * Runs `fn` on mount and whenever `deps` change. Stale responses are ignored.
 * `error` is kept alongside old `data` so screens can show a banner instead of wiping content.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList, options: AsyncOptions = {}): AsyncState<T> {
  const { enabled = true, refetchOnFocus = false } = options;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [fetching, setFetching] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);

  const fnRef = useRef(fn);
  fnRef.current = fn;
  const requestId = useRef(0);
  const mounted = useRef(true);
  const firstFocus = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (mode: Mode) => {
    const id = ++requestId.current;
    if (mode === 'refresh') setRefreshing(true);
    if (mode === 'initial') setFetching(true);
    try {
      const result = await fnRef.current();
      if (!mounted.current || id !== requestId.current) return;
      setData(result);
      setError(null);
    } catch (e) {
      if (!mounted.current || id !== requestId.current) return;
      setError(toApiError(e));
    } finally {
      if (mounted.current && id === requestId.current) {
        setFetching(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setFetching(false);
      return;
    }
    void run('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (enabled && refetchOnFocus) void run('silent');
    }, [enabled, refetchOnFocus, run]),
  );

  const refresh = useCallback(() => run('refresh'), [run]);
  const reload = useCallback(() => run('silent'), [run]);

  return { data, error, loading: fetching && data === undefined, refreshing, refresh, reload, setData };
}

/** `useAsync` preset for screen data: fetch on mount and silently re-fetch on focus. */
export function useApi<T>(fn: () => Promise<T>, deps: DependencyList = [], options: AsyncOptions = {}): AsyncState<T> {
  return useAsync(fn, deps, { refetchOnFocus: true, ...options });
}
