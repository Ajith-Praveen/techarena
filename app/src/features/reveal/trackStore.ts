/**
 * Music for the big-screen reveal. The organiser picks ONE song on the projector laptop; it is kept in this
 * browser (IndexedDB) and never uploaded anywhere. The whole show runs on that song's clock.
 */

/** Moments in the song, in seconds from its start. */
export interface ShowTimes {
  /** The big "10" appears. */
  countdown: number;
  /** The countdown hits 0. */
  zero: number;
  /** "Congratulations in advance to the winning teams!" */
  congrats: number;
  /** "And the top 3 teams are…" */
  top3: number;
  /** Suspense build-up before 3rd place. */
  build3: number;
  third: number;
  second: number;
  /** Suspense build-up before the champion. */
  build1: number;
  first: number;
  /** All three winners together until the song ends. */
  finale: number;
  /** Beat grid: tempo and the time of any one beat. Animations land on this grid. */
  bpm: number;
  beat: number;
}

export type MomentKey = Exclude<keyof ShowTimes, 'bpm' | 'beat'>;
export const MOMENTS: MomentKey[] = ['countdown', 'zero', 'congrats', 'top3', 'build3', 'third', 'second', 'build1', 'first', 'finale'];

/**
 * Tuned to the organiser's song (2:03 long, 119.2 BPM, first beat at 24.53 s): each moment sits on a beat
 * and on the nearest big hit to the times they asked for. Change them if a different file is used.
 */
export const DEFAULT_TIMES: ShowTimes = {
  countdown: 24.53,
  zero: 48.19,
  congrats: 49.9,
  top3: 55.74,
  build3: 64.8,
  third: 74.87,
  second: 84.94,
  build1: 92.99,
  first: 101.04,
  finale: 111.11,
  bpm: 119.19,
  beat: 24.53,
};

/** Seconds per beat (falls back to 120 BPM). */
export function beatLength(t: ShowTimes): number {
  return 60 / (t.bpm >= 30 && t.bpm <= 240 ? t.bpm : 120);
}

/** Moves `x` onto the nearest beat of the grid. */
export function snapToBeat(x: number, t: ShowTimes): number {
  const p = beatLength(t);
  return t.beat + Math.round((x - t.beat) / p) * p;
}

/** Problems with the order of the moments (each must come after the one before). */
export function timelineProblems(t: ShowTimes, duration?: number): string[] {
  const out: string[] = [];
  for (let i = 1; i < MOMENTS.length; i++) {
    const a = MOMENTS[i - 1]!;
    const b = MOMENTS[i]!;
    if (!(t[b] > t[a])) out.push(`"${MOMENT_LABEL[b]}" must come after "${MOMENT_LABEL[a]}".`);
  }
  if (t.zero - t.countdown < 5) out.push('Give the countdown at least 5 seconds.');
  if (duration && t.finale >= duration) out.push(`The finale (${fmtTime(t.finale)}) is after the end of the song (${fmtTime(duration)}).`);
  return out;
}

export const MOMENT_LABEL: Record<MomentKey, string> = {
  countdown: 'Countdown starts (10)',
  zero: 'Countdown hits 0',
  congrats: 'Congratulations',
  top3: 'And the top 3 teams are',
  build3: 'Suspense for 3rd place',
  third: '3rd place revealed',
  second: '2nd place revealed',
  build1: 'Suspense for the champion',
  first: '1st place revealed',
  finale: 'All 3 winners together',
};

export interface StoredTrack {
  name: string;
  blob: Blob;
}

const DB_NAME = 'techarena-reveal';
const STORE = 'tracks';
const SONG_KEY = 'show';
const TIMES_KEY = 'techarena.reveal.times.v1';

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

export async function loadSong(): Promise<StoredTrack | null> {
  const t = await run<StoredTrack | undefined>('readonly', (s) => s.get(SONG_KEY));
  return t?.blob ? t : null;
}

export function saveSong(file: File): Promise<unknown> {
  const value: StoredTrack = { name: file.name, blob: file };
  return run('readwrite', (s) => s.put(value, SONG_KEY));
}

export function deleteSong(): Promise<unknown> {
  return run('readwrite', (s) => s.delete(SONG_KEY));
}

export function loadTimes(): ShowTimes {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(TIMES_KEY) : null;
    const saved = raw ? (JSON.parse(raw) as Partial<ShowTimes>) : {};
    const out = { ...DEFAULT_TIMES };
    for (const k of Object.keys(DEFAULT_TIMES) as (keyof ShowTimes)[]) {
      const v = saved[k];
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return { ...DEFAULT_TIMES };
  }
}

export function saveTimes(times: ShowTimes) {
  try {
    localStorage.setItem(TIMES_KEY, JSON.stringify(times));
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
