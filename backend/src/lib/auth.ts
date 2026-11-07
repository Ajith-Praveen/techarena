import type { MiddlewareHandler } from 'hono';
import type { AppEnv, AuthInfo, Role } from '../env';
import { randomToken, sha256Hex } from './crypto';
import type { JudgeRow, ParticipantRow, TeamRow } from './db';
import { nowIso } from './db';
import { ApiError, forbidden, unauthorized } from './errors';

const DAY_MS = 24 * 60 * 60 * 1000;

export const SESSION_TTL_MS: Record<Role, number> = {
  lead: 30 * DAY_MS,
  member: 30 * DAY_MS,
  judge: 3 * DAY_MS,
  admin: 12 * 60 * 60 * 1000,
};

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/** Builds the session insert so it can join a batch; the raw token is returned to the client once. */
export async function sessionInsertStmt(
  db: D1Database,
  role: Role,
  subjectId: string,
): Promise<{ token: string; stmt: D1PreparedStatement }> {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const stmt = db
    .prepare('INSERT INTO sessions (token_hash, role, subject_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(tokenHash, role, subjectId, new Date(now.getTime() + SESSION_TTL_MS[role]).toISOString(), now.toISOString());
  return { token, stmt };
}

export async function createSession(db: D1Database, role: Role, subjectId: string): Promise<string> {
  const { token, stmt } = await sessionInsertStmt(db, role, subjectId);
  await stmt.run();
  return token;
}

/** Opportunistic housekeeping; failures are ignored. */
export async function cleanupExpired(db: D1Database): Promise<void> {
  const now = nowIso();
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  try {
    await db.batch([
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
      db.prepare('DELETE FROM login_attempts WHERE window_start <= ?').bind(windowStart),
    ]);
  } catch (err) {
    console.warn('cleanup failed', err);
  }
}

export async function assertNotRateLimited(db: D1Database, key: string): Promise<void> {
  const row = await db
    .prepare('SELECT count, window_start FROM login_attempts WHERE key = ?')
    .bind(key)
    .first<{ count: number; window_start: string }>();
  if (!row) return;
  const windowStart = Date.parse(row.window_start);
  if (Date.now() - windowStart < RATE_LIMIT_WINDOW_MS && row.count >= RATE_LIMIT_MAX) {
    const retryAfterSec = Math.max(1, Math.ceil((windowStart + RATE_LIMIT_WINDOW_MS - Date.now()) / 1000));
    throw new ApiError(429, 'RATE_LIMITED', 'Too many failed attempts. Try again in a few minutes.', undefined, {
      retryAfterSeconds: retryAfterSec,
    });
  }
}

export async function recordLoginFailure(db: D1Database, key: string): Promise<void> {
  const now = nowIso();
  const windowCutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  await db
    .prepare(
      `INSERT INTO login_attempts (key, count, window_start) VALUES (?1, 1, ?2)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN window_start <= ?3 THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN window_start <= ?3 THEN ?2 ELSE window_start END`,
    )
    .bind(key, now, windowCutoff)
    .run();
}

export async function clearLoginFailures(db: D1Database, key: string): Promise<void> {
  await db.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run();
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+([0-9a-f]{64})\s*$/i.exec(header);
  return match ? match[1]!.toLowerCase() : null;
}

export async function resolveSession(db: D1Database, token: string): Promise<AuthInfo | null> {
  const tokenHash = await sha256Hex(token);
  const session = await db
    .prepare('SELECT role, subject_id FROM sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(tokenHash, nowIso())
    .first<{ role: Role; subject_id: string }>();
  if (!session) return null;

  switch (session.role) {
    case 'admin':
      return { role: 'admin', tokenHash };
    case 'judge': {
      const judge = await db
        .prepare('SELECT * FROM judges WHERE id = ? AND active = 1')
        .bind(session.subject_id)
        .first<JudgeRow>();
      return judge ? { role: 'judge', tokenHash, judge } : null;
    }
    case 'lead':
    case 'member': {
      const participant = await db
        .prepare('SELECT * FROM participants WHERE id = ?')
        .bind(session.subject_id)
        .first<ParticipantRow>();
      if (!participant) return null;
      const team = await db.prepare('SELECT * FROM teams WHERE id = ?').bind(participant.team_id).first<TeamRow>();
      if (!team) return null;
      return { role: participant.role, tokenHash, participant, team };
    }
    default:
      return null;
  }
}

/** Requires a valid session whose role is one of `roles` (any role when empty). */
export function requireAuth(...roles: Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = bearerToken(c.req.header('Authorization'));
    if (!token) throw unauthorized('Missing or invalid authorization token');
    const auth = await resolveSession(c.env.DB, token);
    if (!auth) throw unauthorized('Your session has expired. Please log in again.');
    if (roles.length > 0 && !roles.includes(auth.role)) throw forbidden();
    c.set('auth', auth);
    await next();
  };
}

export function requireLead(auth: AuthInfo): { participant: ParticipantRow; team: TeamRow } {
  if (auth.role !== 'lead' || !auth.participant || !auth.team) throw forbidden('Only the team lead can do this');
  return { participant: auth.participant, team: auth.team };
}

export function requireParticipant(auth: AuthInfo): { participant: ParticipantRow; team: TeamRow } {
  if (!auth.participant || !auth.team) throw forbidden();
  return { participant: auth.participant, team: auth.team };
}

export function requireJudge(auth: AuthInfo): JudgeRow {
  if (auth.role !== 'judge' || !auth.judge) throw forbidden();
  return auth.judge;
}
