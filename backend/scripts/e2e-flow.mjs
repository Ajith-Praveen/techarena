#!/usr/bin/env node
// Full expo-day scenario against a running Worker that was seeded with seed-demo.mjs.
//
//   node scripts/e2e-flow.mjs [baseUrl] [--admin-password <pw>]
//
// Publishing is irreversible, so this runs once per database (re-seed a fresh one to repeat).
// Scores are chosen so two teams tie for 2nd/3rd and the judges have to break the tie.
import assert from 'node:assert/strict';
import { client, DEMO_JUDGE_PASSWORD, DEMO_JUDGES, DEMO_TEAM_PASSWORD, DEMO_TEAMS, describeError, parseArgs } from './demo-data.mjs';

const { baseUrl, adminPassword, adminUsername } = parseArgs(process.argv);
const api = client(baseUrl);

let checks = 0;
function ok(cond, message) {
  assert.ok(cond, message);
  checks++;
}
function expectStatus(res, status, what) {
  assert.equal(res.status, status, `${what}: expected ${status}, got ${describeError(res)}`);
  checks++;
  return res.body;
}
function expectError(res, status, code, what) {
  assert.equal(res.status, status, `${what}: expected ${status} ${code}, got ${describeError(res)}`);
  assert.equal(res.body?.error?.code, code, `${what}: expected ${code}, got ${describeError(res)}`);
  checks++;
}
function step(title) {
  console.log(`\n▸ ${title}`);
}

const s = (idea, working, uniqueness, impact, presentation) => ({ idea, working, uniqueness, impact, presentation });
// Per team (DEMO_TEAMS order): [judge1 scores, judge2 scores]. Averages: 46, 42, 42, 38, 35, 30.
const PLAN = [
  [s(10, 9, 9, 9, 9), s(9, 9, 9, 10, 9)],
  [s(8, 9, 8, 9, 8), s(9, 8, 9, 8, 8)],
  [s(9, 8, 8, 8, 9), s(8, 9, 8, 8, 9)],
  [s(8, 8, 7, 8, 7), s(7, 8, 8, 7, 8)],
  [s(7, 7, 7, 7, 7), s(7, 7, 7, 7, 7)],
  [s(6, 6, 6, 6, 6), s(6, 6, 6, 6, 6)],
];
const total = (sc) => Object.values(sc).reduce((a, b) => a + b, 0);

step('Preflight');
const config = expectStatus(await api('GET', '/api/config'), 200, 'config');
if (config.resultsPublished) {
  console.error('Results are already published on this database. Start from a fresh one and re-seed.');
  process.exit(1);
}
ok(config.orderGenerated, 'order generated (run seed-demo.mjs first)');
ok(config.criteria.length === 5, 'five criteria');
const admin = expectStatus(
  await api('POST', '/api/auth/admin-login', { body: { username: adminUsername, password: adminPassword } }),
  200,
  'admin login',
);

step('Team logins (lead + members with the team password)');
const teams = [];
for (const [i, t] of DEMO_TEAMS.entries()) {
  const lead = expectStatus(await api('POST', '/api/auth/login', { body: { phone: t.lead.phone, password: DEMO_TEAM_PASSWORD } }), 200, `${t.teamName} lead login`);
  ok(lead.role === 'lead' && /^\d{4}$/.test(lead.team.code), `${t.teamName} lead session`);
  for (const m of t.members) {
    const member = expectStatus(await api('POST', '/api/auth/login', { body: { phone: m.phone, password: DEMO_TEAM_PASSWORD } }), 200, `${m.name} login`);
    ok(member.role === 'member' && member.team.id === lead.team.id, `${m.name} is a member of ${t.teamName}`);
    ok(member.needsPhoto === false, `${m.name} has a photo`);
    expectStatus(await api('GET', '/api/team/report', { token: member.token }), 200, `${m.name} report`);
    expectError(
      await api('POST', '/api/team/members', { token: member.token, body: { name: 'Nope', phone: '9000000009', email: 'n@demo.test' } }),
      403,
      'FORBIDDEN',
      `${m.name} cannot add members`,
    );
    await api('POST', '/api/auth/logout', { token: member.token });
  }
  expectError(await api('POST', '/api/auth/login', { body: { phone: t.lead.phone, password: 'wrong-pass' } }), 401, 'UNAUTHORIZED', 'wrong password');
  teams.push({ ...t, plan: PLAN[i], id: lead.team.id, code: lead.team.code, token: lead.token });
}
const byId = new Map(teams.map((t) => [t.id, t]));

step('Judges log in');
const judges = [];
for (const j of DEMO_JUDGES) {
  const res = expectStatus(await api('POST', '/api/auth/judge-login', { body: { username: j.username, password: DEMO_JUDGE_PASSWORD } }), 200, `${j.username} login`);
  ok(res.role === 'judge', `${j.username} role`);
  judges.push({ ...j, id: res.judge.id, token: res.token });
}

step('Judges evaluate every team by its 4-digit code, in queue order');
const order = expectStatus(await api('GET', '/api/order', { token: judges[0].token }), 200, 'order');
ok(order.generated && order.teams.length === teams.length, 'queue lists every team');
let firstReportChecked = false;
for (const queued of order.teams) {
  const team = byId.get(queued.id);
  ok(team, `queued team ${queued.name} is a demo team`);
  for (const [ji, judge] of judges.entries()) {
    const found = expectStatus(await api('GET', `/api/judge/teams/by-code/${team.code}`, { token: judge.token }), 200, `${judge.username} looks up ${team.code}`);
    ok(found.team.id === team.id, 'code resolves to the right team');
    ok(found.team.members.length === 3 && found.team.members.every((m) => m.photoUrl), 'team card shows 3 members with photos');
    ok(found.team.code === undefined && !JSON.stringify(found).includes('@demo.test'), 'no code or contacts leaked');
    if (found.myEvaluation) continue;
    const sc = team.plan[ji];
    const ev = expectStatus(
      await api('POST', '/api/judge/evaluations', { token: judge.token, body: { teamId: team.id, code: team.code, scores: sc, remarks: `Demo remarks from ${judge.username}` } }),
      201,
      `${judge.username} evaluates ${team.teamName}`,
    );
    ok(ev.evaluation.total === total(sc), 'total is the sum of criteria');
    expectError(
      await api('POST', '/api/judge/evaluations', { token: judge.token, body: { teamId: team.id, code: team.code, scores: sc } }),
      409,
      'ALREADY_EVALUATED',
      'second submission refused',
    );
    if (!firstReportChecked) {
      const report = expectStatus(await api('GET', '/api/team/report', { token: team.token }), 200, 'report right after first score');
      ok(report.evaluations.some((e) => e.judgeId === judge.id && e.total === total(sc)), 'report shows the new score immediately');
      firstReportChecked = true;
    }
  }
}

step('Team reports show both evaluations');
for (const team of teams) {
  const report = expectStatus(await api('GET', '/api/team/report', { token: team.token }), 200, `${team.teamName} report`);
  ok(report.evaluations.length === 2, `${team.teamName} has 2 evaluations`);
  ok(
    report.evaluations.map((e) => e.judgeLabel).join() === 'Judge 1,Judge 2',
    `${team.teamName} evaluations labelled Judge 1, Judge 2`,
  );
  report.evaluations.forEach((e, ji) => assert.deepEqual(e.scores, team.plan[ji], `${team.teamName} ${e.judgeLabel} scores`));
  ok(report.average === (total(team.plan[0]) + total(team.plan[1])) / 2, `${team.teamName} average`);
  ok(report.rank === null && report.resultsPublished === false, 'no rank before publishing');
}

step('Tie for 2nd/3rd must be broken by the judges');
const progress = expectStatus(await api('GET', '/api/judge/progress', { token: judges[0].token }), 200, 'progress');
ok(progress.complete === true, 'evaluations complete');
ok(progress.unresolvedTies === 1, 'one unresolved tie');
expectError(await api('POST', '/api/results/publish', { token: judges[0].token, body: {} }), 409, 'TIES_UNRESOLVED', 'publish blocked by tie');
expectError(await api('POST', '/api/results/publish', { token: admin.token, body: { force: true } }), 409, 'TIES_UNRESOLVED', 'admin force blocked by tie');
const ties = expectStatus(await api('GET', '/api/judge/ties', { token: judges[1].token }), 200, 'ties');
ok(ties.complete && ties.ties.length === 1, 'one relevant tie group');
const tie = ties.ties[0];
const [green, byte] = [teams[1], teams[2]];
ok(tie.teams.map((t) => t.id).sort().join() === [green.id, byte.id].sort().join(), 'tie is Green Thumbs vs Byte Me');
ok(tie.positions[0] === 2 && tie.positions[1] === 3 && tie.average === 42, 'tie spans positions 2-3 at 42');
const agreed = [green.id, byte.id];
for (const judge of judges) {
  const voted = expectStatus(await api('PUT', '/api/judge/ties', { token: judge.token, body: { groupKey: tie.groupKey, teamIds: agreed } }), 200, `${judge.username} tie vote`);
  ok(voted.tie.myOrdering.join() === agreed.join(), 'vote stored');
}
const settled = expectStatus(await api('GET', '/api/judge/ties', { token: judges[0].token }), 200, 'ties after votes');
ok(settled.ties[0].resolved && settled.ties[0].resolvedOrdering.join() === agreed.join(), 'tie resolved');

step('Judge publishes; results match the leaderboard');
expectError(await api('POST', '/api/results/publish', { token: green.token, body: {} }), 403, 'FORBIDDEN', 'teams cannot publish');
const published = expectStatus(await api('POST', '/api/results/publish', { token: judges[0].token, body: {} }), 200, 'publish');
ok(typeof published.publishedAt === 'string', 'publishedAt returned');
const results = expectStatus(await api('GET', '/api/results', { token: teams[5].token }), 200, 'results');
const board = expectStatus(await api('GET', '/api/admin/leaderboard', { token: admin.token }), 200, 'leaderboard');
const boardTop = board.teams.filter((t) => t.rank !== null && t.rank <= 3);
ok(results.published && results.top.length === 3, 'three teams on the podium');
assert.deepEqual(results.top.map((t) => t.rank), [1, 2, 3]);
assert.deepEqual(boardTop.map((t) => t.rank), [1, 2, 3]);
assert.deepEqual(results.top.map((t) => t.team.id), boardTop.map((t) => t.team.id), 'results top 3 == leaderboard ranks 1-3');
assert.deepEqual(results.top.map((t) => t.average), boardTop.map((t) => t.average));
assert.deepEqual(results.top.map((t) => t.team.id), [teams[0].id, green.id, byte.id], 'expected podium');
checks += 5;
ok(board.teams.every((t) => t.tied === false), 'no shared ranks left');
for (const [i, team] of teams.entries()) {
  const report = expectStatus(await api('GET', '/api/team/report', { token: team.token }), 200, `${team.teamName} final report`);
  ok(report.resultsPublished && report.rank === (i < 3 ? i + 1 : null), `${team.teamName} rank ${i < 3 ? i + 1 : 'hidden'}`);
}

step('No evaluations after publishing');
expectError(
  await api('POST', '/api/judge/evaluations', { token: judges[1].token, body: { teamId: teams[5].id, code: teams[5].code, scores: PLAN[5][1] } }),
  403,
  'RESULTS_PUBLISHED',
  'judge2 resubmits after publish',
);
const lateCreate = await api('POST', '/api/admin/judges', { token: admin.token, body: { name: 'Late Judge', username: 'judge3', password: DEMO_JUDGE_PASSWORD } });
ok(lateCreate.status === 201 || lateCreate.status === 409, `create judge3: ${describeError(lateCreate)}`);
const late = expectStatus(await api('POST', '/api/auth/judge-login', { body: { username: 'judge3', password: DEMO_JUDGE_PASSWORD } }), 200, 'judge3 login');
expectError(
  await api('POST', '/api/judge/evaluations', { token: late.token, body: { teamId: teams[0].id, code: teams[0].code, scores: PLAN[0][0] } }),
  403,
  'RESULTS_PUBLISHED',
  'new judge evaluates after publish',
);
expectError(await api('POST', '/api/results/publish', { token: admin.token, body: { force: true } }), 409, 'RESULTS_PUBLISHED', 'publish twice');
const lateBoard = expectStatus(await api('GET', '/api/admin/leaderboard', { token: admin.token }), 200, 'leaderboard after new judge');
assert.deepEqual(lateBoard.teams.slice(0, 3).map((t) => t.team.id), results.top.map((t) => t.team.id), 'podium frozen');
checks++;

console.log(`\n✓ End-to-end flow passed (${checks} checks).`);
console.log('Podium:', results.top.map((t) => `${t.rank}. ${t.team.name} (${t.average})`).join('  '));
