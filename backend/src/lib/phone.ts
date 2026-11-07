/**
 * Normalizes a phone number to E.164-ish form (`+<digits>`), or returns null if it cannot be.
 * Rules (server authoritative): keep digits and a leading `+`; `+` numbers must have 8–15 digits;
 * 10 digits -> prefix country code; 11 digits starting with 0 -> drop 0, prefix country code;
 * 10 digits + country code prefix -> prefix `+`.
 */
export function normalizePhone(raw: unknown, countryCode: string): string | null {
  if (typeof raw !== 'string') return null;
  const cc = countryCode.replace(/\D/g, '') || '91';
  const kept = raw.replace(/[^\d+]/g, '');
  const hasPlus = kept.startsWith('+');
  const digits = kept.replace(/\D/g, '');

  if (hasPlus) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+${cc}${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+${cc}${digits.slice(1)}`;
  if (digits.length === 10 + cc.length && digits.startsWith(cc)) return `+${digits}`;
  return null;
}
