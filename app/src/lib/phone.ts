/** Digits only (drops "+", spaces, dashes). */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Pretty-prints a normalized phone for display.
 * "+919876543210" -> "+91 98765 43210"; other formats are grouped loosely.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  const digits = phoneDigits(trimmed);
  if (trimmed.startsWith('+91') && digits.length === 12) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (!trimmed.startsWith('+') && digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (trimmed.startsWith('+') && digits.length > 10) {
    const cc = digits.slice(0, digits.length - 10);
    const rest = digits.slice(-10);
    return `+${cc} ${rest.slice(0, 5)} ${rest.slice(5)}`;
  }
  return trimmed;
}

/**
 * Light client-side check before hitting the API (the server is authoritative):
 * 10 digits, 0 + 10 digits, or + followed by 8-15 digits.
 */
export function isPlausiblePhone(input: string): boolean {
  const cleaned = input.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    const d = cleaned.slice(1);
    return /^\d{8,15}$/.test(d);
  }
  return /^\d{10}$/.test(cleaned) || /^0\d{10}$/.test(cleaned) || /^\d{12}$/.test(cleaned);
}

/** Basic `x@y.z` check, matching the server. */
export function isPlausibleEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}
