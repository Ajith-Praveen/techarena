import { Hono } from 'hono';
import { CRITERIA, MAX_PER_JUDGE } from '../criteria';
import type { AppEnv, Env } from '../env';
import { sessionInsertStmt } from '../lib/auth';
import { hashPassword, randomInt } from '../lib/crypto';
import type { Session, TeamRow } from '../lib/db';
import { nowIso, toMember, toTeam } from '../lib/db';
import { ApiError, conflict, isConstraintError, notFound, registrationClosed } from '../lib/errors';
import { getEventState, REGISTRATION_OPEN_SQL } from '../lib/settings';
import { readBody, Validator } from '../lib/validate';
import { COLOR_TAKEN, TEAM_COLORS } from '../teamColors';

export const maxTeamSize = (env: Env) => {
  const n = Number.parseInt(env.MAX_TEAM_SIZE ?? '', 10);
  return Number.isInteger(n) && n >= 1 ? n : 5;
};

export const countryCode = (env: Env) => env.DEFAULT_COUNTRY_CODE || '91';

const MAX_CODE_ATTEMPTS = 30;

const app = new Hono<AppEnv>();

app.get('/health', (c) => c.json({ ok: true }));

app.get('/config', async (c) => {
  const state = await getEventState(c.env.DB);
  return c.json({
    eventName: c.env.EVENT_NAME || 'Tech Arena',
    criteria: CRITERIA,
    maxPerJudge: MAX_PER_JUDGE,
    maxTeamSize: maxTeamSize(c.env),
    registrationOpen: state.registrationOpen,
    orderGenerated: state.orderGeneratedAt !== null,
    resultsPublished: state.resultsPublishedAt !== null,
    appUrl: c.env.APP_URL ?? '',
    apkUrl: c.env.APK_URL ?? '',
    githubUrl: c.env.GITHUB_URL ?? '',
  });
});

app.post('/teams/register', async (c) => {
  const db = c.env.DB;
  const body = await readBody(c);
  if (!(await getEventState(db)).registrationOpen) throw registrationClosed();

  const v = new Validator(body);
  const leadName = v.text('leadName', 'Name', 2, 60);
  const usn = v.usn('usn', true);
  const phone = v.phone('phone', countryCode(c.env));
  const email = v.email('email');
  const teamName = v.text('teamName', 'Team name', 2, 60);
  const projectTitle = v.text('projectTitle', 'Project title', 3, 80);
  const projectDesc = v.longText('projectDesc', 'Project description', 10, 1000);
  const password = v.password('password');
  const image = v.image('imageBase64', 'imageMime', 'Project image');
  const photo = v.image('photoBase64', 'photoMime', 'Profile photo');
  const poster = v.has('posterBase64') || v.has('posterMime') ? v.image('posterBase64', 'posterMime', 'Poster') : null;
  const color = v.teamColor('color', false);
  v.done();

  const nameKey = teamName.toLowerCase();
  const [phoneTaken, nameTaken, colorTaken] = await Promise.all([
    db.prepare('SELECT 1 FROM participants WHERE phone = ?').bind(phone).first(),
    db.prepare('SELECT 1 FROM teams WHERE name_key = ?').bind(nameKey).first(),
    color ? db.prepare('SELECT 1 FROM teams WHERE color = ?').bind(color).first() : Promise.resolve(null),
  ]);
  const dupFields: Record<string, string> = {};
  if (phoneTaken) dupFields.phone = 'This phone number is already registered';
  if (nameTaken) dupFields.teamName = 'This team name is already taken';
  if (colorTaken) dupFields.color = COLOR_TAKEN;
  if (Object.keys(dupFields).length) throw conflict('Already registered', dupFields);

  const passwordHash = await hashPassword(password);
  const now = nowIso();
  const teamId = crypto.randomUUID();
  const leadId = crypto.randomUUID();
  const imageId = crypto.randomUUID();
  const photoId = crypto.randomUUID();
  const posterId = poster ? crypto.randomUUID() : null;

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = String(randomInt(1000, 9999));
    if (await db.prepare('SELECT 1 FROM teams WHERE code = ?').bind(code).first()) continue;

    const { token, stmt: sessionStmt } = await sessionInsertStmt(db, 'lead', leadId);
    const teamExists = 'EXISTS (SELECT 1 FROM teams WHERE id = ?)';
    try {
      // The team insert is guarded by the registration flag; everything else only happens if it did.
      const [teamResult] = await db.batch([
        db
          .prepare(
            `INSERT INTO teams (id, name, name_key, code, project_title, project_desc, image_id, poster_id, color, password_hash, order_position, created_at)
             SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ? WHERE ${REGISTRATION_OPEN_SQL}`,
          )
          .bind(teamId, teamName, nameKey, code, projectTitle, projectDesc, imageId, posterId, color, passwordHash, now),
        db
          .prepare(`INSERT INTO images (id, mime, data, created_at) SELECT ?, ?, ?, ? WHERE ${teamExists}`)
          .bind(imageId, image!.mime, image!.bytes.buffer, now, teamId),
        db
          .prepare(`INSERT INTO images (id, mime, data, created_at) SELECT ?, ?, ?, ? WHERE ${teamExists}`)
          .bind(photoId, photo!.mime, photo!.bytes.buffer, now, teamId),
        ...(poster && posterId
          ? [
              db
                .prepare(`INSERT INTO images (id, mime, data, created_at) SELECT ?, ?, ?, ? WHERE ${teamExists}`)
                .bind(posterId, poster.mime, poster.bytes.buffer, now, teamId),
            ]
          : []),
        db
          .prepare(
            `INSERT INTO participants (id, team_id, role, name, usn, photo_id, phone, email, created_at)
             SELECT ?, ?, 'lead', ?, ?, ?, ?, ?, ? WHERE ${teamExists}`,
          )
          .bind(leadId, teamId, leadName, usn, photoId, phone, email, now, teamId),
        sessionStmt,
      ]);
      if (!teamResult || teamResult.meta.changes === 0) {
        await db.prepare('DELETE FROM sessions WHERE subject_id = ?').bind(leadId).run();
        throw registrationClosed();
      }
      const team = (await db.prepare('SELECT * FROM teams WHERE id = ?').bind(teamId).first<TeamRow>())!;
      const session: Session = {
        token,
        role: 'lead',
        member: toMember({
          id: leadId,
          team_id: teamId,
          role: 'lead',
          name: leadName,
          usn,
          photo_id: photoId,
          phone,
          email,
          created_at: now,
        }),
        team: toTeam(team),
        needsPhoto: false,
      };
      return c.json(session, 201);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (isConstraintError(err, 'teams.code')) continue;
      if (isConstraintError(err, 'teams.name_key')) {
        throw conflict('Already registered', { teamName: 'This team name is already taken' });
      }
      if (isConstraintError(err, 'teams.color')) throw conflict('Colour taken', { color: COLOR_TAKEN });
      if (isConstraintError(err, 'participants.phone')) {
        throw conflict('Already registered', { phone: 'This phone number is already registered' });
      }
      throw err;
    }
  }
  throw new ApiError(500, 'INTERNAL', 'Could not allocate a team code. Please try again.');
});

/** The team colour palette and which colours are already taken (registration shows these). */
app.get('/team-colors', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT color FROM teams WHERE color IS NOT NULL').all<{ color: string }>();
  const taken = new Set(results.map((r) => r.color));
  return c.json({ colors: TEAM_COLORS.map((col) => ({ ...col, taken: taken.has(col.hex) })) });
});

app.get('/images/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT mime, data FROM images WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ mime: string; data: ArrayBuffer | ArrayBufferView | number[] }>();
  if (!row) throw notFound('Image not found');
  const data = row.data;
  const bytes = Array.isArray(data)
    ? Uint8Array.from(data)
    : data instanceof ArrayBuffer
      ? new Uint8Array(data)
      : new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
  return c.body(bytes, 200, {
    'Content-Type': row.mime,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  });
});

export default app;
