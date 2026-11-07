import type { Context } from 'hono';
import { base64ToBytes } from './crypto';
import { badRequest, validation } from './errors';
import { normalizePhone } from './phone';
import { findTeamColor } from '../teamColors';

export type Body = Record<string, unknown>;

export const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageMime = (typeof IMAGE_MIMES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function readBody(c: Context): Promise<Body> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest('Request body must be valid JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Request body must be a JSON object');
  }
  return body as Body;
}

/** Collects per-field errors so a single response can report all of them. */
export class Validator {
  readonly fields: Record<string, string> = {};

  constructor(private readonly body: Body) {}

  fail(key: string, message: string): void {
    if (!(key in this.fields)) this.fields[key] = message;
  }

  /** A team banner colour from TEAM_COLORS (stored as its canonical hex), or null when absent. */
  teamColor(key: string, required: boolean): string | null {
    const raw = this.body[key];
    if (raw === undefined || raw === null || raw === '') {
      if (required) this.fail(key, 'Pick a team colour');
      return null;
    }
    const match = typeof raw === 'string' ? findTeamColor(raw) : undefined;
    if (!match) {
      this.fail(key, 'Pick one of the team colours');
      return null;
    }
    return match.hex;
  }

  has(key: string): boolean {
    return this.body[key] !== undefined && this.body[key] !== null;
  }

  text(key: string, label: string, min: number, max: number): string {
    const raw = this.body[key];
    if (typeof raw !== 'string') {
      this.fail(key, `${label} is required`);
      return '';
    }
    const value = raw.trim().replace(/\s+/g, ' ');
    if (value.length < min || value.length > max) {
      this.fail(key, `${label} must be ${min}–${max} characters`);
    }
    return value;
  }

  /** Multi-line text: trims ends but keeps internal newlines. */
  longText(key: string, label: string, min: number, max: number): string {
    const raw = this.body[key];
    if (typeof raw !== 'string') {
      this.fail(key, `${label} is required`);
      return '';
    }
    const value = raw.replace(/\r\n/g, '\n').trim();
    if (value.length < min || value.length > max) {
      this.fail(key, `${label} must be ${min}–${max} characters`);
    }
    return value;
  }

  optionalText(key: string, label: string, min: number, max: number, multiline = false): string | null {
    const raw = this.body[key];
    if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return null;
    return multiline ? this.longText(key, label, min, max) : this.text(key, label, min, max);
  }

  usn(key: string, required: boolean): string | null {
    const value = required ? this.text(key, 'USN', 3, 20) : this.optionalText(key, 'USN', 3, 20);
    return value === null ? null : value.toUpperCase();
  }

  email(key: string): string {
    const raw = this.body[key];
    const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (!value) this.fail(key, 'Email is required');
    else if (value.length > 254 || !EMAIL_RE.test(value)) this.fail(key, 'Enter a valid email address');
    return value;
  }

  phone(key: string, countryCode: string): string {
    const raw = this.body[key];
    if (typeof raw !== 'string' || raw.trim() === '') {
      this.fail(key, 'Phone number is required');
      return '';
    }
    const phone = normalizePhone(raw, countryCode);
    if (!phone) {
      this.fail(key, 'Enter a valid phone number');
      return '';
    }
    return phone;
  }

  password(key: string, label = 'Password'): string {
    const raw = this.body[key];
    if (typeof raw !== 'string' || raw.length === 0) {
      this.fail(key, `${label} is required`);
      return '';
    }
    if (raw.length < 6) this.fail(key, `${label} must be at least 6 characters`);
    else if (raw.length > 128) this.fail(key, `${label} must be at most 128 characters`);
    return raw;
  }

  /** A required non-empty string, without length rules (e.g. a password being checked). */
  secret(key: string, label = 'Password'): string {
    const raw = this.body[key];
    if (typeof raw !== 'string' || raw.length === 0) {
      this.fail(key, `${label} is required`);
      return '';
    }
    return raw;
  }

  optionalBoolean(key: string): boolean | undefined {
    const raw = this.body[key];
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw !== 'boolean') {
      this.fail(key, `${key} must be true or false`);
      return undefined;
    }
    return raw;
  }

  image(base64Key: string, mimeKey: string, label = 'Project image'): { bytes: Uint8Array; mime: ImageMime } | null {
    const mime = this.body[mimeKey];
    const data = this.body[base64Key];
    if (typeof mime !== 'string' || !(IMAGE_MIMES as readonly string[]).includes(mime)) {
      this.fail(mimeKey, 'Image must be a JPEG, PNG or WebP');
    }
    if (typeof data !== 'string' || data.length === 0) {
      this.fail(base64Key, `${label} is required`);
      return null;
    }
    // Cheap size estimate before decoding so huge payloads are rejected without allocating.
    if (Math.floor((data.replace(/\s+/g, '').length * 3) / 4) - 2 > MAX_IMAGE_BYTES) {
      this.fail(base64Key, 'Image must be 1.5 MB or smaller');
      return null;
    }
    const bytes = base64ToBytes(data);
    if (!bytes) {
      this.fail(base64Key, 'Image data is not valid base64');
      return null;
    }
    if (bytes.length > MAX_IMAGE_BYTES) {
      this.fail(base64Key, 'Image must be 1.5 MB or smaller');
      return null;
    }
    if (typeof mime !== 'string' || !(IMAGE_MIMES as readonly string[]).includes(mime)) return null;
    if (!matchesMagic(bytes, mime as ImageMime)) {
      this.fail(base64Key, 'Image data does not match its type');
      return null;
    }
    return { bytes, mime: mime as ImageMime };
  }

  done(): void {
    if (Object.keys(this.fields).length > 0) throw validation(this.fields);
  }
}

function matchesMagic(b: Uint8Array, mime: ImageMime): boolean {
  switch (mime) {
    case 'image/jpeg':
      return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'image/png':
      return b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    case 'image/webp':
      return (
        b.length > 12 &&
        String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!) === 'RIFF' &&
        String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!) === 'WEBP'
      );
  }
}
