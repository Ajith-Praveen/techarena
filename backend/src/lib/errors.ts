import type { ContentfulStatusCode } from 'hono/utils/http-status';

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION'
  | 'TIES_UNRESOLVED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'REGISTRATION_CLOSED'
  | 'RESULTS_PUBLISHED'
  | 'ALREADY_EVALUATED'
  | 'INCOMPLETE'
  | 'INTERNAL';

export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
  }

  toBody() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
        ...(this.extra ?? {}),
      },
    };
  }
}

export const badRequest = (message: string) => new ApiError(400, 'BAD_REQUEST', message);
export const validation = (fields: Record<string, string>, message = 'Please fix the highlighted fields') =>
  new ApiError(400, 'VALIDATION', message, fields);
export const unauthorized = (message = 'Please log in again') => new ApiError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have access to this') => new ApiError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Not found') => new ApiError(404, 'NOT_FOUND', message);
export const conflict = (message: string, fields?: Record<string, string>) =>
  new ApiError(409, 'CONFLICT', message, fields);
export const registrationClosed = () =>
  new ApiError(403, 'REGISTRATION_CLOSED', 'Registration is closed');
export const resultsPublished = (status: ContentfulStatusCode = 403) =>
  new ApiError(status, 'RESULTS_PUBLISHED', 'Results have already been published');

/** True when a D1 error (possibly wrapped by a batch) is a constraint violation mentioning `needle`. */
export function isConstraintError(err: unknown, needle: string): boolean {
  let cur: unknown = err;
  for (let depth = 0; cur && depth < 5; depth++) {
    const msg = cur instanceof Error ? cur.message : String(cur);
    if (msg.includes(needle)) return true;
    cur = cur instanceof Error ? (cur as Error & { cause?: unknown }).cause : undefined;
  }
  return false;
}
