import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { api, type ApiError } from '@/api/client';
import type { AppConfig } from '@/api/types';
import { toApiError } from '@/lib/errors';

const STALE_MS = 30_000;

interface ConfigState {
  config: AppConfig | null;
  error: ApiError | null;
  loading: boolean;
  fetchedAt: number;
}

let state: ConfigState = { config: null, error: null, loading: false, fetchedAt: 0 };
let inflight: Promise<AppConfig | null> | null = null;
const listeners = new Set<() => void>();

function setState(patch: Partial<ConfigState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Fetches /api/config into the shared cache. Concurrent calls share one request. */
export function fetchConfig(force = false): Promise<AppConfig | null> {
  if (inflight) return inflight;
  if (!force && state.config && Date.now() - state.fetchedAt < STALE_MS) return Promise.resolve(state.config);
  setState({ loading: true });
  inflight = api
    .config()
    .then((config) => {
      setState({ config, error: null, loading: false, fetchedAt: Date.now() });
      return config;
    })
    .catch((e: unknown) => {
      setState({ error: toApiError(e), loading: false });
      return state.config;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export interface UseConfigResult {
  config: AppConfig | null;
  /** True while the first fetch is in flight (no cached config yet). */
  loading: boolean;
  error: ApiError | null;
  /** Force a re-fetch (e.g. after admin toggles registration). */
  refresh: () => Promise<AppConfig | null>;
}

/** Cached GET /api/config shared by every component; re-fetched when older than 30 s on mount. */
export function useConfig(): UseConfigResult {
  const snap = useSyncExternalStore(subscribe, () => state, () => state);

  useEffect(() => {
    void fetchConfig(false);
  }, []);

  const refresh = useCallback(() => fetchConfig(true), []);

  return {
    config: snap.config,
    loading: !snap.config && (snap.loading || (!snap.error && snap.fetchedAt === 0)),
    error: snap.error,
    refresh,
  };
}
