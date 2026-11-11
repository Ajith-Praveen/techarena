import { Platform } from 'react-native';

import type {
  AddMemberRequest,
  AddMemberResponse,
  TurnResponse,
  AdminRatingsResponse,
  MyRatingResponse,
  RateAppRequest,
  TeamColorsResponse,
  AdminJudgesResponse,
  AdminLoginRequest,
  AdminOverview,
  AdminTeamsResponse,
  ApiErrorBody,
  ApiErrorCode,
  AppConfig,
  ChangePasswordRequest,
  CreateJudgeRequest,
  EvaluationResponse,
  GenerateOrderRequest,
  GenerateOrderResponse,
  HealthResponse,
  JudgeLoginRequest,
  JudgeResponse,
  JudgeTeamByCodeResponse,
  JudgeTiesResponse,
  LeaderboardResponse,
  LoginRequest,
  MeResponse,
  MyEvaluationsResponse,
  NotifyRequest,
  NotifyResponse,
  OkResponse,
  OrderResponse,
  ProgressResponse,
  PublishRequest,
  PublishResponse,
  RegisterRequest,
  RegistrationResponse,
  SetOrderRequest,
  ReportResponse,
  ResultsResponse,
  Session,
  SubmitEvaluationRequest,
  TeamResponse,
  TieGroup,
  TieVoteRequest,
  TieVoteResponse,
  ImageUpload,
  UpdateJudgeRequest,
  UpdatePhotoResponse,
  UpdateTeamRequest,
  UpdateTeamResponse,
  PosterUpload,
} from './types';

const REQUEST_TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | (string & {});
  readonly fields: Record<string, string> | undefined;
  /** Extra numeric detail, e.g. pending evaluations on 409 INCOMPLETE. */
  readonly pending: number | undefined;
  /** Unresolved tie groups on 409 TIES_UNRESOLVED. */
  readonly ties: TieGroup[] | undefined;

  constructor(
    status: number,
    code: ApiErrorCode | (string & {}),
    message: string,
    fields?: Record<string, string>,
    pending?: number,
    ties?: TieGroup[],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.pending = pending;
    this.ties = ties;
  }

  get isNetwork(): boolean {
    return this.code === 'NETWORK';
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

// ---------- Base URL ----------

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * EXPO_PUBLIC_API_URL if set; otherwise on web the current origin (the Worker serves the app).
 * Returns '' on native when not configured.
 */
export function getApiBaseUrl(): string {
  const fromEnv = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
  if (fromEnv) return trimSlash(fromEnv);
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return trimSlash(window.location.origin);
  }
  return '';
}

/** Turns a relative `/api/images/<id>` URL into an absolute one. Passes absolute/data/file URIs through. */
export function imageUri(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(https?:|data:|file:|blob:|content:)/i.test(url)) return url;
  const base = getApiBaseUrl();
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

// ---------- Token + 401 handling (wired by AuthContext) ----------

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

/** Called when an authenticated request returns 401 (session expired / revoked). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

// ---------- Request helper ----------

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  body?: unknown;
  /** Send the bearer token (default true). */
  auth?: boolean;
  /**
   * Treat a 401 as "session expired" and sign out (default true).
   * Disabled for endpoints where 401 means "wrong password re-entered".
   */
  signOutOn401?: boolean;
  signal?: AbortSignal;
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'The request was not valid.',
  401: 'Please log in again.',
  403: 'You are not allowed to do that.',
  404: 'Not found.',
  409: 'That conflicts with existing data.',
  429: 'Too many attempts. Please wait a few minutes and try again.',
  503: 'The service is temporarily unavailable.',
};

const STATUS_CODES: Record<number, ApiErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

export async function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, signOutOn401 = true, signal } = options;
  const base = getApiBaseUrl();
  if (!base) {
    throw new ApiError(0, 'NETWORK', 'Server address is not configured (EXPO_PUBLIC_API_URL).');
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const sentToken = auth ? authToken : null;
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK',
      timedOut
        ? 'The server took too long to respond. Check your connection and try again.'
        : signal?.aborted
          ? 'Request cancelled.'
          : 'Could not reach the server. Check your internet connection and try again.',
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }

  const text = await res.text().catch(() => '');
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (!res.ok) {
    const errBody = (data as Partial<ApiErrorBody> | undefined)?.error;
    const error = new ApiError(
      res.status,
      errBody?.code ?? STATUS_CODES[res.status] ?? (res.status >= 500 ? 'INTERNAL' : 'BAD_REQUEST'),
      errBody?.message || STATUS_MESSAGES[res.status] || `Request failed (${res.status}).`,
      errBody?.fields,
      typeof errBody?.pending === 'number' ? errBody.pending : undefined,
      Array.isArray(errBody?.ties) ? errBody.ties : undefined,
    );
    // Only sign out if the token that failed is still the current one.
    if (res.status === 401 && sentToken && signOutOn401 && sentToken === authToken) {
      unauthorizedHandler?.();
    }
    throw error;
  }

  return (data ?? {}) as T;
}

const enc = encodeURIComponent;

// ---------- Endpoints (SPEC section 9) ----------

export const api = {
  // Public
  health: () => request<HealthResponse>('GET', '/api/health', { auth: false }),
  config: () => request<AppConfig>('GET', '/api/config', { auth: false }),
  register: (body: RegisterRequest) =>
    request<Session>('POST', '/api/teams/register', { body, auth: false }),
  login: (body: LoginRequest) => request<Session>('POST', '/api/auth/login', { body, auth: false }),
  judgeLogin: (body: JudgeLoginRequest) =>
    request<Session>('POST', '/api/auth/judge-login', { body, auth: false }),
  adminLogin: (body: AdminLoginRequest) =>
    request<Session>('POST', '/api/auth/admin-login', { body, auth: false }),

  // Any authenticated role
  logout: () => request<OkResponse>('POST', '/api/auth/logout', { signOutOn401: false }),
  me: () => request<MeResponse>('GET', '/api/me'),
  updatePhoto: (body: ImageUpload) => request<UpdatePhotoResponse>('PUT', '/api/me/photo', { body }),
  order: () => request<OrderResponse>('GET', '/api/order'),
  results: () => request<ResultsResponse>('GET', '/api/results'),

  // Team (lead + member; mutations are lead-only)
  team: () => request<TeamResponse>('GET', '/api/team'),
  updateTeam: (body: UpdateTeamRequest) => request<UpdateTeamResponse>('PUT', '/api/team', { body }),
  /** Lead only. Allowed until the first judge scores the team (409 CONFLICT after). */
  uploadPoster: (body: PosterUpload) => request<UpdateTeamResponse>('PUT', '/api/team/poster', { body }),
  /** Drop the uploaded poster so the auto-generated one is shown again. */
  removePoster: () => request<UpdateTeamResponse>('DELETE', '/api/team/poster'),
  /** Change the team banner colour (lead only; must be free). */
  setTeamColor: (color: string) => request<UpdateTeamResponse>('PUT', '/api/team/color', { body: { color } }),
  /** The colour palette with which colours other teams already use. */
  teamColors: () => request<TeamColorsResponse>('GET', '/api/team-colors', { auth: false }),
  /** Your own app rating, or null if you have not rated yet. */
  myRating: () => request<MyRatingResponse>('GET', '/api/rating'),
  rateApp: (body: RateAppRequest) => request<MyRatingResponse>('PUT', '/api/rating', { body }),
  adminRatings: () => request<AdminRatingsResponse>('GET', '/api/admin/ratings'),
  addMember: (body: AddMemberRequest) => request<AddMemberResponse>('POST', '/api/team/members', { body }),
  removeMember: (memberId: string) =>
    request<OkResponse>('DELETE', `/api/team/members/${enc(memberId)}`),
  changePassword: (body: ChangePasswordRequest) =>
    request<OkResponse>('POST', '/api/team/password', { body, signOutOn401: false }),
  notify: (body: NotifyRequest) =>
    request<NotifyResponse>('POST', '/api/team/notify', { body, signOutOn401: false }),
  report: () => request<ReportResponse>('GET', '/api/team/report'),
  /** Where the team is relative to the judges (for the ring alerts). */
  turn: () => request<TurnResponse>('GET', '/api/team/turn'),

  // Judge
  judgeTeamByCode: (code: string) =>
    request<JudgeTeamByCodeResponse>('GET', `/api/judge/teams/by-code/${enc(code)}`),
  submitEvaluation: (body: SubmitEvaluationRequest) =>
    request<EvaluationResponse>('POST', '/api/judge/evaluations', { body }),
  myEvaluations: () => request<MyEvaluationsResponse>('GET', '/api/judge/evaluations'),
  progress: () => request<ProgressResponse>('GET', '/api/judge/progress'),
  /** One-time random draw of the presentation order by a judge (409 once drawn). */
  judgeGenerateOrder: () => request<GenerateOrderResponse>('POST', '/api/judge/order/generate', { body: {} }),
  judgeTies: () => request<JudgeTiesResponse>('GET', '/api/judge/ties'),
  voteTie: (body: TieVoteRequest) => request<TieVoteResponse>('PUT', '/api/judge/ties', { body }),

  // Judge or admin
  publishResults: (body: PublishRequest = {}) =>
    request<PublishResponse>('POST', '/api/results/publish', { body }),

  // Admin
  adminOverview: () => request<AdminOverview>('GET', '/api/admin/overview'),
  adminTeams: () => request<AdminTeamsResponse>('GET', '/api/admin/teams'),
  adminDeleteTeam: (teamId: string) => request<OkResponse>('DELETE', `/api/admin/teams/${enc(teamId)}`),
  setRegistration: (open: boolean) =>
    request<RegistrationResponse>('POST', '/api/admin/registration', { body: { open } }),
  generateOrder: (body: GenerateOrderRequest = {}) =>
    request<GenerateOrderResponse>('POST', '/api/admin/order/generate', { body }),
  setOrder: (body: SetOrderRequest) => request<GenerateOrderResponse>('PUT', '/api/admin/order', { body }),
  adminJudges: () => request<AdminJudgesResponse>('GET', '/api/admin/judges'),
  createJudge: (body: CreateJudgeRequest) => request<JudgeResponse>('POST', '/api/admin/judges', { body }),
  updateJudge: (judgeId: string, body: UpdateJudgeRequest) =>
    request<JudgeResponse>('PATCH', `/api/admin/judges/${enc(judgeId)}`, { body }),
  leaderboard: () => request<LeaderboardResponse>('GET', '/api/admin/leaderboard'),
} as const;

export type Api = typeof api;
