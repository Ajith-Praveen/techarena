// Shapes from SPEC.md sections 8 and 9. Keep in sync with the Worker.

// ---------- Core entities (SPEC section 8) ----------

export type Role = 'lead' | 'member' | 'judge' | 'admin';
export type ParticipantRole = 'lead' | 'member';

export interface Criterion {
  key: string;
  label: string;
  description: string;
  max: number;
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  email: string;
  usn: string | null;
  role: ParticipantRole;
  /** Relative profile photo URL, or null when the member has not added one yet. */
  photoUrl: string | null;
}

export interface Team {
  id: string;
  name: string;
  code: string;
  projectTitle: string;
  projectDesc: string;
  /** Relative URL (`/api/images/<id>`); pass through `imageUri()` before rendering. */
  imageUrl: string | null;
  /** Portrait project poster; null until the lead uploads it (the app then shows an auto poster). */
  posterUrl: string | null;
  /** Team banner colour (hex from the team colour palette), unique per team. */
  color: string | null;
  orderPosition: number | null;
  createdAt: string;
}

/** What judges and the queue see. Never includes the team code or contact info. */
export interface PublicTeam {
  id: string;
  name: string;
  projectTitle: string;
  projectDesc: string;
  imageUrl: string | null;
  /** Portrait project poster; null until the lead uploads it (the app then shows an auto poster). */
  posterUrl: string | null;
  color: string | null;
  orderPosition: number | null;
  memberNames: string[];
  /** Lead first; names and photos only (no contact info). */
  members: PublicPerson[];
}

export interface PublicPerson {
  name: string;
  role: ParticipantRole;
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

export type Scores = Record<string, number>;

export interface Evaluation {
  id: string;
  teamId: string;
  judgeId: string;
  judgeName: string;
  /** "Judge 1", "Judge 2", ... by judge creation order. */
  judgeLabel: string;
  judgePhotoUrl: string | null;
  scores: Scores;
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
  /** Lead/member/judge without a profile photo; always false for admin. */
  needsPhoto: boolean;
}

// ---------- Errors ----------

export type ApiErrorCode =
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
  | 'INTERNAL'
  /** Client-side: request never reached the server, timed out, or API URL is not configured. */
  | 'NETWORK';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode | (string & {});
    message: string;
    fields?: Record<string, string>;
    /** Present on 409 INCOMPLETE from POST /api/results/publish. */
    pending?: number;
    /** Present on 409 TIES_UNRESOLVED from POST /api/results/publish. */
    ties?: TieGroup[];
  };
}

export interface OkResponse {
  ok: true;
}

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ImageUpload {
  /** Base64 without the `data:` prefix. Max decoded size 1.5 MB. */
  imageBase64: string;
  imageMime: ImageMime;
}

// ---------- Public ----------

export interface HealthResponse {
  ok: true;
}

export interface AppConfig {
  eventName: string;
  criteria: Criterion[];
  maxPerJudge: number;
  maxTeamSize: number;
  registrationOpen: boolean;
  orderGenerated: boolean;
  resultsPublished: boolean;
  appUrl: string;
  apkUrl: string;
  /** Public GitHub repo for the "Star on GitHub" button (may be empty). */
  githubUrl?: string;
  /** Installed apps older than this must update (empty = no minimum). */
  minAppVersion?: string;
  /** Stable Android download link (empty when no APK is published). */
  apkDownloadUrl?: string;
}

export interface RegisterRequest extends ImageUpload {
  leadName: string;
  usn: string;
  phone: string;
  email: string;
  teamName: string;
  projectTitle: string;
  projectDesc: string;
  password: string;
  /** The lead's profile photo (required). */
  photoBase64: string;
  photoMime: ImageMime;
  /** Optional at registration; can be uploaded later until judging of the team starts. */
  posterBase64?: string;
  posterMime?: ImageMime;
  /** Team banner colour (hex from GET /api/team-colors); must not be taken by another team. */
  color?: string;
}

export interface TeamColorOption {
  hex: string;
  name: string;
  taken: boolean;
}

export interface TeamColorsResponse {
  colors: TeamColorOption[];
}

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface JudgeLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginRequest {
  username: string;
  password: string;
}

// ---------- Any authenticated role ----------

export interface MeResponse {
  role: Role;
  member?: Member;
  team?: Team;
  judge?: Judge;
  needsPhoto: boolean;
}

export interface UpdatePhotoResponse {
  photoUrl: string;
  needsPhoto: false;
}

export interface QueueTeam extends PublicTeam {
  evaluationCount: number;
}

export interface OrderResponse {
  generated: boolean;
  generatedAt: string | null;
  /** Sorted by orderPosition; empty when the order has not been generated. */
  teams: QueueTeam[];
}

export interface ResultEntry {
  rank: number;
  team: PublicTeam;
  average: number;
  evaluationCount: number;
}

export type ResultsResponse =
  | { published: false }
  | { published: true; publishedAt: string; top: ResultEntry[] };

// ---------- Team (lead + member) ----------

export interface TeamResponse {
  team: Team;
  /** Lead first. */
  members: Member[];
}

export interface UpdateTeamRequest extends Partial<ImageUpload> {
  projectTitle?: string;
  projectDesc?: string;
}

export interface UpdateTeamResponse {
  team: Team;
}

export interface AddMemberRequest {
  name: string;
  phone: string;
  email: string;
  usn?: string;
  photoBase64?: string;
  photoMime?: ImageMime;
}

export interface AddMemberResponse {
  member: Member;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface NotifyRequest {
  /** The team password, re-entered by the lead. */
  password: string;
  /** Defaults to every member except the lead. */
  memberIds?: string[];
}

export type NotifyStatus = 'sent' | 'failed' | 'not_configured';

export interface NotifyResult {
  memberId: string;
  name: string;
  email: string;
  status: NotifyStatus;
  error?: string;
}

export interface NotifyResponse {
  results: NotifyResult[];
}

export interface ReportResponse {
  criteria: Criterion[];
  maxPerJudge: number;
  activeJudgeCount: number;
  /** How many judges have scored the team (always shown). */
  scoredCount: number;
  /** Empty until results are published: marks stay sealed before that. */
  evaluations: Evaluation[];
  average: number | null;
  resultsPublished: boolean;
  /** Only set when results are published AND the team placed in the top 3. */
  rank: number | null;
}

// ---------- Judge ----------

export interface JudgeTeamByCodeResponse {
  team: PublicTeam;
  myEvaluation: Evaluation | null;
}

export interface SubmitEvaluationRequest {
  teamId: string;
  code: string;
  /** Every criterion key required, integer 0..max, no extra keys. */
  scores: Scores;
  remarks?: string;
}

export interface EvaluationResponse {
  evaluation: Evaluation;
}

export interface MyEvaluationsResponse {
  /** Newest first. */
  evaluations: Evaluation[];
}

export interface ProgressJudge {
  id: string;
  name: string;
  label: string;
  evaluatedCount: number;
}

export interface ProgressTeam {
  id: string;
  name: string;
  projectTitle: string;
  imageUrl: string | null;
  color: string | null;
  orderPosition: number | null;
  evaluatedByMe: boolean;
  evaluationCount: number;
}

export interface ProgressResponse {
  totalTeams: number;
  judges: ProgressJudge[];
  teams: ProgressTeam[];
  complete: boolean;
  resultsPublished: boolean;
  /** Relevant tie groups (touching the top 3) that the judges have not agreed on yet. */
  unresolvedTies: number;
}

export interface TieVote {
  judgeId: string;
  judgeLabel: string;
  judgeName: string;
  submitted: boolean;
  ordering: string[] | null;
}

export interface TieGroup {
  /** Team ids sorted and joined by ','. */
  groupKey: string;
  average: number;
  /** Sorted positions the group spans, e.g. [2, 4]. */
  positions: [number, number];
  teams: PublicTeam[];
  votes: TieVote[];
  /** Judge callers only. */
  myOrdering: string[] | null;
  resolved: boolean;
  resolvedOrdering: string[] | null;
}

export interface JudgeTiesResponse {
  complete: boolean;
  ties: TieGroup[];
}

export interface TieVoteRequest {
  groupKey: string;
  /** Permutation of the group's team ids, best first. */
  teamIds: string[];
}

export interface TieVoteResponse {
  tie: TieGroup;
}

// ---------- Judge or admin ----------

export interface PublishRequest {
  /** Only honored for admin. */
  force?: boolean;
}

export interface PublishResponse {
  publishedAt: string;
}

// ---------- Admin ----------

export interface AdminOverview {
  teams: number;
  participants: number;
  judges: number;
  evaluations: number;
  expectedEvaluations: number;
  missingPhotos: number;
  missingPosters: number;
  registrationOpen: boolean;
  orderGenerated: boolean;
  orderGeneratedAt: string | null;
  resultsPublished: boolean;
  resultsPublishedAt: string | null;
  emailConfigured: boolean;
}

export interface AdminTeam extends Team {
  members: Member[];
  evaluationCount: number;
  average: number | null;
  missingPhotos: number;
}

export interface AdminTeamsResponse {
  teams: AdminTeam[];
}

export interface RegistrationRequest {
  open: boolean;
}

export interface RegistrationResponse {
  registrationOpen: boolean;
}

export interface GenerateOrderRequest {
  force?: boolean;
}

export interface SetOrderRequest {
  /** Every team id exactly once, in presentation order. */
  teamIds: string[];
}

export interface GenerateOrderResponse {
  generatedAt: string;
  teams: PublicTeam[];
}

export interface AdminJudge extends Judge {
  evaluatedCount: number;
}

export interface AdminJudgesResponse {
  judges: AdminJudge[];
}

export interface CreateJudgeRequest {
  name: string;
  /** 3-30 chars `[a-z0-9._-]`, lowercased by the server. */
  username: string;
  password: string;
}

export interface UpdateJudgeRequest {
  active?: boolean;
  password?: string;
  name?: string;
}

export interface JudgeResponse {
  judge: Judge;
}

export interface LeaderboardEntry {
  /** null for teams with zero evaluations (listed at the end). */
  rank: number | null;
  /** True when the rank is shared (tie not decided by the judges). */
  tied: boolean;
  team: PublicTeam;
  average: number | null;
  evaluationCount: number;
  criteriaAverages: Record<string, number>;
  evaluations: Evaluation[];
}

export interface LeaderboardResponse {
  criteria: Criterion[];
  teams: LeaderboardEntry[];
  /** Tie groups touching the top 3 (read only for admin). */
  ties: TieGroup[];
}

export interface PosterUpload {
  posterBase64: string;
  posterMime: ImageMime;
}

// ---------- App ratings ----------

export interface AppRating {
  stars: number;
  feedback: string | null;
  updatedAt: string;
}

export interface MyRatingResponse {
  rating: AppRating | null;
}

export interface RateAppRequest {
  stars: number;
  feedback?: string;
}

export interface AdminRating extends AppRating {
  role: 'team' | 'judge';
  name: string;
  teamName: string | null;
}

export interface AdminRatingsResponse {
  count: number;
  average: number | null;
  ratings: AdminRating[];
}
