import { isApiError } from '@/api/client';
import { fieldErrors } from '@/lib/errors';

import type { FieldErrors } from './validation';

/** Server field names that map onto a differently named form field. */
const ALIASES: Record<string, string> = {
  imageBase64: 'image',
  imageMime: 'image',
  photoBase64: 'photo',
  photoMime: 'photo',
};

/** Field errors from a VALIDATION / CONFLICT ApiError, keyed by form field. */
export function serverFieldErrors(e: unknown): FieldErrors {
  const out: FieldErrors = {};
  for (const [key, msg] of Object.entries(fieldErrors(e))) {
    const k = ALIASES[key] ?? key;
    if (!out[k]) out[k] = msg;
  }
  return out;
}

/** Form-level message for an error; field-level problems get a pointer to the highlighted inputs. */
export function formErrorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!isApiError(e)) return e instanceof Error && e.message ? e.message : fallback;
  const hasFields = Object.keys(e.fields ?? {}).length > 0;
  if (hasFields && (e.code === 'VALIDATION' || e.code === 'CONFLICT')) return 'Please fix the highlighted fields.';
  return e.message || fallback;
}
