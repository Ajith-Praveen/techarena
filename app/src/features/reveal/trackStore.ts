/**
 * Music for the big-screen reveal. The organiser picks their own audio files on the projector laptop;
 * they are kept in this browser (IndexedDB) and never uploaded anywhere.
 */

export type Slot = 'countdown' | 'third' | 'second' | 'first';
export const SLOTS: Slot[] = ['countdown', 'third', 'second', 'first'];

/** Timings inside a track, in seconds. */
export interface Cue {
  /** Where playback begins. */
  start: number;
  /** The drop: the countdown hits 0 here, or the place is revealed here. */
  hit: number;
  /** Teammate photos pop in on every beat after the hit. */
  bpm: number;
}

export const DEFAULT_CUES: Record<Slot, Cue> = {
  countdown: { start: 0, hit: 10, bpm: 120 },
  third: { start: 0, hit: 4, bpm: 120 },
  second: { start: 0, hit: 4, bpm: 120 },
  first: { start: 0, hit: 5, bpm: 120 },
};

export interface StoredTrack {
  name: string;
  blob: Blob;
}

const DB_NAME = 'techarena-reveal';
const STORE = 'tracks';
const CUES_KEY = 'techarena.reveal.cues';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser cannot store music files.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open storage.'));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error ?? new Error('Storage error.'));
    });
  } finally {
    db.close();
  }
}

export async function loadTracks(): Promise<Partial<Record<Slot, StoredTrack>>> {
  const out: Partial<Record<Slot, StoredTrack>> = {};
  for (const slot of SLOTS) {
    const t = await run<StoredTrack | undefined>('readonly', (s) => s.get(slot)).catch(() => undefined);
    if (t?.blob) out[slot] = t;
  }
  return out;
}

export function saveTrack(slot: Slot, file: File): Promise<unknown> {
  const value: StoredTrack = { name: file.name, blob: file };
  return run('readwrite', (s) => s.put(value, slot));
}

export function deleteTrack(slot: Slot): Promise<unknown> {
  return run('readwrite', (s) => s.delete(slot));
}

export function loadCues(): Record<Slot, Cue> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CUES_KEY) : null;
    const saved = raw ? (JSON.parse(raw) as Partial<Record<Slot, Partial<Cue>>>) : {};
    const out = { ...DEFAULT_CUES };
    for (const slot of SLOTS) out[slot] = { ...DEFAULT_CUES[slot], ...(saved[slot] ?? {}) };
    return out;
  } catch {
    return { ...DEFAULT_CUES };
  }
}

export function saveCues(cues: Record<Slot, Cue>) {
  try {
    localStorage.setItem(CUES_KEY, JSON.stringify(cues));
  } catch {
    // Private mode: timings just reset next time.
  }
}

/** Lets the user pick one audio file (web only). */
export function pickAudioFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,.mp3,.m4a,.aac,.wav,.ogg';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export function fmtTime(s: number): string {
  if (!Number.isFinite(s)) return '0:00.0';
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`;
}
