const EMPTY = '—';

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "4 Nov 2026, 10:42 AM" in the device locale. */
export function formatDateTime(iso: string | null | undefined): string {
  const d = toDate(iso);
  if (!d) return EMPTY;
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** "4 Nov 2026" */
export function formatDate(iso: string | null | undefined): string {
  const d = toDate(iso);
  if (!d) return EMPTY;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "10:42 AM" */
export function formatTime(iso: string | null | undefined): string {
  const d = toDate(iso);
  if (!d) return EMPTY;
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "just now", "5 min ago", "2 h ago", "3 d ago", then a date. */
export function formatRelative(iso: string | null | undefined, now: number = Date.now()): string {
  const d = toDate(iso);
  if (!d) return EMPTY;
  const sec = Math.round((now - d.getTime()) / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days} d ago`;
  return formatDate(iso);
}

/** Score/average with up to `digits` decimals, trailing zeros trimmed ("42", "41.5", "41.25"). */
export function formatScore(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return String(Number(value.toFixed(digits)));
}

/** Average always shown with 2 decimals ("41.50"), as on the leaderboard. */
export function formatAverage(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return value.toFixed(2);
}

/** "37 / 50" */
export function formatOutOf(value: number | null | undefined, max: number): string {
  return `${formatScore(value)} / ${max}`;
}

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th" */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** plural(1, 'team') -> "1 team"; plural(3, 'judge') -> "3 judges" */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** First letters of up to two words, for avatars. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
