import { palette } from '@/theme';

/** Banner colour for teams that have not picked one (older teams). */
export const DEFAULT_TEAM_COLOR = palette.ink;

function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relative luminance (0 dark … 1 light). */
export function luminance(hex: string): number {
  const c = rgb(hex);
  if (!c) return 0;
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ink or white, whichever reads better on the colour. */
export function textOn(hex: string): string {
  return luminance(hex) > 0.36 ? palette.ink : palette.white;
}

/** Mix the colour with white (amount 0..1), e.g. for a soft poster background. */
export function tint(hex: string, amount: number): string {
  const c = rgb(hex);
  if (!c) return hex;
  const to = (v: number) => Math.round(v + (255 - v) * amount).toString(16).padStart(2, '0');
  return `#${to(c[0])}${to(c[1])}${to(c[2])}`;
}

/** Mix the colour with black (amount 0..1). */
export function shade(hex: string, amount: number): string {
  const c = rgb(hex);
  if (!c) return hex;
  const to = (v: number) => Math.round(v * (1 - amount)).toString(16).padStart(2, '0');
  return `#${to(c[0])}${to(c[1])}${to(c[2])}`;
}

/** A contrasting accent for stickers on top of the team colour: yellow on dark/cool colours, ink-red on light ones. */
export function accentFor(hex: string): string {
  const c = rgb(hex);
  if (!c) return palette.yellow;
  const [r, g, b] = c;
  const yellowish = r > 200 && g > 160 && b < 120;
  if (yellowish) return palette.red;
  return palette.yellow;
}

export function teamColorOf(team: { color?: string | null } | null | undefined): string {
  return team?.color || DEFAULT_TEAM_COLOR;
}
