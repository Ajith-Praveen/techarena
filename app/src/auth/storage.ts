import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { Session } from '@/api/types';

const TOKEN_KEY = 'techarena.token';
const SESSION_KEY = 'techarena.session';

const isWeb = Platform.OS === 'web';

function webStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** String key/value storage: SecureStore on native, localStorage on web. Never throws. */
export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (isWeb) return webStorage()?.getItem(key) ?? null;
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      if (isWeb) webStorage()?.setItem(key, value);
      else await SecureStore.setItemAsync(key, value);
    } catch {
      // Storage full or unavailable (e.g. private mode); the session just won't persist.
    }
  },
  async remove(key: string): Promise<void> {
    try {
      if (isWeb) webStorage()?.removeItem(key);
      else await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
  },
};

export async function loadToken(): Promise<string | null> {
  return storage.get(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  await storage.set(TOKEN_KEY, token);
}

/** Last known session (used when the server is unreachable at boot). */
export async function loadCachedSession(): Promise<Session | null> {
  const raw = await storage.get(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    return parsed && typeof parsed.token === 'string' && typeof parsed.role === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

// SecureStore values should stay under ~2 KB; drop the long description if needed.
function serializeSession(session: Session): string {
  const full = JSON.stringify(session);
  if (full.length < 1900 || !session.team) return full;
  return JSON.stringify({ ...session, team: { ...session.team, projectDesc: '' } });
}

export async function saveSession(session: Session): Promise<void> {
  await Promise.all([saveToken(session.token), storage.set(SESSION_KEY, serializeSession(session))]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([storage.remove(TOKEN_KEY), storage.remove(SESSION_KEY)]);
}
