import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { api, isApiError, setAuthToken, setUnauthorizedHandler } from '@/api/client';
import type { MeResponse, Role, Session } from '@/api/types';

import { clearSession, loadCachedSession, loadToken, saveSession } from './storage';

export interface AuthContextValue {
  session: Session | null;
  role: Role | null;
  /** True only while the stored session is being restored at app start. */
  loading: boolean;
  /** Store a session returned by register / login endpoints. Navigate afterwards (e.g. `router.replace('/')`). */
  signIn: (session: Session) => Promise<void>;
  /** Revokes the session on the server (best effort) and clears it locally. */
  signOut: () => Promise<void>;
  /** Re-fetches /api/me (e.g. after editing the team). Returns the new session, or null if signed out. */
  refreshMe: () => Promise<Session | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function merge(token: string, me: MeResponse): Session {
  return { token, role: me.role, member: me.member, team: me.team, judge: me.judge, needsPhoto: me.needsPhoto === true };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);

  const apply = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setAuthToken(next?.token ?? null);
    setSession(next);
  }, []);

  const dropLocal = useCallback(async () => {
    apply(null);
    await clearSession();
  }, [apply]);

  // Any authenticated request returning 401 means the session is gone server-side.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (sessionRef.current) void dropLocal();
    });
    return () => setUnauthorizedHandler(null);
  }, [dropLocal]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, cached] = await Promise.all([loadToken(), loadCachedSession()]);
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      setAuthToken(token);
      try {
        const me = await api.me();
        if (cancelled) return;
        const next = merge(token, me);
        apply(next);
        await saveSession(next);
      } catch (e) {
        if (cancelled) return;
        if (isApiError(e) && e.status === 401) {
          await dropLocal();
        } else if (cached && cached.token === token) {
          // Offline / server unreachable: keep the last known session.
          apply(cached);
        } else {
          setAuthToken(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apply, dropLocal]);

  const signIn = useCallback(
    async (next: Session) => {
      apply(next);
      await saveSession(next);
    },
    [apply],
  );

  const signOut = useCallback(async () => {
    if (sessionRef.current) {
      await Promise.race([api.logout().catch(() => undefined), delay(3000)]);
    }
    await dropLocal();
  }, [dropLocal]);

  const refreshMe = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return null;
    try {
      const next = merge(current.token, await api.me());
      if (sessionRef.current?.token !== current.token) return sessionRef.current;
      apply(next);
      await saveSession(next);
      return next;
    } catch (e) {
      if (isApiError(e) && e.status === 401) return null;
      throw e;
    }
  }, [apply]);

  const value = useMemo<AuthContextValue>(
    () => ({ session, role: session?.role ?? null, loading, signIn, signOut, refreshMe }),
    [session, loading, signIn, signOut, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
