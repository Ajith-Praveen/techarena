import { isPlausibleEmail, isPlausiblePhone } from '@/lib/phone';

/** Client-side mirrors of the server limits (SPEC section 4). The server stays authoritative. */
export const LIMITS = {
  name: { min: 2, max: 60 },
  usn: { min: 3, max: 20 },
  teamName: { min: 2, max: 60 },
  projectTitle: { min: 3, max: 80 },
  projectDesc: { min: 10, max: 1000 },
  passwordMin: 6,
} as const;

export type FieldErrors = Record<string, string>;

export function lengthError(value: string, label: string, { min, max }: { min: number; max: number }): string | undefined {
  const len = value.trim().length;
  if (len === 0) return `${label} is required`;
  if (len < min) return `${label} must be at least ${min} characters`;
  if (len > max) return `${label} must be at most ${max} characters`;
  return undefined;
}

export function phoneError(value: string): string | undefined {
  if (!value.trim()) return 'Phone number is required';
  if (!isPlausiblePhone(value)) return 'Enter a valid phone number (10 digits, or + and country code)';
  return undefined;
}

export function emailError(value: string): string | undefined {
  if (!value.trim()) return 'Email is required';
  if (!isPlausibleEmail(value)) return 'Enter a valid email address';
  return undefined;
}

export function usnError(value: string, required: boolean): string | undefined {
  if (!value.trim()) return required ? 'USN is required' : undefined;
  return lengthError(value, 'USN', LIMITS.usn);
}

export function passwordError(value: string, label = 'Password'): string | undefined {
  if (!value) return `${label} is required`;
  if (value.length < LIMITS.passwordMin) return `${label} must be at least ${LIMITS.passwordMin} characters`;
  return undefined;
}

/** Drops undefined entries so `Object.keys(errors).length` tells whether the form is valid. */
export function compact(errors: Record<string, string | undefined>): FieldErrors {
  const out: FieldErrors = {};
  for (const [k, v] of Object.entries(errors)) if (v) out[k] = v;
  return out;
}
