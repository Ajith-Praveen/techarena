import { Hono } from 'hono';
import type { AppEnv, AuthInfo } from '../env';
import {
  assertNotRateLimited,
  cleanupExpired,
  clearLoginFailures,
  createSession,
  recordLoginFailure,
  requireAuth,
} from '../lib/auth';
import { dummyVerify, sha256Hex, timingSafeEqualString, verifyPassword } from '../lib/crypto';
import type { JudgeRow, ParticipantRow, Session, TeamRow } from '../lib/db';
import { imageUrl, nowIso, toJudge, toMember, toTeam } from '../lib/db';
import { ApiError, forbidden, unauthorized } from '../lib/errors';
import { readBody, Validator } from '../lib/validate';
import { countryCode } from './public';

const app = new Hono<AppEnv>();

app.post('/auth/login', async (c) => {
  const db = c.env.DB;
  const v = new Validator(await readBody(c));
  const phone = v.phone('phone', countryCode(c.env));
  const password = v.secret('password');
  v.done();

  const key = `phone:${phone}`;
  await cleanupExpired(db);
  await assertNotRateLimited(db, key);

  const participant = await db
    .prepare('SELECT * FROM participants WHERE phone = ?')
    .bind(phone)
    .first<ParticipantRow>();
  const team = participant
    ? await db.prepare('SELECT * FROM teams WHERE id = ?').bind(participant.team_id).first<TeamRow>()
    : null;
  let ok = false;
  if (participant && team) ok = await verifyPassword(password, team.password_hash);
  else await dummyVerify(password);

  if (!ok || !participant || !team) {
    await recordLoginFailure(db, key);
    throw unauthorized('Invalid phone number or password');
  }
  await clearLoginFailures(db, key);
  const token = await createSession(db, participant.role, participant.id);
  const session: Session = {
    token,
    role: participant.role,
    member: toMember(participant),
    team: toTeam(team),
    needsPhoto: !participant.photo_id,
  };
  return c.json(session);
});

app.post('/auth/judge-login', async (c) => {
  const db = c.env.DB;
  const v = new Validator(await readBody(c));
  const username = v.secret('username', 'Username').trim().toLowerCase();
  const password = v.secret('password');
  v.done();

  const key = `judge:${username}`;
  await cleanupExpired(db);
  await assertNotRateLimited(db, key);

  const judge = await db.prepare('SELECT * FROM judges WHERE username = ?').bind(username).first<JudgeRow>();
  let ok = false;
  if (judge) ok = await verifyPassword(password, judge.password_hash);
  else await dummyVerify(password);

  if (!ok || !judge) {
    await recordLoginFailure(db, key);
    throw unauthorized('Invalid username or password');
  }
  await clearLoginFailures(db, key);
  if (judge.active !== 1) throw unauthorized('This judge account has been deactivated');
  const token = await createSession(db, 'judge', judge.id);
  const session: Session = { token, role: 'judge', judge: toJudge(judge), needsPhoto: !judge.photo_id };
  return c.json(session);
});

app.post('/auth/admin-login', async (c) => {
  const db = c.env.DB;
  const v = new Validator(await readBody(c));
  const username = v.secret('username', 'Username').trim().toLowerCase();
  const password = v.secret('password');
  v.done();

  const expected = c.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new ApiError(503, 'INTERNAL', 'Admin login is not configured. Set the ADMIN_PASSWORD secret on the Worker.');
  }
  const expectedUser = (c.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const key = `admin:${username}`;
  await cleanupExpired(db);
  await assertNotRateLimited(db, key);

  // Compare digests so the comparison length does not depend on the secrets; check both before deciding.
  const [userOk, passOk] = await Promise.all([
    sha256Hex(username).then(async (h) => timingSafeEqualString(h, await sha256Hex(expectedUser))),
    sha256Hex(password).then(async (h) => timingSafeEqualString(h, await sha256Hex(expected))),
  ]);
  if (!userOk || !passOk) {
    await recordLoginFailure(db, key);
    throw unauthorized('Invalid admin username or password');
  }
  await clearLoginFailures(db, key);
  const token = await createSession(db, 'admin', 'admin');
  const session: Session = { token, role: 'admin', needsPhoto: false };
  return c.json(session);
});

app.post('/auth/logout', requireAuth(), async (c) => {
  await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(c.get('auth').tokenHash).run();
  return c.json({ ok: true });
});

app.get('/me', requireAuth(), (c) => {
  const auth = c.get('auth');
  return c.json({
    role: auth.role,
    ...(auth.participant ? { member: toMember(auth.participant) } : {}),
    ...(auth.team ? { team: toTeam(auth.team) } : {}),
    ...(auth.judge ? { judge: toJudge(auth.judge) } : {}),
    needsPhoto: needsPhoto(auth),
  });
});

app.put('/me/photo', requireAuth(), async (c) => {
  const db = c.env.DB;
  const auth = c.get('auth');
  const target = auth.participant
    ? { table: 'participants', id: auth.participant.id, oldPhotoId: auth.participant.photo_id }
    : auth.judge
      ? { table: 'judges', id: auth.judge.id, oldPhotoId: auth.judge.photo_id }
      : null;
  if (!target) throw forbidden('Only participants and judges have a profile photo');

  const v = new Validator(await readBody(c));
  const image = v.image('imageBase64', 'imageMime', 'Photo');
  v.done();

  const photoId = crypto.randomUUID();
  const stmts = [
    db.prepare('INSERT INTO images (id, mime, data, created_at) VALUES (?, ?, ?, ?)').bind(photoId, image!.mime, image!.bytes.buffer, nowIso()),
    db.prepare(`UPDATE ${target.table} SET photo_id = ? WHERE id = ?`).bind(photoId, target.id),
  ];
  if (target.oldPhotoId) stmts.push(db.prepare('DELETE FROM images WHERE id = ?').bind(target.oldPhotoId));
  await db.batch(stmts);
  return c.json({ photoUrl: imageUrl(photoId), needsPhoto: false });
});

function needsPhoto(auth: AuthInfo): boolean {
  if (auth.participant) return !auth.participant.photo_id;
  if (auth.judge) return !auth.judge.photo_id;
  return false;
}

export default app;
