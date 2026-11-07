const WORDS = [
  'amber', 'arena', 'atlas', 'blaze', 'bolt', 'cedar', 'comet', 'coral', 'delta', 'ember',
  'falcon', 'flint', 'forge', 'frost', 'glide', 'harbor', 'hazel', 'jade', 'kite', 'lumen',
  'maple', 'meteor', 'nova', 'onyx', 'orbit', 'pixel', 'prism', 'quartz', 'raven', 'ridge',
  'rocket', 'sable', 'solar', 'spark', 'storm', 'tango', 'tiger', 'vapor', 'vector', 'willow',
  'zephyr', 'cobalt', 'lotus', 'mango', 'neon', 'otter', 'panda', 'pepper', 'river', 'sky',
] as const;

type CryptoLike = { getRandomValues?: (array: Uint32Array) => Uint32Array };

function randomInt(max: number): number {
  const c = (globalThis as { crypto?: CryptoLike }).crypto;
  if (c?.getRandomValues) {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/** Easy to read aloud and type on an iPad, e.g. "kite-orbit-47". */
export function generatePassword(): string {
  const a = WORDS[randomInt(WORDS.length)];
  let b = WORDS[randomInt(WORDS.length)];
  while (b === a) b = WORDS[randomInt(WORDS.length)];
  return `${a}-${b}-${10 + randomInt(90)}`;
}

export const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
