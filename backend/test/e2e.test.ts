import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { ADMIN_PASSWORD, JPEG_BASE64, JPEG_BYTES, PNG_BASE64, startServer, type TestServer } from './harness.ts';

const CRITERIA_KEYS = ['idea', 'working', 'uniqueness', 'impact', 'presentation'];
type Scores = Record<string, number>;
const scores = (idea: number, working: number, uniqueness: number, impact: number, presentation: number): Scores => ({
  idea,
  working,
  uniqueness,
  impact,
  presentation,
});

function teamPayload(overrides: Record<string, unknown> = {}) {
  return {
    leadName: 'Lead Person',
    usn: '1ab21cs001',
    phone: '9000000000',
    email: 'Lead@Example.com',
    teamName: 'Team',
    projectTitle: 'Smart Project',
    projectDesc: 'A project that is described in enough detail.',
    password: 'teampass1',
    imageBase64: PNG_BASE64,
    imageMime: 'image/png',
    photoBase64: JPEG_BASE64,
    photoMime: 'image/jpeg',
    ...overrides,
  };
}

function assertError(res: { status: number; body: any }, status: number, code: string) {
  assert.equal(res.status, status, `expected ${status} got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.equal(res.body?.error?.code, code, JSON.stringify(res.body));
  assert.equal(typeof res.body.error.message, 'string');
}

function assertPublicTeam(team: any) {
  assert.deepEqual(
    Object.keys(team).sort(),
    ['color', 'id', 'imageUrl', 'memberNames', 'members', 'name', 'orderPosition', 'posterUrl', 'projectDesc', 'projectTitle'].sort(),
  );
  assert.ok(Array.isArray(team.memberNames));
  assert.deepEqual(team.members.map((m: any) => m.name), team.memberNames);
  for (const m of team.members) assert.deepEqual(Object.keys(m).sort(), ['name', 'photoUrl', 'role']);
}

describe('Tech Arena API (main event flow)', () => {
  let s: TestServer;
  let adminToken = '';
  const teams: Record<string, { id: string; code: string; token: string; leadId: string; imageUrl: string }> = {};
  const judges: Record<string, { id: string; token: string }> = {};
  let alphaMembers: Array<{ id: string; phone: string }> = [];
  let alphaPassword = 'alphapass1';

  before(async () => {
    s = await startServer();
  });
  after(async () => {
    await s?.stop();
  });

  describe('public basics', () => {
    it('health and config', async () => {
      const health = await s.api('GET', '/api/health');
      assert.equal(health.status, 200);
      assert.deepEqual(health.body, { ok: true });

      const cfg = await s.api('GET', '/api/config');
      assert.equal(cfg.status, 200);
      assert.equal(cfg.body.eventName, 'Tech Arena');
      assert.deepEqual(cfg.body.criteria.map((c: any) => c.key), CRITERIA_KEYS);
      for (const c of cfg.body.criteria) {
        assert.equal(c.max, 10);
        assert.ok(c.label && c.description);
      }
      assert.equal(cfg.body.maxPerJudge, 50);
      assert.equal(cfg.body.maxTeamSize, 5);
      assert.equal(cfg.body.registrationOpen, true);
      assert.equal(cfg.body.orderGenerated, false);
      assert.equal(cfg.body.resultsPublished, false);
      assert.equal(cfg.body.appUrl, 'https://arena.example.com');
      assert.equal(cfg.body.apkUrl, 'https://arena.example.com/tech-arena.apk');
    });

    it('CORS preflight allows any origin, the methods and headers', async () => {
      const res = await fetch(`${s.baseUrl}/api/team/members`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://some-app.example',
          'Access-Control-Request-Method': 'PATCH',
          'Access-Control-Request-Headers': 'authorization, content-type',
        },
      });
      assert.ok(res.status === 204 || res.status === 200, `status ${res.status}`);
      assert.equal(res.headers.get('access-control-allow-origin'), '*');
      const methods = res.headers.get('access-control-allow-methods') ?? '';
      for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) assert.ok(methods.includes(m), methods);
      const headers = (res.headers.get('access-control-allow-headers') ?? '').toLowerCase();
      assert.ok(headers.includes('authorization') && headers.includes('content-type'), headers);

      for (const path of ['/api/health', '/api/me', '/api/nope']) {
        const res = await s.api('GET', path, { headers: { Origin: 'https://x.example' } });
        assert.equal(res.headers.get('access-control-allow-origin'), '*', `CORS header on ${path} (${res.status})`);
      }
    });

    it('unknown /api routes return 404 JSON, not the SPA', async () => {
      for (const path of ['/api/nope', '/api/teams', '/api/admin-nope/x']) {
        const res = await s.api('GET', path);
        assertError(res, 404, 'NOT_FOUND');
      }
      const spa = await fetch(`${s.baseUrl}/some/client/route`);
      assert.equal(spa.status, 200);
      assert.match(spa.headers.get('content-type') ?? '', /text\/html/);
    });

    it('invalid JSON body is a 400', async () => {
      const res = await s.api('POST', '/api/auth/login', { raw: '{nope', headers: { 'Content-Type': 'application/json' } });
      assertError(res, 400, 'BAD_REQUEST');
    });
  });

  describe('admin login', () => {
    it('rejects a wrong password and accepts the right one', async () => {
      assertError(await s.api('POST', '/api/auth/admin-login', { body: { username: 'admin', password: 'wrong' } }), 401, 'UNAUTHORIZED');
      assertError(await s.api('POST', '/api/auth/admin-login', { body: { username: 'root', password: ADMIN_PASSWORD } }), 401, 'UNAUTHORIZED');
      assertError(await s.api('POST', '/api/auth/admin-login', { body: { password: ADMIN_PASSWORD } }), 400, 'VALIDATION');
      const res = await s.api('POST', '/api/auth/admin-login', { body: { username: ' Admin ', password: ADMIN_PASSWORD } });
      assert.equal(res.status, 200);
      assert.equal(res.body.role, 'admin');
      assert.match(res.body.token, /^[0-9a-f]{64}$/);
      adminToken = res.body.token;
      const me = await s.api('GET', '/api/me', { token: adminToken });
      assert.equal(res.body.needsPhoto, false);
      assert.deepEqual(me.body, { role: 'admin', needsPhoto: false });
      assertError(
        await s.api('PUT', '/api/me/photo', { token: adminToken, body: { imageBase64: JPEG_BASE64, imageMime: 'image/jpeg' } }),
        403,
        'FORBIDDEN',
      );
    });

    it('publish and order generation need teams', async () => {
      assertError(await s.api('POST', '/api/results/publish', { token: adminToken, body: { force: true } }), 400, 'BAD_REQUEST');
      assertError(await s.api('POST', '/api/admin/order/generate', { token: adminToken, body: {} }), 400, 'BAD_REQUEST');
    });
  });

  describe('team registration', () => {
    it('registers a lead with a normalized phone and logs them in', async () => {
      const res = await s.api('POST', '/api/teams/register', {
        body: teamPayload({ leadName: '  Asha  Rao ', phone: '98765 43210', teamName: 'Alpha', password: alphaPassword }),
      });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(res.body.role, 'lead');
      assert.match(res.body.token, /^[0-9a-f]{64}$/);
      assert.equal(res.body.member.phone, '+919876543210');
      assert.equal(res.body.member.email, 'lead@example.com');
      assert.equal(res.body.member.usn, '1AB21CS001');
      assert.equal(res.body.member.name, 'Asha Rao');
      assert.equal(res.body.member.role, 'lead');
      assert.match(res.body.member.photoUrl, /^\/api\/images\/[0-9a-f-]{36}$/);
      assert.equal(res.body.needsPhoto, false);
      assert.equal(res.body.team.name, 'Alpha');
      assert.match(res.body.team.code, /^\d{4}$/);
      assert.ok(Number(res.body.team.code) >= 1000 && Number(res.body.team.code) <= 9999);
      assert.match(res.body.team.imageUrl, /^\/api\/images\/[0-9a-f-]{36}$/);
      assert.equal(res.body.team.orderPosition, null);
      assert.equal(typeof res.body.team.createdAt, 'string');
      teams.alpha = {
        id: res.body.team.id,
        code: res.body.team.code,
        token: res.body.token,
        leadId: res.body.member.id,
        imageUrl: res.body.team.imageUrl,
      };
    });

    it('normalizes other phone formats', async () => {
      const cases: Array<[string, string, string]> = [
        ['Beta', '09876543211', '+919876543211'],
        ['Gamma', '919876543212', '+919876543212'],
        ['Delta', '+1 (415) 555-0100', '+14155550100'],
      ];
      for (const [teamName, phone, expected] of cases) {
        const res = await s.api('POST', '/api/teams/register', {
          body: teamPayload({ teamName, phone, imageBase64: teamName === 'Beta' ? JPEG_BASE64 : PNG_BASE64, imageMime: teamName === 'Beta' ? 'image/jpeg' : 'image/png' }),
        });
        assert.equal(res.status, 201, JSON.stringify(res.body));
        assert.equal(res.body.member.phone, expected);
        teams[teamName.toLowerCase()] = {
          id: res.body.team.id,
          code: res.body.team.code,
          token: res.body.token,
          leadId: res.body.member.id,
          imageUrl: res.body.team.imageUrl,
        };
      }
      const codes = new Set(Object.values(teams).map((t) => t.code));
      assert.equal(codes.size, 4, 'team codes are unique');
    });

    it('rejects invalid phones and missing fields with VALIDATION fields', async () => {
      const bad = await s.api('POST', '/api/teams/register', { body: teamPayload({ teamName: 'Bad Phone', phone: '12345' }) });
      assertError(bad, 400, 'VALIDATION');
      assert.ok(bad.body.error.fields.phone);

      const plusTooShort = await s.api('POST', '/api/teams/register', { body: teamPayload({ teamName: 'Bad Phone', phone: '+1234567' }) });
      assertError(plusTooShort, 400, 'VALIDATION');

      const empty = await s.api('POST', '/api/teams/register', { body: {} });
      assertError(empty, 400, 'VALIDATION');
      for (const f of ['leadName', 'usn', 'phone', 'email', 'teamName', 'projectTitle', 'projectDesc', 'password', 'imageBase64', 'imageMime']) {
        assert.ok(empty.body.error.fields[f], `missing field error for ${f}`);
      }

      const lengths = await s.api('POST', '/api/teams/register', {
        body: teamPayload({ teamName: 'X', projectTitle: 'ab', projectDesc: 'short', password: '12345', email: 'nope', usn: 'ab' }),
      });
      assertError(lengths, 400, 'VALIDATION');
      for (const f of ['teamName', 'projectTitle', 'projectDesc', 'password', 'email', 'usn']) {
        assert.ok(lengths.body.error.fields[f], `expected field error for ${f}`);
      }
    });

    it('requires the lead profile photo', async () => {
      const res = await s.api('POST', '/api/teams/register', {
        body: teamPayload({ teamName: 'No Photo', phone: '9111111112', photoBase64: undefined, photoMime: undefined }),
      });
      assertError(res, 400, 'VALIDATION');
      assert.ok(res.body.error.fields.photoBase64);
    });

    it('rejects bad images', async () => {
      const cases: Array<[Record<string, unknown>, string]> = [
        [{ imageMime: 'image/gif' }, 'imageMime'],
        [{ imageBase64: 'not base64!!' }, 'imageBase64'],
        [{ imageBase64: `data:image/png;base64,${PNG_BASE64}` }, 'imageBase64'],
        [{ imageBase64: JPEG_BASE64, imageMime: 'image/png' }, 'imageBase64'],
        [{ imageBase64: '' }, 'imageBase64'],
      ];
      for (const [override, field] of cases) {
        const res = await s.api('POST', '/api/teams/register', { body: teamPayload({ teamName: 'Img Team', phone: '9111111111', ...override }) });
        assertError(res, 400, 'VALIDATION');
        assert.ok(res.body.error.fields[field], `${JSON.stringify(override).slice(0, 60)} -> ${JSON.stringify(res.body)}`);
      }
      const big = new Uint8Array(1.5 * 1024 * 1024 + 10);
      big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const tooLarge = await s.api('POST', '/api/teams/register', {
        body: teamPayload({ teamName: 'Img Team', phone: '9111111111', imageBase64: Buffer.from(big).toString('base64') }),
      });
      assertError(tooLarge, 400, 'VALIDATION');
      assert.match(tooLarge.body.error.fields.imageBase64, /1\.5 MB/);
    });

    it('rejects duplicate phone and team name with 409 CONFLICT fields', async () => {
      const dupPhone = await s.api('POST', '/api/teams/register', { body: teamPayload({ teamName: 'Fresh', phone: '+91 98765-43210' }) });
      assertError(dupPhone, 409, 'CONFLICT');
      assert.ok(dupPhone.body.error.fields.phone);
      assert.equal(dupPhone.body.error.fields.teamName, undefined);

      const dupName = await s.api('POST', '/api/teams/register', { body: teamPayload({ teamName: '  aLPHA ', phone: '9222222222' }) });
      assertError(dupName, 409, 'CONFLICT');
      assert.ok(dupName.body.error.fields.teamName);

      const both = await s.api('POST', '/api/teams/register', { body: teamPayload({ teamName: 'alpha', phone: '9876543210' }) });
      assertError(both, 409, 'CONFLICT');
      assert.ok(both.body.error.fields.teamName && both.body.error.fields.phone);
    });

    it('serves uploaded images with the right content type and caching', async () => {
      const png = await s.api('GET', teams.alpha!.imageUrl);
      assert.equal(png.status, 200);
      assert.equal(png.headers.get('content-type'), 'image/png');
      assert.equal(png.headers.get('cache-control'), 'public, max-age=31536000, immutable');
      assert.deepEqual(Buffer.from(png.body), Buffer.from(PNG_BASE64, 'base64'));

      const jpeg = await s.api('GET', teams.beta!.imageUrl);
      assert.equal(jpeg.status, 200);
      assert.equal(jpeg.headers.get('content-type'), 'image/jpeg');
      assert.deepEqual(Buffer.from(jpeg.body), Buffer.from(JPEG_BYTES));

      assertError(await s.api('GET', '/api/images/does-not-exist'), 404, 'NOT_FOUND');
    });
  });

  describe('participant login', () => {
    it('logs in the lead with any phone format', async () => {
      const res = await s.api('POST', '/api/auth/login', { body: { phone: '+91-98765-43210', password: alphaPassword } });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.role, 'lead');
      assert.equal(res.body.team.id, teams.alpha!.id);
      assert.equal(res.body.member.id, teams.alpha!.leadId);
    });

    it('returns the same 401 for wrong password and unknown phone', async () => {
      const wrong = await s.api('POST', '/api/auth/login', { body: { phone: '9876543210', password: 'nope-nope' } });
      const unknown = await s.api('POST', '/api/auth/login', { body: { phone: '9333333333', password: 'nope-nope' } });
      assertError(wrong, 401, 'UNAUTHORIZED');
      assertError(unknown, 401, 'UNAUTHORIZED');
      assert.equal(wrong.body.error.message, unknown.body.error.message);
    });

    it('rate limits after 10 failed attempts, even with the right password', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await s.api('POST', '/api/auth/login', { body: { phone: '+14155550100', password: `wrong-${i}` } });
        assertError(res, 401, 'UNAUTHORIZED');
      }
      const limited = await s.api('POST', '/api/auth/login', { body: { phone: '+1 415 555 0100', password: 'teampass1' } });
      assertError(limited, 429, 'RATE_LIMITED');
      // Other keys are unaffected.
      const other = await s.api('POST', '/api/auth/login', { body: { phone: '09876543211', password: 'teampass1' } });
      assert.equal(other.status, 200);
    });

    it('a successful login clears the failure counter', async () => {
      for (let i = 0; i < 9; i++) {
        await s.api('POST', '/api/auth/login', { body: { phone: '919876543212', password: 'bad-password' } });
      }
      assert.equal((await s.api('POST', '/api/auth/login', { body: { phone: '919876543212', password: 'teampass1' } })).status, 200);
      for (let i = 0; i < 9; i++) {
        assertError(await s.api('POST', '/api/auth/login', { body: { phone: '919876543212', password: 'bad-password' } }), 401, 'UNAUTHORIZED');
      }
      assert.equal((await s.api('POST', '/api/auth/login', { body: { phone: '919876543212', password: 'teampass1' } })).status, 200);
    });

    it('/api/me requires a valid token', async () => {
      assertError(await s.api('GET', '/api/me'), 401, 'UNAUTHORIZED');
      assertError(await s.api('GET', '/api/me', { token: 'a'.repeat(64) }), 401, 'UNAUTHORIZED');
      const me = await s.api('GET', '/api/me', { token: teams.alpha!.token });
      assert.equal(me.status, 200);
      assert.equal(me.body.role, 'lead');
      assert.equal(me.body.member.id, teams.alpha!.leadId);
      assert.equal(me.body.team.code, teams.alpha!.code);
    });

    it('rejects expired sessions', async () => {
      const token = 'e'.repeat(64);
      const hash = createHash('sha256').update(token).digest('hex');
      await s.sql(
        `INSERT INTO sessions (token_hash, role, subject_id, expires_at, created_at) VALUES ('${hash}', 'lead', '${teams.alpha!.leadId}', '2020-01-01T00:00:00.000Z', '2019-12-01T00:00:00.000Z')`,
      );
      assertError(await s.api('GET', '/api/me', { token }), 401, 'UNAUTHORIZED');
    });
  });

  describe('team management', () => {
    it('GET /api/team returns team and members (lead first)', async () => {
      const res = await s.api('GET', '/api/team', { token: teams.alpha!.token });
      assert.equal(res.status, 200);
      assert.equal(res.body.team.id, teams.alpha!.id);
      assert.equal(res.body.team.code, teams.alpha!.code);
      assert.equal(res.body.members.length, 1);
      assert.equal(res.body.members[0].role, 'lead');
    });

    it('lead adds members up to the size limit', async () => {
      const invalid = await s.api('POST', '/api/team/members', { token: teams.alpha!.token, body: { name: 'A', phone: '1', email: 'x' } });
      assertError(invalid, 400, 'VALIDATION');
      assert.ok(invalid.body.error.fields.name && invalid.body.error.fields.phone && invalid.body.error.fields.email);

      const phones = ['9800000001', '9800000002', '9800000003', '9800000004'];
      for (const [i, phone] of phones.entries()) {
        const res = await s.api('POST', '/api/team/members', {
          token: teams.alpha!.token,
          body: { name: `Member ${i + 1}`, phone, email: `m${i + 1}@Example.com`, ...(i === 0 ? { usn: '1ab21cs010' } : {}) },
        });
        assert.equal(res.status, 201, JSON.stringify(res.body));
        assert.equal(res.body.member.role, 'member');
        assert.equal(res.body.member.phone, `+91${phone}`);
        assert.equal(res.body.member.email, `m${i + 1}@example.com`);
        assert.equal(res.body.member.usn, i === 0 ? '1AB21CS010' : null);
        alphaMembers.push({ id: res.body.member.id, phone: res.body.member.phone });
      }
      const full = await s.api('POST', '/api/team/members', {
        token: teams.alpha!.token,
        body: { name: 'Member 5', phone: '9800000005', email: 'm5@example.com' },
      });
      assertError(full, 409, 'CONFLICT');

      const team = await s.api('GET', '/api/team', { token: teams.alpha!.token });
      assert.equal(team.body.members.length, 5);
      assert.equal(team.body.members[0].role, 'lead');
    });

    it('rejects a phone already used by any participant', async () => {
      const res = await s.api('POST', '/api/team/members', {
        token: teams.beta!.token,
        body: { name: 'Dup Phone', phone: '9800000001', email: 'dup@example.com' },
      });
      assertError(res, 409, 'CONFLICT');
      assert.ok(res.body.error.fields.phone);
    });

    it('members log in with their own phone + team password and are read-only', async () => {
      const login = await s.api('POST', '/api/auth/login', { body: { phone: alphaMembers[0]!.phone, password: alphaPassword } });
      assert.equal(login.status, 200, JSON.stringify(login.body));
      assert.equal(login.body.role, 'member');
      assert.equal(login.body.team.id, teams.alpha!.id);
      const memberToken = login.body.token;
      assert.equal(login.body.needsPhoto, true);
      assert.equal(login.body.member.photoUrl, null);

      const badPhoto = await s.api('PUT', '/api/me/photo', { token: memberToken, body: { imageBase64: 'nope', imageMime: 'image/jpeg' } });
      assertError(badPhoto, 400, 'VALIDATION');
      const photo = await s.api('PUT', '/api/me/photo', { token: memberToken, body: { imageBase64: JPEG_BASE64, imageMime: 'image/jpeg' } });
      assert.equal(photo.status, 200, JSON.stringify(photo.body));
      assert.equal(photo.body.needsPhoto, false);
      assert.match(photo.body.photoUrl, /^\/api\/images\//);
      const me = await s.api('GET', '/api/me', { token: memberToken });
      assert.equal(me.body.needsPhoto, false);
      assert.equal(me.body.member.photoUrl, photo.body.photoUrl);
      const replaced = await s.api('PUT', '/api/me/photo', { token: memberToken, body: { imageBase64: PNG_BASE64, imageMime: 'image/png' } });
      assert.notEqual(replaced.body.photoUrl, photo.body.photoUrl);
      assertError(await s.api('GET', photo.body.photoUrl), 404, 'NOT_FOUND');
      const img = await s.api('GET', replaced.body.photoUrl);
      assert.equal(img.headers.get('content-type'), 'image/png');

      assert.equal((await s.api('GET', '/api/team', { token: memberToken })).status, 200);
      assert.equal((await s.api('GET', '/api/team/report', { token: memberToken })).status, 200);
      assertError(await s.api('POST', '/api/team/members', { token: memberToken, body: { name: 'Nope', phone: '9800000009', email: 'n@example.com' } }), 403, 'FORBIDDEN');
      assertError(await s.api('DELETE', `/api/team/members/${alphaMembers[1]!.id}`, { token: memberToken }), 403, 'FORBIDDEN');
      assertError(await s.api('PUT', '/api/team', { token: memberToken, body: { projectTitle: 'Hijack' } }), 403, 'FORBIDDEN');
      assertError(await s.api('POST', '/api/team/notify', { token: memberToken, body: { password: alphaPassword } }), 403, 'FORBIDDEN');
      assertError(await s.api('POST', '/api/team/password', { token: memberToken, body: { currentPassword: alphaPassword, newPassword: 'whatever1' } }), 403, 'FORBIDDEN');
    });

    it('lead removes a member (sessions dropped) but never the lead', async () => {
      const victim = alphaMembers.pop()!;
      const login = await s.api('POST', '/api/auth/login', { body: { phone: victim.phone, password: alphaPassword } });
      assert.equal(login.status, 200);

      assertError(await s.api('DELETE', `/api/team/members/${teams.alpha!.leadId}`, { token: teams.alpha!.token }), 400, 'BAD_REQUEST');
      assertError(await s.api('DELETE', `/api/team/members/${teams.beta!.leadId}`, { token: teams.alpha!.token }), 404, 'NOT_FOUND');
      assertError(await s.api('DELETE', '/api/team/members/nope', { token: teams.alpha!.token }), 404, 'NOT_FOUND');

      const del = await s.api('DELETE', `/api/team/members/${victim.id}`, { token: teams.alpha!.token });
      assert.equal(del.status, 200);
      assert.deepEqual(del.body, { ok: true });
      assertError(await s.api('GET', '/api/me', { token: login.body.token }), 401, 'UNAUTHORIZED');
      assertError(await s.api('POST', '/api/auth/login', { body: { phone: victim.phone, password: alphaPassword } }), 401, 'UNAUTHORIZED');
      assert.equal((await s.api('GET', '/api/team', { token: teams.alpha!.token })).body.members.length, 4);
    });

    it('lead edits the project and replaces the image', async () => {
      const bad = await s.api('PUT', '/api/team', { token: teams.alpha!.token, body: { projectTitle: 'no' } });
      assertError(bad, 400, 'VALIDATION');
      const res = await s.api('PUT', '/api/team', {
        token: teams.alpha!.token,
        body: { projectTitle: 'Alpha Rover', projectDesc: 'An autonomous rover\nwith two lines.', imageBase64: JPEG_BASE64, imageMime: 'image/jpeg' },
      });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.team.projectTitle, 'Alpha Rover');
      assert.equal(res.body.team.projectDesc, 'An autonomous rover\nwith two lines.');
      assert.notEqual(res.body.team.imageUrl, teams.alpha!.imageUrl);
      assertError(await s.api('GET', teams.alpha!.imageUrl), 404, 'NOT_FOUND');
      const img = await s.api('GET', res.body.team.imageUrl);
      assert.equal(img.headers.get('content-type'), 'image/jpeg');
      teams.alpha!.imageUrl = res.body.team.imageUrl;
    });

    it('lead changes the team password', async () => {
      const wrong = await s.api('POST', '/api/team/password', { token: teams.alpha!.token, body: { currentPassword: 'nope-nope', newPassword: 'newalpha1' } });
      assertError(wrong, 400, 'VALIDATION');
      const short = await s.api('POST', '/api/team/password', { token: teams.alpha!.token, body: { currentPassword: alphaPassword, newPassword: '123' } });
      assertError(short, 400, 'VALIDATION');
      const ok = await s.api('POST', '/api/team/password', { token: teams.alpha!.token, body: { currentPassword: alphaPassword, newPassword: 'newalpha1' } });
      assert.equal(ok.status, 200);
      assertError(await s.api('POST', '/api/auth/login', { body: { phone: '9876543210', password: alphaPassword } }), 401, 'UNAUTHORIZED');
      alphaPassword = 'newalpha1';
      assert.equal((await s.api('POST', '/api/auth/login', { body: { phone: '9876543210', password: alphaPassword } })).status, 200);
    });

    it('notify verifies the team password and reports not_configured without an email key', async () => {
      assertError(await s.api('POST', '/api/team/notify', { token: teams.alpha!.token, body: { password: 'wrong-pass' } }), 401, 'UNAUTHORIZED');

      const all = await s.api('POST', '/api/team/notify', { token: teams.alpha!.token, body: { password: alphaPassword } });
      assert.equal(all.status, 200, JSON.stringify(all.body));
      assert.equal(all.body.results.length, 3);
      for (const r of all.body.results) {
        assert.equal(r.status, 'not_configured');
        assert.ok(r.memberId && r.name && r.email);
        assert.notEqual(r.memberId, teams.alpha!.leadId);
      }

      const one = await s.api('POST', '/api/team/notify', {
        token: teams.alpha!.token,
        body: { password: alphaPassword, memberIds: [alphaMembers[0]!.id] },
      });
      assert.equal(one.status, 200);
      assert.deepEqual(one.body.results.map((r: any) => r.memberId), [alphaMembers[0]!.id]);

      const foreign = await s.api('POST', '/api/team/notify', {
        token: teams.alpha!.token,
        body: { password: alphaPassword, memberIds: [teams.beta!.leadId] },
      });
      assertError(foreign, 400, 'VALIDATION');
    });
  });

  describe('judges (admin)', () => {
    it('admin creates judges with validation', async () => {
      for (const [name, username] of [['Dr. One', 'Judge.One'], ['Dr. Two', 'judge-two']] as const) {
        const res = await s.api('POST', '/api/admin/judges', { token: adminToken, body: { name, username, password: 'judgepass' } });
        assert.equal(res.status, 201, JSON.stringify(res.body));
        assert.equal(res.body.judge.username, username.toLowerCase());
        assert.equal(res.body.judge.active, true);
        assert.equal(res.body.judge.password_hash, undefined);
      }
      const dup = await s.api('POST', '/api/admin/judges', { token: adminToken, body: { name: 'Dup', username: 'JUDGE.ONE', password: 'judgepass' } });
      assertError(dup, 409, 'CONFLICT');
      assert.ok(dup.body.error.fields.username);
      const invalid = await s.api('POST', '/api/admin/judges', { token: adminToken, body: { name: 'X', username: 'a b', password: '123' } });
      assertError(invalid, 400, 'VALIDATION');
      assert.ok(invalid.body.error.fields.username && invalid.body.error.fields.password && invalid.body.error.fields.name);
    });

    it('judges log in; bad password is 401', async () => {
      assertError(await s.api('POST', '/api/auth/judge-login', { body: { username: 'judge.one', password: 'wrong-pass' } }), 401, 'UNAUTHORIZED');
      assertError(await s.api('POST', '/api/auth/judge-login', { body: { username: 'ghost', password: 'judgepass' } }), 401, 'UNAUTHORIZED');
      for (const [key, username] of [['one', ' Judge.One '], ['two', 'judge-two']] as const) {
        const res = await s.api('POST', '/api/auth/judge-login', { body: { username, password: 'judgepass' } });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.role, 'judge');
        assert.equal(res.body.needsPhoto, true);
        assert.equal(res.body.judge.photoUrl, null);
        judges[key] = { id: res.body.judge.id, token: res.body.token };
      }
      const photo = await s.api('PUT', '/api/me/photo', { token: judges.one!.token, body: { imageBase64: JPEG_BASE64, imageMime: 'image/jpeg' } });
      assert.equal(photo.status, 200, JSON.stringify(photo.body));
      const me = await s.api('GET', '/api/me', { token: judges.one!.token });
      assert.equal(me.body.needsPhoto, false);
      assert.equal(me.body.judge.photoUrl, photo.body.photoUrl);
    });

    it('deactivated judges lose their sessions and cannot log in', async () => {
      const created = await s.api('POST', '/api/admin/judges', { token: adminToken, body: { name: 'Temp Judge', username: 'temp', password: 'judgepass' } });
      assert.equal(created.status, 201);
      const login = await s.api('POST', '/api/auth/judge-login', { body: { username: 'temp', password: 'judgepass' } });
      assert.equal(login.status, 200);
      assert.equal((await s.api('GET', '/api/judge/progress', { token: login.body.token })).status, 200);

      const patched = await s.api('PATCH', `/api/admin/judges/${created.body.judge.id}`, { token: adminToken, body: { active: false, name: 'Temp Judge (off)' } });
      assert.equal(patched.status, 200);
      assert.equal(patched.body.judge.active, false);
      assert.equal(patched.body.judge.name, 'Temp Judge (off)');

      assertError(await s.api('GET', '/api/judge/progress', { token: login.body.token }), 401, 'UNAUTHORIZED');
      assertError(await s.api('POST', '/api/auth/judge-login', { body: { username: 'temp', password: 'judgepass' } }), 401, 'UNAUTHORIZED');
      assertError(await s.api('PATCH', '/api/admin/judges/nope', { token: adminToken, body: { active: false } }), 404, 'NOT_FOUND');

      const list = await s.api('GET', '/api/admin/judges', { token: adminToken });
      assert.equal(list.status, 200);
      assert.equal(list.body.judges.length, 3);
      assert.deepEqual(list.body.judges.map((j: any) => j.active), [true, true, false]);
      assert.ok(list.body.judges.every((j: any) => j.evaluatedCount === 0));
    });

    it('role guards: wrong roles get 403, anonymous gets 401', async () => {
      assertError(await s.api('GET', '/api/admin/overview', { token: judges.one!.token }), 403, 'FORBIDDEN');
      assertError(await s.api('GET', '/api/admin/overview', { token: teams.alpha!.token }), 403, 'FORBIDDEN');
      assertError(await s.api('GET', '/api/judge/progress', { token: teams.alpha!.token }), 403, 'FORBIDDEN');
      assertError(await s.api('GET', '/api/team', { token: adminToken }), 403, 'FORBIDDEN');
      assertError(await s.api('GET', '/api/team', { token: judges.one!.token }), 403, 'FORBIDDEN');
      assertError(await s.api('POST', '/api/results/publish', { token: teams.alpha!.token, body: {} }), 403, 'FORBIDDEN');
      assertError(await s.api('GET', '/api/admin/teams'), 401, 'UNAUTHORIZED');
      assertError(await s.api('GET', '/api/order'), 401, 'UNAUTHORIZED');
      assertError(await s.api('GET', '/api/results'), 401, 'UNAUTHORIZED');
    });
  });

  describe('before evaluation', () => {
    it('team report is empty', async () => {
      const res = await s.api('GET', '/api/team/report', { token: teams.alpha!.token });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.criteria.map((c: any) => c.key), CRITERIA_KEYS);
      assert.equal(res.body.maxPerJudge, 50);
      assert.equal(res.body.activeJudgeCount, 2);
      assert.deepEqual(res.body.evaluations, []);
      assert.equal(res.body.average, null);
      assert.equal(res.body.resultsPublished, false);
      assert.equal(res.body.rank, null);
    });

    it('results and order are not available yet', async () => {
      assert.deepEqual((await s.api('GET', '/api/results', { token: teams.alpha!.token })).body, { published: false });
      assert.deepEqual((await s.api('GET', '/api/order', { token: teams.alpha!.token })).body, { generated: false, generatedAt: null, teams: [] });
    });
  });

  describe('presentation order', () => {
    const positions = async () => {
      const res = await s.api('GET', '/api/admin/teams', { token: adminToken });
      assert.equal(res.status, 200);
      return res.body.teams.map((t: any) => t.orderPosition) as Array<number | null>;
    };

    it('generates a random permutation and closes registration', async () => {
      const res = await s.api('POST', '/api/admin/order/generate', { token: adminToken, body: {} });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(typeof res.body.generatedAt, 'string');
      assert.equal(res.body.teams.length, 4);
      res.body.teams.forEach(assertPublicTeam);
      assert.deepEqual(res.body.teams.map((t: any) => t.orderPosition), [1, 2, 3, 4]);
      assert.deepEqual((await positions()).slice().sort(), [1, 2, 3, 4]);

      const cfg = await s.api('GET', '/api/config');
      assert.equal(cfg.body.registrationOpen, false);
      assert.equal(cfg.body.orderGenerated, true);

      const order = await s.api('GET', '/api/order', { token: judges.one!.token });
      assert.equal(order.body.generated, true);
      assert.equal(order.body.generatedAt, res.body.generatedAt);
      assert.deepEqual(order.body.teams.map((t: any) => t.orderPosition), [1, 2, 3, 4]);
      for (const t of order.body.teams) {
        assert.equal(t.evaluationCount, 0);
        assert.equal(t.code, undefined);
        const { evaluationCount, ...rest } = t;
        assertPublicTeam(rest);
      }
      assert.deepEqual(order.body.teams.find((t: any) => t.id === teams.alpha!.id).memberNames, ['Asha Rao', 'Member 1', 'Member 2', 'Member 3']);
    });

    it('closed registration blocks register / add member / edit', async () => {
      assertError(await s.api('POST', '/api/teams/register', { body: teamPayload({ teamName: 'Late', phone: '9444444444' }) }), 403, 'REGISTRATION_CLOSED');
      assertError(await s.api('POST', '/api/team/members', { token: teams.beta!.token, body: { name: 'Late Member', phone: '9444444445', email: 'l@example.com' } }), 403, 'REGISTRATION_CLOSED');
      assertError(await s.api('PUT', '/api/team', { token: teams.beta!.token, body: { projectTitle: 'Late edit' } }), 403, 'REGISTRATION_CLOSED');
      assertError(await s.api('DELETE', `/api/team/members/${alphaMembers[0]!.id}`, { token: teams.alpha!.token }), 403, 'REGISTRATION_CLOSED');
    });

    it('regeneration needs force', async () => {
      assertError(await s.api('POST', '/api/admin/order/generate', { token: adminToken, body: {} }), 409, 'CONFLICT');
      const forced = await s.api('POST', '/api/admin/order/generate', { token: adminToken, body: { force: true } });
      assert.equal(forced.status, 200);
      assert.deepEqual((await positions()).slice().sort(), [1, 2, 3, 4]);
    });

    it('reopening registration clears the order', async () => {
      const res = await s.api('POST', '/api/admin/registration', { token: adminToken, body: { open: true } });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { registrationOpen: true });
      assert.deepEqual(await positions(), [null, null, null, null]);
      assert.deepEqual((await s.api('GET', '/api/order', { token: adminToken })).body, { generated: false, generatedAt: null, teams: [] });
      const cfg = await s.api('GET', '/api/config');
      assert.equal(cfg.body.registrationOpen, true);
      assert.equal(cfg.body.orderGenerated, false);
      assertError(await s.api('POST', '/api/admin/registration', { token: adminToken, body: {} }), 400, 'BAD_REQUEST');
    });

    it('a judge can draw the order once; later draws and non-judges are refused', async () => {
      assertError(await s.api('POST', '/api/judge/order/generate', { token: teams.alpha!.token, body: {} }), 403, 'FORBIDDEN');
      const draw = await s.api('POST', '/api/judge/order/generate', { token: judges.one!.token, body: {} });
      assert.equal(draw.status, 200, JSON.stringify(draw.body));
      assert.equal(typeof draw.body.generatedAt, 'string');
      assert.deepEqual(draw.body.teams.map((t: any) => t.orderPosition), [1, 2, 3, 4]);
      assert.deepEqual((await positions()).slice().sort(), [1, 2, 3, 4]);
      const cfg = await s.api('GET', '/api/config');
      assert.equal(cfg.body.orderGenerated, true);
      assert.equal(cfg.body.registrationOpen, false);
      assertError(await s.api('POST', '/api/judge/order/generate', { token: judges.two!.token, body: {} }), 409, 'CONFLICT');
      assertError(await s.api('POST', '/api/judge/order/generate', { token: judges.one!.token, body: {} }), 409, 'CONFLICT');
      // Back to an open, undrawn state for the tests below.
      assert.equal((await s.api('POST', '/api/admin/registration', { token: adminToken, body: { open: true } })).status, 200);
    });

    it('admin deletes a team (participants, sessions, image) and keeps positions contiguous', async () => {
      const reg = await s.api('POST', '/api/teams/register', { body: teamPayload({ teamName: 'Epsilon', phone: '9555555555' }) });
      assert.equal(reg.status, 201);
      const gen = await s.api('POST', '/api/admin/order/generate', { token: adminToken, body: {} });
      assert.equal(gen.status, 200);
      assert.equal(gen.body.teams.length, 5);

      assertError(await s.api('DELETE', '/api/admin/teams/nope', { token: adminToken }), 404, 'NOT_FOUND');
      const del = await s.api('DELETE', `/api/admin/teams/${reg.body.team.id}`, { token: adminToken });
      assert.equal(del.status, 200);
      assert.deepEqual(del.body, { ok: true });
      assertError(await s.api('GET', '/api/me', { token: reg.body.token }), 401, 'UNAUTHORIZED');
      assertError(await s.api('GET', reg.body.team.imageUrl), 404, 'NOT_FOUND');
      assertError(await s.api('GET', reg.body.member.photoUrl), 404, 'NOT_FOUND');
      assertError(await s.api('POST', '/api/auth/login', { body: { phone: '9555555555', password: 'teampass1' } }), 401, 'UNAUTHORIZED');
      assert.deepEqual((await positions()).slice().sort(), [1, 2, 3, 4]);
      const order = await s.api('GET', '/api/order', { token: adminToken });
      assert.deepEqual(order.body.teams.map((t: any) => t.orderPosition), [1, 2, 3, 4]);
    });

    it('admin rearranges the order manually', async () => {
      const current = (await s.api('GET', '/api/order', { token: adminToken })).body.teams.map((t: any) => t.id) as string[];
      const put = (teamIds: unknown) => s.api('PUT', '/api/admin/order', { token: adminToken, body: { teamIds } });
      assertError(await put(current.slice(1)), 400, 'VALIDATION');
      assertError(await put([current[0], ...current.slice(0, 3)]), 400, 'VALIDATION');
      assertError(await put([...current.slice(1), 'nope']), 400, 'VALIDATION');
      assertError(await put('x'), 400, 'VALIDATION');
      assertError(await s.api('PUT', '/api/admin/order', { token: teams.alpha!.token, body: { teamIds: current } }), 403, 'FORBIDDEN');

      const moved = [...current.slice(1), current[0]!];
      const res = await put(moved);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(typeof res.body.generatedAt, 'string');
      assert.deepEqual(res.body.teams.map((t: any) => t.id), moved);
      assert.deepEqual(res.body.teams.map((t: any) => t.orderPosition), [1, 2, 3, 4]);
      res.body.teams.forEach(assertPublicTeam);
      const order = await s.api('GET', '/api/order', { token: judges.one!.token });
      assert.deepEqual(order.body.teams.map((t: any) => t.id), moved);
      assert.equal(order.body.generatedAt, res.body.generatedAt);
    });
  });

  describe('judging', () => {
    const evaluate = (judge: string, teamKey: string, sc: unknown, extra: Record<string, unknown> = {}) =>
      s.api('POST', '/api/judge/evaluations', {
        token: judges[judge]!.token,
        body: { teamId: teams[teamKey]!.id, code: teams[teamKey]!.code, scores: sc, ...extra },
      });

    it('looks up a team by code without leaking code or contacts', async () => {
      assertError(await s.api('GET', '/api/judge/teams/by-code/12ab', { token: judges.one!.token }), 404, 'NOT_FOUND');
      const used = new Set(Object.values(teams).map((t) => t.code));
      let unused = 1000;
      while (used.has(String(unused))) unused++;
      assertError(await s.api('GET', `/api/judge/teams/by-code/${unused}`, { token: judges.one!.token }), 404, 'NOT_FOUND');

      const res = await s.api('GET', `/api/judge/teams/by-code/${teams.alpha!.code}`, { token: judges.one!.token });
      assert.equal(res.status, 200);
      assertPublicTeam(res.body.team);
      assert.equal(res.body.team.id, teams.alpha!.id);
      assert.deepEqual(res.body.team.memberNames, ['Asha Rao', 'Member 1', 'Member 2', 'Member 3']);
      assert.equal(res.body.myEvaluation, null);
      const text = JSON.stringify(res.body);
      assert.ok(!text.includes('+91') && !text.includes('@example.com'), 'no contact info');
    });

    it('validates scores strictly', async () => {
      const good = scores(5, 5, 5, 5, 5);
      const { presentation, ...missing } = good;
      const cases: Array<[unknown, string]> = [
        [missing, 'scores.presentation'],
        [{ ...good, bonus: 3 }, 'scores'],
        [{ ...good, idea: 11 }, 'scores.idea'],
        [{ ...good, working: -1 }, 'scores.working'],
        [{ ...good, impact: 7.5 }, 'scores.impact'],
        [{ ...good, uniqueness: '7' }, 'scores.uniqueness'],
        [[5, 5, 5, 5, 5], 'scores'],
      ];
      for (const [sc, field] of cases) {
        const res = await evaluate('one', 'alpha', sc);
        assertError(res, 400, 'VALIDATION');
        assert.ok(res.body.error.fields[field], `${JSON.stringify(sc)} -> ${JSON.stringify(res.body)}`);
      }
      const wrongCode = await s.api('POST', '/api/judge/evaluations', {
        token: judges.one!.token,
        body: { teamId: teams.alpha!.id, code: teams.beta!.code, scores: good },
      });
      assertError(wrongCode, 400, 'VALIDATION');
      assert.ok(wrongCode.body.error.fields.code);
      const unknownTeam = await s.api('POST', '/api/judge/evaluations', {
        token: judges.one!.token,
        body: { teamId: 'nope', code: '1234', scores: good },
      });
      assertError(unknownTeam, 404, 'NOT_FOUND');
      const longRemarks = await evaluate('one', 'alpha', good, { remarks: 'x'.repeat(501) });
      assertError(longRemarks, 400, 'VALIDATION');
      assert.ok(longRemarks.body.error.fields.remarks);
    });

    it('accepts one final evaluation per judge per team', async () => {
      const res = await evaluate('one', 'alpha', scores(9, 9, 9, 9, 9), { remarks: '  Great demo\nwell done  ' });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      const e = res.body.evaluation;
      assert.equal(e.teamId, teams.alpha!.id);
      assert.equal(e.judgeId, judges.one!.id);
      assert.equal(e.judgeName, 'Dr. One');
      assert.equal(e.judgeLabel, 'Judge 1');
      assert.deepEqual(e.scores, scores(9, 9, 9, 9, 9));
      assert.equal(e.total, 45);
      assert.equal(e.remarks, 'Great demo\nwell done');

      assertError(await evaluate('one', 'alpha', scores(1, 1, 1, 1, 1)), 409, 'ALREADY_EVALUATED');
      // Concurrent double-submit: the unique constraint lets exactly one through.
      const concurrent = await Promise.all([1, 2, 3].map(() => evaluate('two', 'alpha', scores(9, 9, 9, 9, 9))));
      assert.deepEqual(concurrent.map((r) => r.status).sort(), [201, 409, 409]);
      const losers = concurrent.filter((r) => r.status === 409);
      losers.forEach((r) => assert.equal(r.body.error.code, 'ALREADY_EVALUATED'));
      assert.equal(concurrent.find((r) => r.status === 201)!.body.evaluation.judgeLabel, 'Judge 2');
    });

    it('has no edit or delete route for evaluations', async () => {
      const mine = await s.api('GET', '/api/judge/evaluations', { token: judges.one!.token });
      const id = mine.body.evaluations[0].id;
      for (const method of ['PUT', 'PATCH', 'DELETE']) {
        assertError(await s.api(method, `/api/judge/evaluations/${id}`, { token: judges.one!.token, body: { scores: scores(1, 1, 1, 1, 1) } }), 404, 'NOT_FOUND');
        assertError(await s.api(method, '/api/judge/evaluations', { token: judges.one!.token, body: { scores: scores(1, 1, 1, 1, 1) } }), 404, 'NOT_FOUND');
      }
      const again = await s.api('GET', `/api/judge/teams/by-code/${teams.alpha!.code}`, { token: judges.one!.token });
      assert.equal(again.body.myEvaluation.total, 45);
    });

    it('team report hides marks until results are published, but shows how many judges scored', async () => {
      const res = await s.api('GET', '/api/team/report', { token: teams.alpha!.token });
      assert.equal(res.status, 200);
      assert.equal(res.body.scoredCount, 2);
      assert.deepEqual(res.body.evaluations, []);
      assert.equal(res.body.average, null);
      assert.equal(res.body.rank, null);
      assert.equal(res.body.resultsPublished, false);
    });

    it('locks registration, order and team deletion once judging started', async () => {
      assertError(await s.api('POST', '/api/admin/registration', { token: adminToken, body: { open: true } }), 409, 'CONFLICT');
      assertError(await s.api('POST', '/api/admin/order/generate', { token: adminToken, body: { force: true } }), 409, 'CONFLICT');
      assertError(await s.api('DELETE', `/api/admin/teams/${teams.alpha!.id}`, { token: adminToken }), 409, 'CONFLICT');
      // Manual rearrangement stays allowed: order never affects scores.
      const ids = (await s.api('GET', '/api/order', { token: adminToken })).body.teams.map((t: any) => t.id) as string[];
      const reversed = await s.api('PUT', '/api/admin/order', { token: adminToken, body: { teamIds: ids.slice().reverse() } });
      assert.equal(reversed.status, 200, JSON.stringify(reversed.body));
      const closed = await s.api('POST', '/api/admin/registration', { token: adminToken, body: { open: false } });
      assert.deepEqual(closed.body, { registrationOpen: false });
    });

    it('progress reflects who scored what', async () => {
      const res = await s.api('GET', '/api/judge/progress', { token: judges.one!.token });
      assert.equal(res.status, 200);
      assert.equal(res.body.totalTeams, 4);
      assert.deepEqual(res.body.judges.map((j: any) => [j.label, j.name, j.evaluatedCount]), [
        ['Judge 1', 'Dr. One', 1],
        ['Judge 2', 'Dr. Two', 1],
      ]);
      assert.equal(res.body.teams.length, 4);
      assert.deepEqual(res.body.teams.map((t: any) => t.orderPosition), [1, 2, 3, 4]);
      const alpha = res.body.teams.find((t: any) => t.id === teams.alpha!.id);
      assert.equal(alpha.evaluatedByMe, true);
      assert.equal(alpha.evaluationCount, 2);
      assert.equal(res.body.teams.filter((t: any) => t.evaluatedByMe).length, 1);
      assert.equal(res.body.complete, false);
      assert.equal(res.body.resultsPublished, false);
    });

    it('publishing while incomplete is refused (judge, and admin without force)', async () => {
      const judgeTry = await s.api('POST', '/api/results/publish', { token: judges.one!.token, body: { force: true } });
      assertError(judgeTry, 409, 'INCOMPLETE');
      assert.equal(judgeTry.body.error.pending, 6);
      assertError(await s.api('POST', '/api/results/publish', { token: adminToken, body: {} }), 409, 'INCOMPLETE');
    });

    it('scores every remaining team', async () => {
      // beta, gamma and delta all average 40 -> a tie spanning positions 2-4 that the judges must break.
      const plan: Array<[string, Scores]> = [
        ['beta', scores(7, 9, 8, 8, 8)],
        ['gamma', scores(9, 8, 8, 8, 7)],
        ['delta', scores(7, 9, 7, 9, 8)],
      ];
      for (const [teamKey, sc] of plan) {
        for (const judge of ['one', 'two']) {
          const res = await evaluate(judge, teamKey, sc);
          assert.equal(res.status, 201, JSON.stringify(res.body));
          assert.equal(res.body.evaluation.total, 40);
        }
      }
      const progress = await s.api('GET', '/api/judge/progress', { token: judges.two!.token });
      assert.equal(progress.body.complete, true);
      assert.equal(progress.body.unresolvedTies, 1);
      assert.ok(progress.body.teams.every((t: any) => t.evaluatedByMe && t.evaluationCount === 2));
      const mine = await s.api('GET', '/api/judge/evaluations', { token: judges.two!.token });
      assert.equal(mine.body.evaluations.length, 4);
      const times = mine.body.evaluations.map((e: any) => e.createdAt);
      assert.deepEqual(times, times.slice().sort().reverse(), 'newest first');
    });

    it('admin overview, teams and leaderboard', async () => {
      const overview = await s.api('GET', '/api/admin/overview', { token: adminToken });
      assert.equal(overview.status, 200);
      assert.equal(overview.body.teams, 4);
      assert.equal(overview.body.participants, 7);
      assert.equal(overview.body.judges, 2);
      assert.equal(overview.body.evaluations, 8);
      assert.equal(overview.body.expectedEvaluations, 8);
      assert.equal(overview.body.registrationOpen, false);
      assert.equal(overview.body.orderGenerated, true);
      assert.equal(typeof overview.body.orderGeneratedAt, 'string');
      assert.equal(overview.body.resultsPublished, false);
      assert.equal(overview.body.resultsPublishedAt, null);
      assert.equal(overview.body.emailConfigured, false);
      // Alpha members 2 and 3 never uploaded a photo, and neither did judge two.
      assert.equal(overview.body.missingPhotos, 3);

      const list = await s.api('GET', '/api/admin/teams', { token: adminToken });
      const alpha = list.body.teams.find((t: any) => t.id === teams.alpha!.id);
      assert.equal(alpha.code, teams.alpha!.code);
      assert.equal(alpha.members.length, 4);
      assert.equal(alpha.members[0].role, 'lead');
      assert.equal(alpha.evaluationCount, 2);
      assert.equal(alpha.average, 45);
      assert.equal(alpha.missingPhotos, 2);

      const lb = await s.api('GET', '/api/admin/leaderboard', { token: adminToken });
      assert.equal(lb.status, 200);
      assert.deepEqual(lb.body.criteria.map((c: any) => c.key), CRITERIA_KEYS);
      assert.deepEqual(lb.body.teams.map((t: any) => t.rank), [1, 2, 2, 2]);
      assert.deepEqual(lb.body.teams.map((t: any) => t.tied), [false, true, true, true]);
      assert.equal(lb.body.teams[0].team.id, teams.alpha!.id);
      // Unresolved ties are listed by name for display only.
      assert.deepEqual(lb.body.teams.slice(1).map((t: any) => t.team.name), ['Beta', 'Delta', 'Gamma']);
      assert.equal(lb.body.ties.length, 1);
      assert.deepEqual(lb.body.ties[0].positions, [2, 4]);
      assert.equal(lb.body.ties[0].resolved, false);
      assert.equal(lb.body.ties[0].myOrdering, null);
      assert.equal(lb.body.teams[0].evaluations[0].judgePhotoUrl, (await s.api('GET', '/api/me', { token: judges.one!.token })).body.judge.photoUrl);
      assert.deepEqual(lb.body.teams[0].criteriaAverages, scores(9, 9, 9, 9, 9));
      assert.equal(lb.body.teams[0].evaluations.length, 2);
      lb.body.teams.forEach((t: any) => assertPublicTeam(t.team));
    });

    it('judges break ties that touch the top 3; publishing waits for them', async () => {
      const blocked = await s.api('POST', '/api/results/publish', { token: judges.one!.token, body: {} });
      assertError(blocked, 409, 'TIES_UNRESOLVED');
      assert.equal(blocked.body.error.ties.length, 1);
      assertError(await s.api('POST', '/api/results/publish', { token: adminToken, body: { force: true } }), 409, 'TIES_UNRESOLVED');

      const ties = await s.api('GET', '/api/judge/ties', { token: judges.one!.token });
      assert.equal(ties.status, 200);
      assert.equal(ties.body.complete, true);
      assert.equal(ties.body.ties.length, 1);
      const tie = ties.body.ties[0];
      const tiedIds = [teams.beta!.id, teams.gamma!.id, teams.delta!.id];
      assert.equal(tie.groupKey, tiedIds.slice().sort().join(','));
      assert.equal(tie.average, 40);
      assert.deepEqual(tie.positions, [2, 4]);
      tie.teams.forEach(assertPublicTeam);
      assert.deepEqual(tie.votes.map((v: any) => [v.judgeLabel, v.submitted]), [['Judge 1', false], ['Judge 2', false]]);
      assert.equal(tie.myOrdering, null);

      const vote = (judge: string, teamIds: unknown, groupKey = tie.groupKey) =>
        s.api('PUT', '/api/judge/ties', { token: judges[judge]!.token, body: { groupKey, teamIds } });
      assertError(await vote('one', tiedIds.slice(0, 2)), 400, 'VALIDATION');
      assertError(await vote('one', [teams.alpha!.id, ...tiedIds.slice(1)]), 400, 'VALIDATION');
      assertError(await vote('one', tiedIds, 'a,b'), 404, 'NOT_FOUND');
      assertError(await s.api('PUT', '/api/judge/ties', { token: adminToken, body: { groupKey: tie.groupKey, teamIds: tiedIds } }), 403, 'FORBIDDEN');

      const agreed = [teams.gamma!.id, teams.delta!.id, teams.beta!.id];
      const first = await vote('one', agreed);
      assert.equal(first.status, 200, JSON.stringify(first.body));
      assert.deepEqual(first.body.tie.myOrdering, agreed);
      assert.equal(first.body.tie.resolved, false);
      const disagree = await vote('two', [teams.beta!.id, teams.gamma!.id, teams.delta!.id]);
      assert.equal(disagree.body.tie.resolved, false);
      assert.deepEqual(disagree.body.tie.votes.map((v: any) => v.submitted), [true, true]);
      assertError(await s.api('POST', '/api/results/publish', { token: judges.two!.token, body: {} }), 409, 'TIES_UNRESOLVED');

      // The admin cannot settle a disagreement by deactivating a judge: judge two scored every tied team,
      // so their vote still counts while deactivated.
      const off = await s.api('PATCH', `/api/admin/judges/${judges.two!.id}`, { token: adminToken, body: { active: false } });
      assert.equal(off.status, 200, JSON.stringify(off.body));
      const stillTied = await s.api('GET', '/api/judge/ties', { token: judges.one!.token });
      assert.equal(stillTied.body.ties[0].resolved, false);
      assert.deepEqual(stillTied.body.ties[0].votes.map((v: any) => v.judgeLabel), ['Judge 1', 'Judge 2']);
      assertError(await s.api('POST', '/api/results/publish', { token: adminToken, body: { force: true } }), 409, 'TIES_UNRESOLVED');
      const on = await s.api('PATCH', `/api/admin/judges/${judges.two!.id}`, { token: adminToken, body: { active: true } });
      assert.equal(on.status, 200, JSON.stringify(on.body));
      const relogin = await s.api('POST', '/api/auth/judge-login', { body: { username: 'judge-two', password: 'judgepass' } });
      assert.equal(relogin.status, 200, JSON.stringify(relogin.body));
      judges.two!.token = relogin.body.token;

      const settled = await vote('two', agreed);
      assert.equal(settled.body.tie.resolved, true);
      assert.deepEqual(settled.body.tie.resolvedOrdering, agreed);
      assert.deepEqual(settled.body.tie.teams.map((t: any) => t.id), agreed);
      assert.equal((await s.api('GET', '/api/judge/progress', { token: judges.one!.token })).body.unresolvedTies, 0);

      const lb = await s.api('GET', '/api/admin/leaderboard', { token: adminToken });
      assert.deepEqual(lb.body.teams.map((t: any) => t.rank), [1, 2, 3, 4]);
      assert.deepEqual(lb.body.teams.map((t: any) => t.tied), [false, false, false, false]);
      assert.deepEqual(lb.body.teams.slice(1).map((t: any) => t.team.id), agreed);
      assert.equal(lb.body.ties[0].resolved, true);
    });

    it('a judge publishes once everything is scored; it is irreversible', async () => {
      assert.deepEqual((await s.api('GET', '/api/results', { token: teams.alpha!.token })).body, { published: false });
      const res = await s.api('POST', '/api/results/publish', { token: judges.one!.token, body: {} });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(typeof res.body.publishedAt, 'string');
      assertError(await s.api('POST', '/api/results/publish', { token: judges.two!.token, body: {} }), 409, 'RESULTS_PUBLISHED');
      assertError(await s.api('POST', '/api/results/publish', { token: adminToken, body: { force: true } }), 409, 'RESULTS_PUBLISHED');

      const overview = await s.api('GET', '/api/admin/overview', { token: adminToken });
      assert.equal(overview.body.resultsPublished, true);
      assert.equal(overview.body.resultsPublishedAt, res.body.publishedAt);
      assert.equal((await s.api('GET', '/api/config')).body.resultsPublished, true);
    });

    it('no evaluations after publishing', async () => {
      const created = await s.api('POST', '/api/admin/judges', { token: adminToken, body: { name: 'Late Judge', username: 'late', password: 'judgepass' } });
      assert.equal(created.status, 201);
      const login = await s.api('POST', '/api/auth/judge-login', { body: { username: 'late', password: 'judgepass' } });
      judges.late = { id: login.body.judge.id, token: login.body.token };
      assertError(await evaluate('late', 'alpha', scores(1, 1, 1, 1, 1)), 403, 'RESULTS_PUBLISHED');
      // A new active judge with no votes does not reopen the published tie-break.
      const lb = await s.api('GET', '/api/admin/leaderboard', { token: adminToken });
      assert.deepEqual(lb.body.teams.map((t: any) => t.rank), [1, 2, 3, 4]);
      const groupKey = lb.body.ties[0].groupKey;
      const teamIds = lb.body.ties[0].resolvedOrdering;
      assertError(await s.api('PUT', '/api/judge/ties', { token: judges.one!.token, body: { groupKey, teamIds } }), 403, 'RESULTS_PUBLISHED');
      const progress = await s.api('GET', '/api/judge/progress', { token: judges.late!.token });
      assert.equal(progress.body.resultsPublished, true);
    });

    it('results show the top 3 using the judges\' tie-break', async () => {
      const res = await s.api('GET', '/api/results', { token: teams.gamma!.token });
      assert.equal(res.status, 200);
      assert.equal(res.body.published, true);
      assert.equal(typeof res.body.publishedAt, 'string');
      assert.equal(res.body.top.length, 3);
      assert.deepEqual(res.body.top.map((t: any) => t.rank), [1, 2, 3]);
      assert.deepEqual(res.body.top.map((t: any) => t.team.id), [teams.alpha!.id, teams.gamma!.id, teams.delta!.id]);
      assert.deepEqual(res.body.top.map((t: any) => t.average), [45, 40, 40]);
      assert.deepEqual(res.body.top.map((t: any) => t.evaluationCount), [2, 2, 2]);
      res.body.top.forEach((t: any) => assertPublicTeam(t.team));

      const alphaReport = await s.api('GET', '/api/team/report', { token: teams.alpha!.token });
      assert.equal(alphaReport.body.resultsPublished, true);
      assert.equal(alphaReport.body.rank, 1);
      const gammaReport = await s.api('GET', '/api/team/report', { token: teams.gamma!.token });
      assert.equal(gammaReport.body.rank, 2);
      const betaReport = await s.api('GET', '/api/team/report', { token: teams.beta!.token });
      assert.equal(betaReport.body.rank, null, 'rank 4 is not revealed');
      assert.equal(betaReport.body.average, 40);
    });

    it('logout deletes the session', async () => {
      const res = await s.api('POST', '/api/auth/logout', { token: teams.beta!.token });
      assert.deepEqual(res.body, { ok: true });
      assertError(await s.api('GET', '/api/me', { token: teams.beta!.token }), 401, 'UNAUTHORIZED');
    });
  });
});

describe('Tech Arena API (admin force publish)', () => {
  let s: TestServer;
  before(async () => {
    s = await startServer();
  });
  after(async () => {
    await s?.stop();
  });

  it('admin can force-publish an incomplete event; unranked teams sit at the end', async () => {
    const admin = (await s.api('POST', '/api/auth/admin-login', { body: { username: 'admin', password: ADMIN_PASSWORD } })).body.token;
    await s.api('POST', '/api/admin/judges', { token: admin, body: { name: 'Solo', username: 'solo', password: 'judgepass' } });
    const judge = (await s.api('POST', '/api/auth/judge-login', { body: { username: 'solo', password: 'judgepass' } })).body.token;

    const regs = [];
    for (const [i, name] of ['One', 'Two'].entries()) {
      const r = await s.api('POST', '/api/teams/register', { body: teamPayload({ teamName: name, phone: `970000000${i}` }) });
      assert.equal(r.status, 201);
      regs.push(r.body);
    }
    assertError(await s.api('POST', '/api/results/publish', { token: admin, body: { force: true } }), 400, 'BAD_REQUEST');

    const ev = await s.api('POST', '/api/judge/evaluations', {
      token: judge,
      body: { teamId: regs[0].team.id, code: regs[0].team.code, scores: scores(5, 5, 5, 5, 5) },
    });
    assert.equal(ev.status, 201);

    const judgeForce = await s.api('POST', '/api/results/publish', { token: judge, body: { force: true } });
    assertError(judgeForce, 409, 'INCOMPLETE');
    assert.equal(judgeForce.body.error.pending, 1);
    assertError(await s.api('POST', '/api/results/publish', { token: admin, body: { force: false } }), 409, 'INCOMPLETE');

    const forced = await s.api('POST', '/api/results/publish', { token: admin, body: { force: true } });
    assert.equal(forced.status, 200, JSON.stringify(forced.body));
    assertError(await s.api('POST', '/api/results/publish', { token: admin, body: { force: true } }), 409, 'RESULTS_PUBLISHED');

    const late = await s.api('POST', '/api/judge/evaluations', {
      token: judge,
      body: { teamId: regs[1].team.id, code: regs[1].team.code, scores: scores(10, 10, 10, 10, 10) },
    });
    assertError(late, 403, 'RESULTS_PUBLISHED');

    const results = await s.api('GET', '/api/results', { token: regs[1].token });
    assert.equal(results.body.published, true);
    assert.equal(results.body.top.length, 1);
    assert.equal(results.body.top[0].team.id, regs[0].team.id);
    assert.equal(results.body.top[0].average, 25);

    const lb = await s.api('GET', '/api/admin/leaderboard', { token: admin });
    assert.deepEqual(lb.body.teams.map((t: any) => [t.rank, t.average, t.evaluationCount]), [
      [1, 25, 1],
      [null, null, 0],
    ]);
    assert.deepEqual(lb.body.teams[1].criteriaAverages, {});

    const report = await s.api('GET', '/api/team/report', { token: regs[0].token });
    assert.equal(report.body.rank, 1);
    assert.equal(report.body.activeJudgeCount, 1);
  });
});

describe('Tech Arena API (early judging + forced publish with a tie)', () => {
  let s: TestServer;
  before(async () => {
    s = await startServer();
  });
  after(async () => {
    await s?.stop();
  });

  it('first order draw works after early scoring; judges can break a tie before scoring is complete', async () => {
    const admin = (await s.api('POST', '/api/auth/admin-login', { body: { username: 'admin', password: ADMIN_PASSWORD } })).body.token;
    await s.api('POST', '/api/admin/judges', { token: admin, body: { name: 'Solo', username: 'solo', password: 'judgepass' } });
    const judge = (await s.api('POST', '/api/auth/judge-login', { body: { username: 'solo', password: 'judgepass' } })).body.token;

    const regs = [];
    for (const [i, name] of ['Tie A', 'Tie B', 'Unscored'].entries()) {
      const r = await s.api('POST', '/api/teams/register', { body: teamPayload({ teamName: name, phone: `960000000${i}` }) });
      assert.equal(r.status, 201);
      regs.push(r.body);
    }

    // Judge scores two teams before the admin has drawn the order.
    for (const reg of regs.slice(0, 2)) {
      const ev = await s.api('POST', '/api/judge/evaluations', {
        token: judge,
        body: { teamId: reg.team.id, code: reg.team.code, scores: scores(8, 8, 8, 8, 8) },
      });
      assert.equal(ev.status, 201);
    }

    // The first draw is still allowed; a redraw is not.
    const draw = await s.api('POST', '/api/admin/order/generate', { token: admin, body: {} });
    assert.equal(draw.status, 200, JSON.stringify(draw.body));
    assert.deepEqual(draw.body.teams.map((t: any) => t.orderPosition).sort(), [1, 2, 3]);
    assertError(await s.api('POST', '/api/admin/order/generate', { token: admin, body: { force: true } }), 409, 'CONFLICT');

    // Incomplete event, but the tie for 1st is visible and can be voted on.
    const ties = await s.api('GET', '/api/judge/ties', { token: judge });
    assert.equal(ties.body.complete, false);
    assert.equal(ties.body.ties.length, 1);
    const tie = ties.body.ties[0];
    assert.equal(tie.resolved, false);

    // Admin force cannot bypass an unresolved tie.
    assertError(await s.api('POST', '/api/results/publish', { token: admin, body: { force: true } }), 409, 'TIES_UNRESOLVED');

    const ordering = [regs[1].team.id, regs[0].team.id];
    const vote = await s.api('PUT', '/api/judge/ties', { token: judge, body: { groupKey: tie.groupKey, teamIds: ordering } });
    assert.equal(vote.status, 200, JSON.stringify(vote.body));
    assert.equal(vote.body.tie.resolved, true);

    const forced = await s.api('POST', '/api/results/publish', { token: admin, body: { force: true } });
    assert.equal(forced.status, 200, JSON.stringify(forced.body));
    const results = await s.api('GET', '/api/results', { token: regs[2].token });
    assert.deepEqual(results.body.top.map((t: any) => [t.rank, t.team.id]), [
      [1, regs[1].team.id],
      [2, regs[0].team.id],
    ]);
  });
});

describe('Tech Arena API (posters)', () => {
  let s: TestServer;
  before(async () => {
    s = await startServer();
  });
  after(async () => {
    await s?.stop();
  });

  it('lead uploads a poster until the team is first scored', async () => {
    const admin = (await s.api('POST', '/api/auth/admin-login', { body: { username: 'admin', password: ADMIN_PASSWORD } })).body.token;

    const withPoster = await s.api('POST', '/api/teams/register', {
      body: teamPayload({ teamName: 'Poster Team', phone: '9500000001', posterBase64: JPEG_BASE64, posterMime: 'image/jpeg' }),
    });
    assert.equal(withPoster.status, 201, JSON.stringify(withPoster.body));
    assert.match(withPoster.body.team.posterUrl, /^\/api\/images\//);
    const served = await s.api('GET', withPoster.body.team.posterUrl);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/jpeg');

    const reg = await s.api('POST', '/api/teams/register', { body: teamPayload({ teamName: 'No Poster', phone: '9500000002' }) });
    assert.equal(reg.status, 201);
    assert.equal(reg.body.team.posterUrl, null);
    assert.equal((await s.api('GET', '/api/admin/overview', { token: admin })).body.missingPosters, 1);

    const member = await s.api('POST', '/api/team/members', {
      token: reg.body.token,
      body: { name: 'Mem Ber', phone: '9500000003', email: 'm@example.com' },
    });
    assert.equal(member.status, 201);
    const memberToken = (await s.api('POST', '/api/auth/login', { body: { phone: '9500000003', password: 'teampass1' } })).body.token;
    const poster = { posterBase64: JPEG_BASE64, posterMime: 'image/jpeg' };
    assertError(await s.api('PUT', '/api/team/poster', { token: memberToken, body: poster }), 403, 'FORBIDDEN');
    assertError(await s.api('PUT', '/api/team/poster', { token: reg.body.token, body: {} }), 400, 'VALIDATION');

    // Still allowed after registration closes.
    await s.api('POST', '/api/admin/order/generate', { token: admin, body: {} });
    const up = await s.api('PUT', '/api/team/poster', { token: reg.body.token, body: poster });
    assert.equal(up.status, 200, JSON.stringify(up.body));
    assert.match(up.body.team.posterUrl, /^\/api\/images\//);
    const replaced = await s.api('PUT', '/api/team/poster', { token: reg.body.token, body: poster });
    assert.notEqual(replaced.body.team.posterUrl, up.body.team.posterUrl);
    assert.equal((await s.api('GET', up.body.team.posterUrl)).status, 404, 'old poster is deleted');
    assert.equal((await s.api('GET', '/api/admin/overview', { token: admin })).body.missingPosters, 0);

    // Judges see it on the team card, and it locks once they start scoring.
    await s.api('POST', '/api/admin/judges', { token: admin, body: { name: 'Solo', username: 'solo', password: 'judgepass' } });
    const judge = (await s.api('POST', '/api/auth/judge-login', { body: { username: 'solo', password: 'judgepass' } })).body.token;
    const card = await s.api('GET', `/api/judge/teams/by-code/${reg.body.team.code}`, { token: judge });
    assert.equal(card.body.team.posterUrl, replaced.body.team.posterUrl);
    const ev = await s.api('POST', '/api/judge/evaluations', {
      token: judge,
      body: { teamId: reg.body.team.id, code: reg.body.team.code, scores: scores(5, 5, 5, 5, 5) },
    });
    assert.equal(ev.status, 201);
    assertError(await s.api('PUT', '/api/team/poster', { token: reg.body.token, body: poster }), 409, 'CONFLICT');
  });
});

describe('Tech Arena API (team colours and auto poster)', () => {
  let s: TestServer;
  before(async () => {
    s = await startServer();
  });
  after(async () => {
    await s.stop();
  });

  it('teams pick unique banner colours; leads can change theirs or drop an uploaded poster', async () => {
    const palette = await s.api('GET', '/api/team-colors');
    assert.equal(palette.status, 200);
    assert.ok(palette.body.colors.length >= 30);
    assert.ok(palette.body.colors.every((c: any) => /^#[0-9A-F]{6}$/.test(c.hex) && typeof c.name === 'string' && c.taken === false));
    const [red, blue] = palette.body.colors as Array<{ hex: string }>;

    assertError(await s.api('POST', '/api/teams/register', { body: teamPayload({ teamName: 'Bad', phone: '9600000009', color: '#123456' }) }), 400, 'VALIDATION');
    const a = await s.api('POST', '/api/teams/register', { body: teamPayload({ teamName: 'Reds', phone: '9600000001', color: red!.hex.toLowerCase() }) });
    assert.equal(a.status, 201, JSON.stringify(a.body));
    assert.equal(a.body.team.color, red!.hex, 'stored in canonical case');
    const dup = await s.api('POST', '/api/teams/register', { body: teamPayload({ teamName: 'Copycats', phone: '9600000002', color: red!.hex }) });
    assertError(dup, 409, 'CONFLICT');
    assert.equal(typeof dup.body.error.fields.color, 'string');
    const b = await s.api('POST', '/api/teams/register', { body: teamPayload({ teamName: 'Blues', phone: '9600000003', color: blue!.hex }) });
    assert.equal(b.status, 201);
    // No colour sent (older app): the server gives the team a free one, never a taken one.
    const none = await s.api('POST', '/api/teams/register', { body: teamPayload({ teamName: 'Plain', phone: '9600000004' }) });
    assert.equal(none.status, 201);
    assert.match(none.body.team.color, /^#[0-9A-F]{6}$/);
    assert.ok(![red!.hex, blue!.hex].includes(none.body.team.color));

    const taken = (await s.api('GET', '/api/team-colors')).body.colors.filter((c: any) => c.taken).map((c: any) => c.hex);
    assert.deepEqual(taken.sort(), [red!.hex, blue!.hex, none.body.team.color].sort());

    // Changing colour: must be free, lead only.
    assertError(await s.api('PUT', '/api/team/color', { token: b.body.token, body: { color: red!.hex } }), 409, 'CONFLICT');
    assertError(await s.api('PUT', '/api/team/color', { token: b.body.token, body: {} }), 400, 'VALIDATION');
    const third = palette.body.colors.find((c: any) => ![red!.hex, blue!.hex, none.body.team.color].includes(c.hex)).hex;
    const changed = await s.api('PUT', '/api/team/color', { token: b.body.token, body: { color: third } });
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    assert.equal(changed.body.team.color, third);
    assert.equal((await s.api('PUT', '/api/team/color', { token: b.body.token, body: { color: third } })).status, 200, 'same colour is a no-op');
    assert.equal((await s.api('GET', '/api/team-colors')).body.colors.find((c: any) => c.hex === blue!.hex).taken, false, 'old colour freed');

    // Colour shows up for judges.
    const admin = (await s.api('POST', '/api/auth/admin-login', { body: { username: 'admin', password: ADMIN_PASSWORD } })).body.token;
    await s.api('POST', '/api/admin/judges', { token: admin, body: { name: 'Solo', username: 'solo', password: 'judgepass' } });
    const judge = (await s.api('POST', '/api/auth/judge-login', { body: { username: 'solo', password: 'judgepass' } })).body.token;
    const card = await s.api('GET', `/api/judge/teams/by-code/${a.body.team.code}`, { token: judge });
    assert.equal(card.body.team.color, red!.hex);
    const progress = await s.api('GET', '/api/judge/progress', { token: judge });
    assert.equal(progress.body.teams.find((t: any) => t.id === a.body.team.id).color, red!.hex);

    // Removing an uploaded poster brings back the auto poster.
    const up = await s.api('PUT', '/api/team/poster', { token: a.body.token, body: { posterBase64: JPEG_BASE64, posterMime: 'image/jpeg' } });
    assert.match(up.body.team.posterUrl, /^\/api\/images\//);
    const removed = await s.api('DELETE', '/api/team/poster', { token: a.body.token });
    assert.equal(removed.status, 200);
    assert.equal(removed.body.team.posterUrl, null);
    assert.equal((await s.api('GET', up.body.team.posterUrl)).status, 404);
  });
});

describe('Tech Arena API (app ratings)', () => {
  let s: TestServer;
  before(async () => {
    s = await startServer();
  });
  after(async () => {
    await s.stop();
  });

  it('team members and judges rate the app once (updatable); the badge and admin list show it', async () => {
    const empty = await s.api('GET', '/api/rating/badge');
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body, { schemaVersion: 1, label: 'app rating', message: 'no ratings yet', color: 'lightgrey' });

    const lead = await s.api('POST', '/api/teams/register', { body: teamPayload({ teamName: 'Raters', phone: '9700000001' }) });
    assert.equal(lead.status, 201);
    const admin = (await s.api('POST', '/api/auth/admin-login', { body: { username: 'admin', password: ADMIN_PASSWORD } })).body.token;
    await s.api('POST', '/api/admin/judges', { token: admin, body: { name: 'Prof. Rate', username: 'rate', password: 'judgepass' } });
    const judge = (await s.api('POST', '/api/auth/judge-login', { body: { username: 'rate', password: 'judgepass' } })).body.token;

    assertError(await s.api('GET', '/api/rating'), 401, 'UNAUTHORIZED');
    assertError(await s.api('PUT', '/api/rating', { token: admin, body: { stars: 5 } }), 403, 'FORBIDDEN');
    assert.deepEqual((await s.api('GET', '/api/rating', { token: lead.body.token })).body, { rating: null });
    for (const bad of [0, 6, 4.5, '5', null]) {
      assertError(await s.api('PUT', '/api/rating', { token: lead.body.token, body: { stars: bad } }), 400, 'VALIDATION');
    }

    const first = await s.api('PUT', '/api/rating', { token: lead.body.token, body: { stars: 3, feedback: '  Good, but slow on my phone  ' } });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.rating.feedback, 'Good, but slow on my phone');
    const changed = await s.api('PUT', '/api/rating', { token: lead.body.token, body: { stars: 4 } });
    assert.equal(changed.body.rating.stars, 4);
    assert.equal(changed.body.rating.feedback, null);
    assert.equal((await s.api('GET', '/api/rating', { token: lead.body.token })).body.rating.stars, 4);
    assert.equal((await s.api('PUT', '/api/rating', { token: judge, body: { stars: 5, feedback: 'Scoring was quick.' } })).status, 200);

    const badge = await s.api('GET', '/api/rating/badge');
    assert.equal(badge.body.message, '★ 4.5 / 5 · 2 ratings');
    assert.equal(badge.body.color, 'brightgreen');

    const list = await s.api('GET', '/api/admin/ratings', { token: admin });
    assert.equal(list.status, 200);
    assert.equal(list.body.count, 2);
    assert.equal(list.body.average, 4.5);
    const byRole = Object.fromEntries(list.body.ratings.map((r: any) => [r.role, r]));
    assert.equal(byRole.team.name, 'Lead Person');
    assert.equal(byRole.team.teamName, 'Raters');
    assert.equal(byRole.judge.name, 'Prof. Rate');
    assert.equal(byRole.judge.feedback, 'Scoring was quick.');
    assertError(await s.api('GET', '/api/admin/ratings', { token: judge }), 403, 'FORBIDDEN');
  });
});
