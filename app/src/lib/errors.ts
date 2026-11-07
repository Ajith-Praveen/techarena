import { ApiError, isApiError } from '@/api/client';

/** Normalizes anything thrown into an ApiError. */
export function toApiError(e: unknown): ApiError {
  if (isApiError(e)) return e;
  if (e instanceof Error) return new ApiError(0, 'INTERNAL', e.message || 'Something went wrong.');
  if (typeof e === 'string') return new ApiError(0, 'INTERNAL', e);
  return new ApiError(0, 'INTERNAL', 'Something went wrong.');
}

/** Human-readable message for any thrown value. */
export function errorMessage(e: unknown): string {
  return toApiError(e).message;
}

/** Per-field validation messages from a VALIDATION / CONFLICT error (empty object otherwise). */
export function fieldErrors(e: unknown): Record<string, string> {
  return isApiError(e) && e.fields ? e.fields : {};
}
