#!/usr/bin/env node
// Seeds a running Tech Arena Worker with demo data through the public API only.
//
//   node scripts/seed-demo.mjs [baseUrl] [--admin-password <pw>]
//   ADMIN_PASSWORD=admin123 node scripts/seed-demo.mjs http://localhost:8787
//
// Creates judges judge1/judge2 (password judge123, with profile photos), registers six demo teams
// (team password demo1234) with two members each, then generates the presentation order.
// Safe to re-run: existing judges/teams/members are skipped, and an existing order is kept.
import {
  client,
  DEMO_JUDGE_PASSWORD,
  DEMO_JUDGES,
  DEMO_TEAM_PASSWORD,
  DEMO_TEAMS,
  describeError,
  makePng,
  parseArgs,
} from './demo-data.mjs';

const { baseUrl, adminPassword, adminUsername } = parseArgs(process.argv);
const api = client(baseUrl);

function fail(step, res) {
  console.error(`✗ ${step}: ${describeError(res)}`);
  process.exit(1);
}

const health = await api('GET', '/api/health').catch((e) => ({ status: 0, body: { error: { code: 'NETWORK', message: String(e) } } }));
if (health.status !== 200) fail(`Worker not reachable at ${baseUrl}`, health);

const admin = await api('POST', '/api/auth/admin-login', { body: { username: adminUsername, password: adminPassword } });
if (admin.status !== 200) fail('admin login', admin);
const adminToken = admin.body.token;
console.log(`Seeding ${baseUrl}`);

// Judges
for (const j of DEMO_JUDGES) {
  const res = await api('POST', '/api/admin/judges', {
    token: adminToken,
    body: { name: j.name, username: j.username, password: DEMO_JUDGE_PASSWORD },
  });
  if (res.status === 201) console.log(`  judge ${j.username}: created`);
  else if (res.status === 409) console.log(`  judge ${j.username}: exists, skipped`);
  else fail(`create judge ${j.username}`, res);

  const login = await api('POST', '/api/auth/judge-login', { body: { username: j.username, password: DEMO_JUDGE_PASSWORD } });
  if (login.status !== 200) {
    console.log(`  judge ${j.username}: could not log in with the demo password (${describeError(login)}), photo skipped`);
    continue;
  }
  if (login.body.needsPhoto) {
    const photo = await api('PUT', '/api/me/photo', { token: login.body.token, body: { imageBase64: makePng(j.color, 48), imageMime: 'image/png' } });
    if (photo.status !== 200) fail(`judge ${j.username} photo`, photo);
  }
  await api('POST', '/api/auth/logout', { token: login.body.token });
}

// Teams
const summary = [];
for (const t of DEMO_TEAMS) {
  const reg = await api('POST', '/api/teams/register', {
    body: {
      leadName: t.lead.name,
      usn: t.lead.usn,
      phone: t.lead.phone,
      email: t.lead.email,
      teamName: t.teamName,
      projectTitle: t.projectTitle,
      projectDesc: t.projectDesc,
      password: DEMO_TEAM_PASSWORD,
      imageBase64: makePng(t.color, 96),
      imageMime: 'image/png',
      photoBase64: makePng(t.color.map((v) => 255 - v), 48),
      photoMime: 'image/png',
    },
  });
  let token;
  let team;
  if (reg.status === 201) {
    ({ token, team } = reg.body);
    console.log(`  team ${t.teamName}: registered`);
  } else if (reg.status === 409 || reg.status === 403) {
    const login = await api('POST', '/api/auth/login', { body: { phone: t.lead.phone, password: DEMO_TEAM_PASSWORD } });
    if (login.status !== 200) {
      console.log(`  team ${t.teamName}: ${describeError(reg)}; lead login failed, skipped`);
      continue;
    }
    ({ token, team } = login.body);
    console.log(`  team ${t.teamName}: exists, skipped`);
  } else {
    fail(`register ${t.teamName}`, reg);
  }

  const existing = await api('GET', '/api/team', { token });
  const known = new Set((existing.body?.members ?? []).map((m) => m.phone.replace(/^\+91/, '')));
  for (const [k, m] of t.members.entries()) {
    if (known.has(m.phone)) continue;
    const res = await api('POST', '/api/team/members', {
      token,
      body: { name: m.name, phone: m.phone, email: m.email, photoBase64: makePng(t.color.map((v) => (v + 60 * (k + 1)) % 256), 48), photoMime: 'image/png' },
    });
    if (res.status === 201) continue;
    if (res.status === 409 || res.status === 403) {
      console.log(`    member ${m.name}: ${res.body?.error?.code}, skipped`);
      continue;
    }
    fail(`add member ${m.name}`, res);
  }
  await api('POST', '/api/auth/logout', { token });
  summary.push({ team: t.teamName, code: team.code, lead: t.lead.phone, members: t.members.map((m) => m.phone).join(' ') });
}

// Presentation order
const gen = await api('POST', '/api/admin/order/generate', { token: adminToken, body: {} });
if (gen.status === 200) console.log('  order: generated');
else if (gen.status === 409) console.log(`  order: ${gen.body.error.message} Kept as is.`);
else fail('generate order', gen);

const order = await api('GET', '/api/order', { token: adminToken });
const position = new Map((order.body?.teams ?? []).map((t) => [t.name, t.orderPosition]));
await api('POST', '/api/auth/logout', { token: adminToken });

console.log(`\nTeam password: ${DEMO_TEAM_PASSWORD}   Judges: ${DEMO_JUDGES.map((j) => j.username).join(', ')} / ${DEMO_JUDGE_PASSWORD}`);
console.table(summary.map((s) => ({ position: position.get(s.team) ?? '-', ...s })).sort((a, b) => (a.position === '-' ? 1 : b.position === '-' ? -1 : a.position - b.position)));
