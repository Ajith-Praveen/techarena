import type { Role } from '../env';

export interface TeamRow {
  id: string;
  name: string;
  name_key: string;
  code: string;
  project_title: string;
  project_desc: string;
  image_id: string | null;
  poster_id: string | null;
  /** Banner colour (hex from TEAM_COLORS), unique across teams. */
  color?: string | null;
  password_hash: string;
  order_position: number | null;
  created_at: string;
}

export interface ParticipantRow {
  id: string;
  team_id: string;
  role: 'lead' | 'member';
  name: string;
  usn: string | null;
  photo_id: string | null;
  phone: string;
  email: string;
  created_at: string;
}

export interface JudgeRow {
  id: string;
  name: string;
  username: string;
  password_hash: string;
  photo_id: string | null;
  active: number;
  created_at: string;
}

export interface EvaluationRow {
  id: string;
  team_id: string;
  judge_id: string;
  scores: string;
  total: number;
  remarks: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  code: string;
  projectTitle: string;
  projectDesc: string;
  imageUrl: string | null;
  posterUrl: string | null;
  /** Team banner colour (hex), unique per team; null if none chosen. */
  color: string | null;
  orderPosition: number | null;
  createdAt: string;
}

export interface PublicTeam {
  id: string;
  name: string;
  projectTitle: string;
  projectDesc: string;
  imageUrl: string | null;
  posterUrl: string | null;
  color: string | null;
  orderPosition: number | null;
  memberNames: string[];
  /** Lead first; never includes phone or email. */
  members: PublicPerson[];
}

export interface PublicPerson {
  name: string;
  role: 'lead' | 'member';
  photoUrl: string | null;
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  email: string;
  usn: string | null;
  role: 'lead' | 'member';
  photoUrl: string | null;
}

export interface Judge {
  id: string;
  name: string;
  username: string;
  active: boolean;
  createdAt: string;
  photoUrl: string | null;
}

export interface Evaluation {
  id: string;
  teamId: string;
  judgeId: string;
  judgeName: string;
  judgeLabel: string;
  judgePhotoUrl: string | null;
  scores: Record<string, number>;
  total: number;
  remarks: string | null;
  createdAt: string;
}

export interface Session {
  token: string;
  role: Role;
  member?: Member;
  team?: Team;
  judge?: Judge;
  needsPhoto: boolean;
}

export const nowIso = () => new Date().toISOString();

export const imageUrl = (imageId: string | null) => (imageId ? `/api/images/${imageId}` : null);

export function toTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    projectTitle: row.project_title,
    projectDesc: row.project_desc,
    imageUrl: imageUrl(row.image_id),
    posterUrl: imageUrl(row.poster_id ?? null),
    color: row.color ?? null,
    orderPosition: row.order_position,
    createdAt: row.created_at,
  };
}

export function toPublicTeam(row: TeamRow, members: PublicPerson[]): PublicTeam {
  return {
    id: row.id,
    name: row.name,
    projectTitle: row.project_title,
    projectDesc: row.project_desc,
    imageUrl: imageUrl(row.image_id),
    posterUrl: imageUrl(row.poster_id ?? null),
    color: row.color ?? null,
    orderPosition: row.order_position,
    memberNames: members.map((m) => m.name),
    members,
  };
}

export function toMember(row: ParticipantRow): Member {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    usn: row.usn,
    role: row.role,
    photoUrl: imageUrl(row.photo_id),
  };
}

export function toJudge(row: JudgeRow): Judge {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    active: row.active === 1,
    createdAt: row.created_at,
    photoUrl: imageUrl(row.photo_id),
  };
}

export function parseScores(json: string): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, number>;
  } catch {
    // fall through
  }
  return {};
}

export interface JudgeLabel {
  name: string;
  label: string;
  photoUrl: string | null;
}

/** "Judge 1", "Judge 2", ... by judge creation order (stable across deactivation). */
export async function loadJudgeLabels(db: D1Database): Promise<Map<string, JudgeLabel>> {
  const { results } = await db
    .prepare('SELECT id, name, photo_id FROM judges ORDER BY created_at, id')
    .all<{ id: string; name: string; photo_id: string | null }>();
  return new Map(
    results.map((j, i) => [j.id, { name: j.name, label: `Judge ${i + 1}`, photoUrl: imageUrl(j.photo_id) }]),
  );
}

export function toEvaluation(row: EvaluationRow, labels: Map<string, JudgeLabel>): Evaluation {
  const judge = labels.get(row.judge_id);
  return {
    id: row.id,
    teamId: row.team_id,
    judgeId: row.judge_id,
    judgeName: judge?.name ?? 'Judge',
    judgeLabel: judge?.label ?? 'Judge',
    judgePhotoUrl: judge?.photoUrl ?? null,
    scores: parseScores(row.scores),
    total: row.total,
    remarks: row.remarks,
    createdAt: row.created_at,
  };
}

/** Sort evaluations by judge label order (Judge 1 first). */
export function sortByJudgeLabel(evals: Evaluation[]): Evaluation[] {
  const num = (label: string) => Number(label.replace(/\D/g, '')) || Number.MAX_SAFE_INTEGER;
  return evals.sort((a, b) => num(a.judgeLabel) - num(b.judgeLabel) || a.createdAt.localeCompare(b.createdAt));
}

/** Public member info per team (no contacts), lead first then members by join time. */
export async function loadPublicMembers(db: D1Database, teamId?: string): Promise<Map<string, PublicPerson[]>> {
  const cols = 'team_id, name, role, photo_id';
  const order = "CASE role WHEN 'lead' THEN 0 ELSE 1 END, created_at, id";
  const stmt = teamId
    ? db.prepare(`SELECT ${cols} FROM participants WHERE team_id = ? ORDER BY ${order}`).bind(teamId)
    : db.prepare(`SELECT ${cols} FROM participants ORDER BY team_id, ${order}`);
  const { results } = await stmt.all<{ team_id: string; name: string; role: 'lead' | 'member'; photo_id: string | null }>();
  const map = new Map<string, PublicPerson[]>();
  for (const r of results) {
    const person: PublicPerson = { name: r.name, role: r.role, photoUrl: imageUrl(r.photo_id) };
    const list = map.get(r.team_id);
    if (list) list.push(person);
    else map.set(r.team_id, [person]);
  }
  return map;
}

export async function loadMembers(db: D1Database, teamId: string): Promise<Member[]> {
  const { results } = await db
    .prepare(
      "SELECT * FROM participants WHERE team_id = ? ORDER BY CASE role WHEN 'lead' THEN 0 ELSE 1 END, created_at, id",
    )
    .bind(teamId)
    .all<ParticipantRow>();
  return results.map(toMember);
}

export async function getTeam(db: D1Database, id: string): Promise<TeamRow | null> {
  return db.prepare('SELECT * FROM teams WHERE id = ?').bind(id).first<TeamRow>();
}

/** All teams in presentation order (unordered teams last, then by name). */
export async function listTeams(db: D1Database): Promise<TeamRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM teams ORDER BY order_position IS NULL, order_position, name_key, id')
    .all<TeamRow>();
  return results;
}

export async function listEvaluations(db: D1Database): Promise<EvaluationRow[]> {
  const { results } = await db.prepare('SELECT * FROM evaluations ORDER BY created_at, id').all<EvaluationRow>();
  return results;
}

export async function countRows(db: D1Database, sql: string, ...binds: unknown[]): Promise<number> {
  const row = await db
    .prepare(sql)
    .bind(...binds)
    .first<{ n: number }>();
  return row?.n ?? 0;
}
