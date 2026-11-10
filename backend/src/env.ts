import type { JudgeRow, ParticipantRow, TeamRow } from './lib/db';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  EVENT_NAME: string;
  ADMIN_USERNAME?: string;
  DEFAULT_COUNTRY_CODE: string;
  MAX_TEAM_SIZE: string;
  APP_URL: string;
  APK_URL: string;
  /** Public repo link for the "Star on GitHub" button. */
  GITHUB_URL?: string;
  /** Oldest installed app version still allowed (e.g. "1.1.0"); older builds are asked to update. */
  MIN_APP_VERSION?: string;
  /** Where /techarena.apk forwards to (the Android build download). Empty = 404. */
  APK_DOWNLOAD_URL?: string;
  MAIL_FROM: string;
  ADMIN_PASSWORD?: string;
  RESEND_API_KEY?: string;
}

export type Role = 'lead' | 'member' | 'judge' | 'admin';

export interface AuthInfo {
  role: Role;
  tokenHash: string;
  participant?: ParticipantRow;
  team?: TeamRow;
  judge?: JudgeRow;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { auth: AuthInfo };
};
