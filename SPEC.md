# Tech Arena — Product & API Spec (source of truth)

Project expo app. One codebase, three targets:

- **Android**: Expo app built as APK (EAS `preview` profile, `buildType: apk`).
- **iOS**: installable web app (PWA). Users open the URL in Safari and "Add to Home Screen". It runs full screen like a native app. No App Store needed.
- **Web/tablet**: same PWA, used by judges on iPad/tablet and by the admin.

Backend: one Cloudflare Worker (Hono + D1). The same Worker serves the API under `/api/*` and the exported web app (static assets, SPA fallback) for every other path, so the web app calls the API on the same origin.

```
tech_arena/
  SPEC.md          <- this file
  README.md        <- setup / deploy guide
  backend/         <- Cloudflare Worker (TypeScript, Hono, D1)
  app/             <- Expo SDK 58 app (TypeScript, expo-router)
```

## 1. Roles

| Role   | How they get in | What they do |
|--------|-----------------|--------------|
| lead   | Registers the team (public form), then logs in with phone + team password | Adds/removes teammates, sends them login details, edits project while registration is open, sees team code, queue, report, results |
| member | Added by lead; logs in with own phone + team password | Sees team code, team, queue, report, results (read only) |
| judge  | Account created by admin (username + password) | Enters a team's 4-digit code, scores it once (final), sees progress, publishes results |
| admin  | Username `ADMIN_USERNAME` (var, default `admin`) + password from Worker secret `ADMIN_PASSWORD` | Opens/closes registration, creates judges, generates the random presentation order **and rearranges it manually** (move teams up/down, e.g. absent team to the end), views full leaderboard, can force-publish. **Admin has NO control over scores**: no endpoint lets admin create, edit or delete an evaluation, and nothing admin can change (order, judges' active flag) alters any team's average or rank. |

## 2. Event flow

1. **Registration (before expo)**. Lead registers: name, USN, phone, email, **profile photo (required)**, team name, project title, project description, project image (required), team password (min 6 chars). Response logs the lead in.
2. Lead adds teammates (name, phone, email; USN optional) and uploads the team's **project poster** (portrait image). The poster is optional at registration but every team must have one before the expo: the lead's home shows a "Poster missing" warning and the admin sees missing posters. It can be replaced until the first judge scores the team, then it locks. Max team size including lead = `MAX_TEAM_SIZE` (default 5).
3. Lead taps "Send login details": re-enters the team password (server verifies it against the hash, since only the hash is stored) and the server emails every selected member their login (app link, APK link, their phone, team password). The app also offers per-member "SMS" and "WhatsApp" share buttons that compose the same message on the lead's phone (expo-sms / `https://wa.me/<digits>?text=...`), so it works even with no email provider configured.
4. Members install the app (APK on Android, PWA on iPhone) and log in with phone + team password.
   **Profile photos are mandatory for everyone (lead, members, judges).** The lead uploads theirs at registration and may optionally attach a photo when adding a member. Anyone signed in without a photo (`needsPhoto: true`) is stopped by a full-screen "Add your profile photo" gate (camera or gallery) before they can use any other screen. Judges see member photos on the team card when they enter a team's code, which helps them confirm they're at the right stall.
5. **Expo day**. Admin taps "Generate presentation order": cryptographically random Fisher–Yates shuffle of all teams, stored as `order_position` 1..N. Generating the order closes registration. Everyone sees the queue.
6. Each team has a unique **4-digit code** (1000–9999), shown on the team's home screen in big OTP-style digit boxes.
7. Judges (2, on iPads) go to a team, type the 4-digit code in an OTP-style input, see the team card (name, project, image, members, poster — tap to view full screen) to confirm, then enter a score for each criterion and submit after a "Scores are final" confirmation. **No edit, no delete, ever** (DB unique constraint on `(team_id, judge_id)`, no update endpoint).
8. The moment a judge submits, that evaluation shows up in the team's **Report** (app polls every 10 s while the report screen is open and shows a "New score received" banner).
9. After all teams are evaluated by all active judges, if any tie touches the top 3 the judges' Progress screen shows a **Tie-break** card per tie: each judge orders the tied teams and submits; once all judges submit the same order the tie is resolved (if they disagree the app says so and they discuss and resubmit). Then a judge taps **Publish results** (confirm dialog). Admin can force-publish even if incomplete. Publishing is irreversible and also blocks any further evaluations.
10. Everyone sees the **Results** podium: top 3 teams.

## 3. Scoring

Five criteria, each scored as an integer 0–10 per judge (50 per judge):

| key          | label                       | description |
|--------------|-----------------------------|-------------|
| `idea`       | Idea & Innovation           | How novel and well thought out the core idea is |
| `working`    | Working Model               | Does it actually work? Quality of the build / demo |
| `uniqueness` | Uniqueness                  | How different it is from existing solutions |
| `impact`     | Impact & Feasibility        | Real-world usefulness and how practical it is to deploy |
| `presentation` | Presentation & Q&A        | Clarity of explanation and answers to judges' questions |

Criteria live in one constant in the backend (`src/criteria.ts`) and are served by `GET /api/config`; the app never hard-codes them.

**Ranking** (used by leaderboard, results and team report):
- `average` = mean of the team's judge totals (only submitted evaluations), rounded to 2 decimals for display. Compare averages EXACTLY (integers: `sumA * countB` vs `sumB * countA`), never with floats.
- Teams with zero evaluations are excluded from ranking.
- Sort by `average` desc. There is NO automatic tiebreak (not criteria, not registration time, not presentation order).
- **Tie group** = 2+ teams with exactly equal average. A tie group is *relevant* if any of its teams would sit at sorted position ≤ 3 (e.g. averages 45, 44, 44, 44 → the three 44s occupy positions 2–4 → relevant).
- **Judges break ties.** Relevant tie groups are shown and can be voted on as soon as they exist (a group can still change while scoring continues; votes on an old group are ignored automatically). The **voters** for a group are the judges who scored every team in it — active or deactivated — so the admin can never change a tie's outcome by (de)activating a judge (only if nobody scored all of them, e.g. after a forced publish, do the active judges vote). Each voter submits their ordering of the tied teams (`PUT /api/judge/ties`; non-voters get 403). A group is *resolved* when every voter has submitted the identical ordering for it; that ordering is then used. Judges may change their tie vote until results are published. Votes are keyed by `group_key` = the group's team ids sorted and joined with `,`, so if a group's membership changes, old votes are ignored automatically.
- Ranks: within a resolved group, ranks follow the judges' ordering. Unresolved (or non-relevant) tie groups share a rank (competition ranking: 1, 2, 2, 4) and are flagged `tied: true`; within such a group list teams by name for display only.
- **Publishing is refused (409 `TIES_UNRESOLVED`, with the unresolved groups) while any relevant tie group is unresolved — for judges AND for admin force.** Admin has no way to resolve ties.

## 4. Conventions

- All endpoints are JSON, prefixed `/api`. Auth: `Authorization: Bearer <token>`.
- Errors: HTTP status + body `{ "error": { "code": "SOME_CODE", "message": "Human readable" } }`. Codes used: `BAD_REQUEST`, `VALIDATION`, `TIES_UNRESOLVED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `REGISTRATION_CLOSED`, `RESULTS_PUBLISHED`, `ALREADY_EVALUATED`, `INCOMPLETE`, `INTERNAL`.
- Validation errors may include `"fields": { "fieldName": "message" }` inside `error`.
- Timestamps: ISO 8601 strings (UTC).
- IDs: string UUIDs (`crypto.randomUUID()`).
- `imageUrl` values are **relative** (`/api/images/<id>`); the app prefixes its API base URL.
- Phone normalization (server authoritative): strip everything except digits and a leading `+`. If it starts with `+`, keep it (must be 8–15 digits). If it is exactly 10 digits, prefix `+` + `DEFAULT_COUNTRY_CODE` (default `91`). If 11 digits starting with `0`, drop the 0 and prefix the country code. If 12 digits starting with the country code, prefix `+`. Otherwise reject with `VALIDATION`. Phone is globally unique across all participants.
- Email: basic `x@y.z` check, stored lowercased. Team name: 2–60 chars, unique case-insensitively. Names 2–60 chars. USN 3–20 chars, stored uppercased. Project title 3–80 chars. Project description 10–1000 chars. Remarks ≤ 500 chars.
- CORS: allow any origin, methods GET/POST/PUT/PATCH/DELETE/OPTIONS, headers `Authorization, Content-Type` (bearer tokens only, no cookies).

## 5. Auth & security

- Passwords: PBKDF2-SHA256 via WebCrypto, 100000 iterations, 16-byte random salt, stored as `pbkdf2$100000$<saltB64>$<hashB64>`. Constant-time compare.
- Sessions: 32 random bytes hex token returned to the client; only `SHA-256(token)` hex is stored in D1. Expiry: participants 30 days, judges 3 days, admin 12 hours. `last_seen_at` optional.
- Login rate limit: max 10 failed attempts per key (`phone:<normalized>`, `judge:<username>`, `admin:<username>`) per 15 minutes → `429 RATE_LIMITED`. Successful login clears the counter.
- Admin login: username must equal `ADMIN_USERNAME` (case-insensitive, default `admin`) and password must equal secret `ADMIN_PASSWORD` (both compared constant-time; same 401 message for either mismatch). If the secret is unset, admin login returns 503 with a clear message.
- Score integrity: evaluations are written ONLY by `POST /api/judge/evaluations` (judge role). There is no update/delete path for evaluations for any role, and admin team delete is refused once a team has evaluations.
- Role guards on every route. A member calling a lead-only route gets `403 FORBIDDEN`.
- Images: upload as base64 in JSON (`imageBase64` without data-URL prefix, `imageMime` one of `image/jpeg`, `image/png`, `image/webp`). Max decoded size 1.5 MB. Stored as BLOB in D1 `images` table (no R2 needed). Served at `GET /api/images/:id` with correct `Content-Type` and `Cache-Control: public, max-age=31536000, immutable` (new uploads get new ids).

## 6. Worker configuration

`wrangler.jsonc`:
- `main: src/index.ts`, `compatibility_date` recent, `compatibility_flags: ["nodejs_compat"]` only if needed.
- D1 binding `DB` (database name `tech-arena-db`).
- `assets`: `{ "directory": "../app/dist", "binding": "ASSETS", "not_found_handling": "single-page-application", "run_worker_first": ["/api/*"] }`.
- `vars`: `EVENT_NAME` ("Tech Arena"), `ADMIN_USERNAME` ("admin"), `DEFAULT_COUNTRY_CODE` ("91"), `MAX_TEAM_SIZE` ("5"), `APP_URL` (""), `APK_URL` (""), `MAIL_FROM` ("Tech Arena <onboarding@resend.dev>").
- Secrets: `ADMIN_PASSWORD` (required), `RESEND_API_KEY` (optional; without it emails return status `not_configured`).
- Email is sent with the Resend HTTP API (`POST https://api.resend.com/emails`).

## 7. D1 schema (backend/migrations/0001_init.sql)

```sql
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,          -- lower(trim(name))
  code TEXT NOT NULL UNIQUE,              -- 4 digits
  project_title TEXT NOT NULL,
  project_desc TEXT NOT NULL,
  image_id TEXT,
  poster_id TEXT,                         -- migration 0003; portrait project poster
  password_hash TEXT NOT NULL,
  order_position INTEGER,                 -- NULL until order generated
  created_at TEXT NOT NULL
);
CREATE TABLE participants (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('lead','member')),
  name TEXT NOT NULL,
  usn TEXT,
  photo_id TEXT,                          -- profile photo (images.id); required by the app gate
  phone TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE judges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,          -- lowercased
  password_hash TEXT NOT NULL,
  photo_id TEXT,                          -- profile photo (images.id)
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE evaluations (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  judge_id TEXT NOT NULL REFERENCES judges(id),
  scores TEXT NOT NULL,                   -- JSON {criterionKey: int}
  total INTEGER NOT NULL,
  remarks TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (team_id, judge_id)
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('lead','member','judge','admin')),
  subject_id TEXT NOT NULL,               -- participant id, judge id, or 'admin'
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE images (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE tie_votes (
  judge_id TEXT NOT NULL REFERENCES judges(id),
  group_key TEXT NOT NULL,                -- sorted team ids joined by ','
  ordering TEXT NOT NULL,                 -- JSON string[] of team ids, best first
  updated_at TEXT NOT NULL,
  PRIMARY KEY (judge_id, group_key)
);
CREATE TABLE login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start TEXT NOT NULL);
INSERT INTO settings (key, value) VALUES ('registration_open', '1');
```
Plus sensible indexes (participants.team_id, evaluations.team_id, evaluations.judge_id, sessions.expires_at). Settings keys: `registration_open` ('1'/'0'), `order_generated_at`, `results_published_at`, `results_published_by` ("judge:<name>" or "admin").

## 8. Shared response shapes (TypeScript)

```ts
type Role = 'lead' | 'member' | 'judge' | 'admin';
interface Criterion { key: string; label: string; description: string; max: number }
interface Member { id: string; name: string; phone: string; email: string; usn: string | null; role: 'lead' | 'member'; photoUrl: string | null }
interface Team {
  id: string; name: string; code: string; projectTitle: string; projectDesc: string;
  imageUrl: string | null; posterUrl: string | null; orderPosition: number | null; createdAt: string;
}
interface PublicTeam { // what judges / queue see; never includes code or contact info
  id: string; name: string; projectTitle: string; projectDesc: string; imageUrl: string | null; posterUrl: string | null;
  orderPosition: number | null; memberNames: string[];
  members: Array<{ name: string; role: 'lead' | 'member'; photoUrl: string | null }>; // lead first; no phone/email
}
interface Judge { id: string; name: string; username: string; active: boolean; createdAt: string; photoUrl: string | null }
interface Evaluation {
  id: string; teamId: string; judgeId: string; judgeName: string; judgeLabel: string; judgePhotoUrl: string | null; // "Judge 1", "Judge 2" by judge created_at order
  scores: Record<string, number>; total: number; remarks: string | null; createdAt: string;
}
interface TieGroup {
  groupKey: string; average: number; positions: [number, number]; // sorted positions the group spans, e.g. [2, 4]
  teams: PublicTeam[];
  votes: Array<{ judgeId: string; judgeLabel: string; judgeName: string; submitted: boolean; ordering: string[] | null }>; // judges see each other's orderings so they can agree
  myOrdering: string[] | null; // judge callers only
  resolved: boolean; resolvedOrdering: string[] | null;
}
interface Session { token: string; role: Role; member?: Member; team?: Team; judge?: Judge; needsPhoto: boolean } // needsPhoto: lead/member/judge without a photo; always false for admin
```

## 9. Endpoints

### Public
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/health` | – | `{ ok: true }` |
| GET | `/api/config` | – | `{ eventName, criteria: Criterion[], maxPerJudge, maxTeamSize, registrationOpen, orderGenerated, resultsPublished, appUrl, apkUrl }` |
| POST | `/api/teams/register` | `{ leadName, usn, phone, email, teamName, projectTitle, projectDesc, password, imageBase64, imageMime, photoBase64, photoMime, posterBase64?, posterMime? }` (photo = lead's profile photo, required; poster optional) | `201 Session` (role `lead`, with `member` + `team`). 403 `REGISTRATION_CLOSED` if closed. 409 `CONFLICT` for duplicate phone / team name (with `fields`). |
| POST | `/api/auth/login` | `{ phone, password }` | `Session` (role lead/member). 401 on bad creds (same message for unknown phone and wrong password). |
| POST | `/api/auth/judge-login` | `{ username, password }` | `Session` (role judge). Inactive judge → 401. |
| POST | `/api/auth/admin-login` | `{ username, password }` | `Session` (role admin) |
| GET | `/api/images/:id` | – | binary image |

### Any authenticated role
| Method | Path | Response |
|---|---|---|
| POST | `/api/auth/logout` | `{ ok: true }` (deletes session) |
| GET | `/api/me` | `{ role, member?, team?, judge?, needsPhoto }` |
| PUT | `/api/me/photo` | lead/member/judge: `{ imageBase64, imageMime }` → `{ photoUrl, needsPhoto: false }`. Allowed any time (replaces old photo; delete the old image row). Admin → 403. |
| GET | `/api/order` | `{ generated: boolean, generatedAt: string|null, teams: Array<PublicTeam & { evaluationCount: number }> }` sorted by position (empty list if not generated) |
| GET | `/api/results` | `{ published: false }` or `{ published: true, publishedAt, top: Array<{ rank, team: PublicTeam, average, evaluationCount }> }` (top 3 only) |

### Team (lead + member unless noted)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/team` | – | `{ team: Team, members: Member[] }` (lead first) |
| PUT | `/api/team` | lead: `{ projectTitle?, projectDesc?, imageBase64?, imageMime? }` | `{ team }`; only while registration open |
| PUT | `/api/team/poster` | lead: `{ posterBase64, posterMime }` | `{ team }`. Allowed even after registration closes; 409 `CONFLICT` once any judge has scored the team or results are published. Replaces (and deletes) the old poster. |
| POST | `/api/team/members` | lead: `{ name, phone, email, usn?, photoBase64?, photoMime? }` | `201 { member }`; registration open; size limit → 409 `CONFLICT` |
| DELETE | `/api/team/members/:id` | lead | `{ ok: true }`; cannot remove the lead; registration open |
| POST | `/api/team/password` | lead: `{ currentPassword, newPassword }` | `{ ok: true }` |
| POST | `/api/team/notify` | lead: `{ password, memberIds?: string[] }` (default all members except lead) | `{ results: Array<{ memberId, name, email, status: 'sent'|'failed'|'not_configured', error?: string }> }`; wrong password → 401 |
| GET | `/api/team/report` | – | `{ criteria, maxPerJudge, activeJudgeCount, evaluations: Evaluation[], average: number|null, resultsPublished: boolean, rank: number|null }` — `rank` only when results published AND rank ≤ 3, else null |

### Judge
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/judge/teams/by-code/:code` | – | `{ team: PublicTeam, myEvaluation: Evaluation|null }`; 404 if no team has that code |
| POST | `/api/judge/evaluations` | `{ teamId, code, scores: Record<key,int>, remarks? }` | `201 { evaluation }`. Every criterion key required, integer 0..max, no extra keys. `code` must match team. 409 `ALREADY_EVALUATED`, 403 `RESULTS_PUBLISHED`. |
| GET | `/api/judge/evaluations` | – | `{ evaluations: Evaluation[] }` (mine, newest first) |
| GET | `/api/judge/progress` | – | `{ totalTeams, judges: Array<{ id, name, label, evaluatedCount }>, teams: Array<{ id, name, orderPosition, evaluatedByMe: boolean, evaluationCount: number }>, complete: boolean, resultsPublished: boolean, unresolvedTies: number }` |
| GET | `/api/judge/ties` | – | `{ complete: boolean, ties: TieGroup[] }` — current relevant tie groups (also before scoring is complete; `complete` tells the UI the groups may still change). |
| PUT | `/api/judge/ties` | `{ groupKey, teamIds: string[] }` (permutation of that group, best first) | `{ tie: TieGroup }`. 404 if `groupKey` is not a current relevant tie group; 400 `VALIDATION` if not an exact permutation; 403 `RESULTS_PUBLISHED` after publish. |

### Judge or admin
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/results/publish` | `{ force?: boolean }` (force only honored for admin) | `{ publishedAt }`. 409 `RESULTS_PUBLISHED` if already. 409 `INCOMPLETE` with `pending` count unless every team has an evaluation from every active judge (or admin force). Then 409 `TIES_UNRESOLVED` (with `ties`) if any relevant tie group is unresolved — applies to admin force too. 400 if no teams or no evaluations at all. |

### Admin
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/admin/overview` | – | `{ teams, participants, judges, evaluations, expectedEvaluations, missingPhotos, missingPosters, registrationOpen, orderGenerated, orderGeneratedAt, resultsPublished, resultsPublishedAt, emailConfigured }` |
| GET | `/api/admin/teams` | – | `{ teams: Array<Team & { members: Member[], evaluationCount: number, average: number|null, missingPhotos: number }> }` |
| DELETE | `/api/admin/teams/:id` | – | `{ ok: true }`; 409 if team has evaluations. Deletes participants, sessions, image. |
| POST | `/api/admin/registration` | `{ open: boolean }` | `{ registrationOpen }`. Re-opening clears the order (positions NULL, order_generated_at deleted) and is refused (409) once any evaluation exists. |
| POST | `/api/admin/order/generate` | `{ force?: boolean }` | `{ generatedAt, teams: PublicTeam[] }`. If already generated: 409 unless `force`; a re-draw is refused (409) once any evaluation exists (the first draw is always allowed; after that use manual rearranging). 403 after publish. Closes registration. |
| PUT | `/api/admin/order` | `{ teamIds: string[] }` — must be exactly every team id once, in the desired presentation order | `{ generatedAt, teams: PublicTeam[] }`. Manual rearrangement by admin. Allowed any time before results are published (also after evaluations started — order never affects scores). If no order existed yet this creates it (sets `order_generated_at`, closes registration). 400 `VALIDATION` if ids missing/duplicated/unknown; 403 `RESULTS_PUBLISHED` after publish. |
| GET | `/api/admin/judges` | – | `{ judges: Array<Judge & { evaluatedCount }> }` |
| POST | `/api/admin/judges` | `{ name, username, password }` | `201 { judge }` (username 3–30 chars `[a-z0-9._-]`, lowercased, unique; password ≥ 6) |
| PATCH | `/api/admin/judges/:id` | `{ active?, password?, name? }` | `{ judge }`; deactivating also deletes that judge's sessions |
| GET | `/api/admin/leaderboard` | – | `{ criteria, teams: Array<{ rank, tied: boolean, team: PublicTeam, average, evaluationCount, criteriaAverages: Record<key, number>, evaluations: Evaluation[] }>, ties: TieGroup[] }` — all ranked teams, plus unranked (0 evals) at the end with `rank: null`. Read only. |

## 10. App (Expo) requirements

- Expo SDK 58, TypeScript strict, expo-router (file-based). Works on Android, iOS (Expo Go for dev), and web.
- API base: `process.env.EXPO_PUBLIC_API_URL`; if empty on web, use `window.location.origin` (same-origin Worker). Native builds must set it (documented in README / `.env.example`).
- Token storage: `expo-secure-store` on native, `localStorage` on web.
- Image picking: `expo-image-picker` → resize with `expo-image-manipulator` to max 1024 px wide, JPEG quality 0.7, base64.
- Look: **dark sci-fi HUD**. Near-black "void" background (#03060B) with a faint blueprint grid and vignette (`HudBackground`), translucent dark panels with thin cyan borders and corner brackets (`HudFrame`), plasma-cyan accent (#4BE3FF) with amber highlights (#FFB547), Chakra Petch for text and JetBrains Mono for codes, numbers and `// SECTION` labels. Restrained: no rainbow gradients, no emoji, no marketing copy.
- **Home screens are a "command deck"**: a phone-home-screen style grid of HUD module tiles (outlined icon chip, label, optional readout or amber alert badge), 3 columns on phones, 4–5 on tablets/desktop. Logout is a red outline bar below the grid.
- **Landing page** (`/welcome`): a comic book cover: "Build it. Pitch it. Win it!" headline, a "KA-BUILD!" starburst and a speech bubble, Register / Team login / Judge login buttons, a five-panel "How it works" strip, the scoring criteria (from `/api/config`) as stickers, and a footer with the iPhone install hint, the Android APK link, "Tech Arena is made by robos.inc" and the Organisers link. Same code on web and native.
- **Boot screen**: full-screen boot sequence (rotating HUD rings around the TA monogram, typed status lines, progress bar) shown at launch until fonts and the saved session are ready (min 1.7 s; once per tab session on web).
- OTP-style components: `CodeDisplay` (4 big digit boxes, read-only) and `OtpInput` (4 boxes, numeric keypad, auto-advance, backspace goes back, paste support).
- Score entry: per criterion a row of tappable numbers 0..max (big buttons), live total, optional remarks, Submit → confirm dialog "Scores are final and cannot be edited" → POST. Works with web `window.confirm` fallback (React Native `Alert` with buttons does not work on web).
- Report: per judge card with each criterion score and total, average across judges, polling every 10 s while focused + pull to refresh, banner when a new evaluation arrives.
- Results: podium for top 3 (2nd, 1st, 3rd layout) with team image, name, project, average. Before publish: "Results not published yet".
- PWA (web): after `expo export -p web`, a post-export script injects `<link rel="manifest">`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, `apple-touch-icon`, `theme-color`, viewport `viewport-fit=cover` into `dist/index.html`, and writes `dist/manifest.webmanifest` + icons. `npm run build:web` runs export + this script.
- `eas.json` with `preview` profile building an APK and `production` profile; `app.json` with name "Tech Arena", slug `tech-arena`, Android package `com.techarena.app`, iOS bundle id `com.techarena.app`, light UI style.
- Admin login screen: username + password. Admin order screen: after an order exists, each row has up / down buttons and "Move to end"; changes are local until "Save order" (confirm) → `PUT /api/admin/order`. Show a note: "Rearranging only changes who presents when. Scores can't be changed by anyone." Admin screens never show any score edit control.
- Judge Progress screen: when evaluations are complete and `/api/judge/ties` returns groups, show a "Tie-break needed" card per group above the Publish button: the tied teams (image, name, average), up/down buttons to order them (prefilled with my ordering, else name order), "Submit my order", and each judge's status (not submitted / submitted — with their order shown) plus "Resolved" or "Judges disagree — discuss and resubmit". Publish is disabled until `unresolvedTies === 0`. Admin leaderboard shows `=` before shared ranks and a "Tie — judges must decide" badge; admin has no tie controls.
- Profile photo gate: a shared `PhotoGate` in the root layout — when `session.needsPhoto` is true, every route except logout renders a full-screen "Add your profile photo" step (round preview, "Take photo" via camera + "Choose from gallery", square crop, resize to 512 px, JPEG 0.7) → `PUT /api/me/photo` → refresh session. Registration form has a required round profile-photo picker for the lead; add-member form has an optional one. Show round avatars (photo or initials fallback) everywhere people appear: team members list, team home header, judge's team card (all members' photos, large on iPad), report cards (judge photo), results podium (member avatars), admin teams (with a "missing photo" badge) and admin judges.

## Team colours, auto poster, sealed scores and app ratings

- **Team colours** (`GET /api/team-colors`, `PUT /api/team/color`): 32 named colours. A team picks one at registration (`color` in `POST /api/teams/register`); a colour can belong to only one team (unique index, `409` with `fields.color` when taken). The lead can switch to any free colour later. The colour drives the team banner and the auto poster.
- **Auto poster**: when a team has not uploaded a poster, the app draws one from the team's project title, description (fits the full 1000 characters), project image, members (up to 5, with photos) and colour. It is rendered live, so edits and new teammates show immediately. `DELETE /api/team/poster` drops an uploaded poster to go back to the auto one (same lock as uploading: until the team is first scored).
- **Sealed scores**: `GET /api/team/report` returns `scoredCount` always, but `evaluations` and `average` only after results are published.
- **App ratings** (`GET/PUT /api/rating`, `GET /api/admin/ratings`, public `GET /api/rating/badge`): one 1-5 star rating (+ optional feedback) per team member or judge, changeable later. Team members are asked once their team has teammates; judges after their first score. The badge endpoint is a shields.io endpoint used by the README.
