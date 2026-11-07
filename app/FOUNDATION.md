# Tech Arena app: foundation guide for feature agents

Expo SDK 58, React 19, RN 0.88, expo-router (routes in `src/app`), TypeScript strict. Path alias `@/*` → `src/*`.
SPEC: `../SPEC.md` (source of truth).

## Rules

1. **Do not edit shared files**: `src/api/*`, `src/auth/*`, `src/hooks/*`, `src/lib/*`, `src/components/*`, `src/theme.ts`, `src/app/_layout.tsx`, `src/app/index.tsx`, `src/app/welcome.tsx`, `src/app/{team,judge,admin}/_layout.tsx`, `src/features/shared/PlaceholderScreen.tsx`. If something is missing, build it locally in your feature folder and report it.
2. Put feature-specific components in `src/features/<team|judge|admin>/`.
3. **Do not install packages.** Everything you need is installed (see list at the end).
4. Only overwrite the route files you own (map below). Every route file must `export default` a component.
5. Verify with `npx tsc --noEmit` (must stay clean). `npm run build:web` must keep working.
6. Never hard-code criteria. They come from `/api/config` (`useConfig()`) or the report/leaderboard payload.
7. Use `confirm()` from `@/lib/dialogs` for confirmations. React Native `Alert` buttons do not work on web.
8. Screens use the custom `<Screen>` header. The Stack header is hidden (`headerShown: false`).

## Route ownership

| Owner | Files (`src/app/...`) |
|---|---|
| Foundation (done) | `_layout.tsx`, `index.tsx` (role redirect), `welcome.tsx`, `team/_layout.tsx`, `judge/_layout.tsx`, `admin/_layout.tsx` (role guards) |
| TEAM | `register.tsx`, `login.tsx`, `team/index.tsx`, `team/code.tsx`, `team/members.tsx`, `team/notify.tsx`, `team/edit.tsx`, `team/password.tsx`, `team/queue.tsx`, `team/report.tsx`, `team/results.tsx`, plus `src/features/shared/QueueView.tsx` and `src/features/shared/ResultsView.tsx` |
| JUDGE | `judge-login.tsx`, `judge/index.tsx`, `judge/enter-code.tsx`, `judge/evaluate/[teamId].tsx`, `judge/queue.tsx`, `judge/my-evaluations.tsx`, `judge/progress.tsx`, `judge/results.tsx` |
| ADMIN | `admin-login.tsx`, `admin/index.tsx`, `admin/teams.tsx`, `admin/judges.tsx`, `admin/order.tsx`, `admin/leaderboard.tsx`, `admin/results.tsx` |

`QueueView` and `ResultsView` (`src/features/shared/`) take **no props** and render a **complete screen, including `<Screen>`**. The TEAM agent implements them. `team|judge/queue.tsx` and `team|judge|admin/results.tsx` already just `return <QueueView />` / `<ResultsView />`. Inside them, use `useAuth().role` for role-specific touches. Keep them to calls every role may make (`api.order()`, `api.results()`).

Guards: `team/*` needs role lead|member, `judge/*` needs judge, `admin/*` needs admin. Anyone else is redirected to `/`, which sends them to their home (`/team`, `/judge`, `/admin`) or `/welcome`. A login screen only has to:

```ts
const session = await api.login({ phone, password });
await signIn(session);
router.replace('/'); // index redirects to the role's home
```

Logging out: `await signOut(); router.replace('/');`. The guards also redirect on their own once the session is gone.

Navigation: `router.push('/team/members')`, `router.push({ pathname: '/judge/evaluate/[teamId]', params: { teamId, code } })`, `useLocalSearchParams<{ teamId: string; code?: string }>()`. Typed routes are off, so `Href` is a plain string or object.

## `@/api` (`src/api/client.ts`, `src/api/types.ts`)

Types: every SPEC §8 entity (`Role`, `Criterion`, `Member`, `Team`, `PublicTeam`, `Judge`, `Evaluation`, `Session`, `Scores`) plus request/response types: `AppConfig`, `RegisterRequest`, `LoginRequest`, `JudgeLoginRequest`, `AdminLoginRequest`, `MeResponse`, `QueueTeam`, `OrderResponse`, `ResultEntry`, `ResultsResponse` (union on `published`), `TeamResponse`, `UpdateTeamRequest/Response`, `AddMemberRequest/Response`, `ChangePasswordRequest`, `NotifyRequest`, `NotifyResult`, `NotifyStatus`, `NotifyResponse`, `ReportResponse`, `JudgeTeamByCodeResponse`, `SubmitEvaluationRequest`, `EvaluationResponse`, `MyEvaluationsResponse`, `ProgressJudge`, `ProgressTeam`, `ProgressResponse`, `PublishRequest/Response`, `AdminOverview`, `AdminTeam`, `AdminTeamsResponse`, `RegistrationResponse`, `GenerateOrderRequest/Response`, `AdminJudge`, `AdminJudgesResponse`, `CreateJudgeRequest`, `UpdateJudgeRequest`, `JudgeResponse`, `LeaderboardEntry`, `LeaderboardResponse`, `ImageMime`, `ImageUpload`, `ApiErrorCode`, `OkResponse`.

```ts
import { api, ApiError, isApiError, imageUri, getApiBaseUrl } from '@/api/client';
import type { Team, Evaluation } from '@/api/types';
```

| Function | Endpoint | Returns |
|---|---|---|
| `api.health()` | GET /api/health | `HealthResponse` |
| `api.config()` | GET /api/config | `AppConfig` (prefer `useConfig()`) |
| `api.register(body)` | POST /api/teams/register | `Session` |
| `api.login({ phone, password })` | POST /api/auth/login | `Session` |
| `api.judgeLogin({ username, password })` | POST /api/auth/judge-login | `Session` |
| `api.adminLogin({ username, password })` | POST /api/auth/admin-login | `Session` |
| `api.logout()` | POST /api/auth/logout | `OkResponse` (use `signOut()` instead) |
| `api.me()` | GET /api/me | `MeResponse` (use `refreshMe()`) |
| `api.updatePhoto({ imageBase64, imageMime })` | PUT /api/me/photo | `UpdatePhotoResponse` (then `refreshMe()`) |
| `api.order()` | GET /api/order | `OrderResponse` |
| `api.results()` | GET /api/results | `ResultsResponse` |
| `api.team()` | GET /api/team | `TeamResponse` |
| `api.updateTeam(body)` | PUT /api/team | `UpdateTeamResponse` |
| `api.addMember(body)` | POST /api/team/members | `AddMemberResponse` |
| `api.removeMember(memberId)` | DELETE /api/team/members/:id | `OkResponse` |
| `api.changePassword({ currentPassword, newPassword })` | POST /api/team/password | `OkResponse` |
| `api.notify({ password, memberIds? })` | POST /api/team/notify | `NotifyResponse` |
| `api.report()` | GET /api/team/report | `ReportResponse` |
| `api.judgeTeamByCode(code)` | GET /api/judge/teams/by-code/:code | `JudgeTeamByCodeResponse` |
| `api.submitEvaluation({ teamId, code, scores, remarks? })` | POST /api/judge/evaluations | `EvaluationResponse` |
| `api.myEvaluations()` | GET /api/judge/evaluations | `MyEvaluationsResponse` |
| `api.progress()` | GET /api/judge/progress | `ProgressResponse` |
| `api.judgeTies()` | GET /api/judge/ties | `JudgeTiesResponse` |
| `api.voteTie({ groupKey, teamIds })` | PUT /api/judge/ties | `TieVoteResponse` |
| `api.publishResults({ force? })` | POST /api/results/publish | `PublishResponse` |
| `api.adminOverview()` | GET /api/admin/overview | `AdminOverview` |
| `api.adminTeams()` | GET /api/admin/teams | `AdminTeamsResponse` |
| `api.adminDeleteTeam(teamId)` | DELETE /api/admin/teams/:id | `OkResponse` |
| `api.setRegistration(open)` | POST /api/admin/registration | `RegistrationResponse` |
| `api.generateOrder({ force? })` | POST /api/admin/order/generate | `GenerateOrderResponse` |
| `api.setOrder({ teamIds })` | PUT /api/admin/order | `GenerateOrderResponse` |
| `api.adminJudges()` | GET /api/admin/judges | `AdminJudgesResponse` |
| `api.createJudge({ name, username, password })` | POST /api/admin/judges | `JudgeResponse` |
| `api.updateJudge(judgeId, { active?, password?, name? })` | PATCH /api/admin/judges/:id | `JudgeResponse` |
| `api.leaderboard()` | GET /api/admin/leaderboard | `LeaderboardResponse` |

Errors: every failure throws `ApiError { status, code, message, fields?, pending?, ties?, isNetwork }`. `code` is one of the SPEC codes or `'NETWORK'` (offline, timeout after 20 s, or no `EXPO_PUBLIC_API_URL` on native). `fields` holds per-field messages for VALIDATION/CONFLICT. `pending` comes with 409 INCOMPLETE on publish.

```ts
try { await api.submitEvaluation(body); }
catch (e) {
  if (isApiError(e) && e.code === 'ALREADY_EVALUATED') { /* ... */ }
  setErrors(fieldErrors(e)); setFormError(errorMessage(e));
}
```

401 handling: any 401 on an authenticated call signs the user out automatically, except `notify` and `changePassword`, where 401 means the re-entered password was wrong. Show that as a form error.

Images: `imageUri(team.imageUrl)` turns `/api/images/<id>` into an absolute URL (or null). `<TeamImage url={team.imageUrl} />` already does this.

## `@/auth`

```ts
import { useAuth } from '@/auth/AuthContext'; // or '@/auth'
const { session, role, loading, signIn, signOut, refreshMe } = useAuth();
```

- `session: Session | null`: `{ token, role, member?, team?, judge?, needsPhoto }`. `PhotoGate` (`@/auth/PhotoGate`, mounted in the root layout) covers every screen with the "Add your profile photo" step while `needsPhoto` is true. `role: Role | null`. `loading` is true only during the restore at app start.
- `signIn(session)`: store the session from register/login. `signOut()`: revoke it on the server (best effort) and clear it locally. `refreshMe(): Promise<Session | null>`: re-fetch `/api/me`, e.g. after editing the team.
- `homeFor(role)` (`@/auth/routes`) gives the home `Href` for a role. `RoleGuardedStack` is used by the layouts.
- `storage` (`@/auth/storage`) is a small key/value store with `get/set/remove`: SecureStore on native, localStorage on web.

## `@/hooks`

```ts
import { useApi, useAsync, usePolling, useConfig } from '@/hooks';
```

- `useAsync(fn, deps, { enabled?, refetchOnFocus? })` returns `{ data, error: ApiError|null, loading, refreshing, refresh, reload, setData }`.
  - `loading` is true only while there is no data yet. `refresh()` sets `refreshing` (bind it to pull-to-refresh). `reload()` refetches silently (polling, after a mutation). `error` is kept next to the old `data`.
- `useApi(fn, deps = [], opts)` is the same as `useAsync` with `refetchOnFocus: true`. Use it for most screens.
- `usePolling(fn, intervalMs, enabled = true, { immediate? })` runs `fn` every interval **only while the screen is focused** and the browser tab is visible. Overlapping calls are skipped.
- `useConfig()` returns `{ config: AppConfig|null, loading, error, refresh }`. The cache is shared app-wide, refetched on mount when it is more than 30 s old, and `refresh()` forces a refetch. `fetchConfig(force)` is the same outside React.

Typical screen:

```tsx
export default function ReportScreen() {
  const { data, error, loading, refreshing, refresh, reload } = useApi(() => api.report());
  usePolling(reload, 10_000);
  if (loading) return <Screen title="Report"><LoadingView /></Screen>;
  if (!data) return <Screen title="Report"><ErrorView error={error} onRetry={refresh} /></Screen>;
  return (
    <Screen title="Report" refreshing={refreshing} onRefresh={refresh}>
      {error ? <Banner type="error" message={error.message} /> : null}
      {/* ... */}
    </Screen>
  );
}
```

## `@/lib`

```ts
import { confirm, alert, notify, errorMessage, fieldErrors, toApiError, formatDateTime, formatScore,
  formatAverage, ordinal, plural, formatPhone, isPlausiblePhone, isPlausibleEmail, pickImage, toImageUpload,
  smsTo, whatsappTo, whatsappUrl, copyToClipboard, openUrl, tapFeedback, successFeedback, errorFeedback } from '@/lib';
```

- **dialogs**: `confirm(title, message?, confirmText = 'OK', { cancelText?, destructive? }) → Promise<boolean>` uses `window.confirm` on web. `alert(title, message?) → Promise<void>`. `notify` is an alias of `alert`.
- **errors**: `errorMessage(e): string`, `fieldErrors(e): Record<string,string>`, `toApiError(e): ApiError`.
- **format**: `formatDateTime(iso)`, `formatDate(iso)`, `formatTime(iso)`, `formatRelative(iso)` ("5 min ago"), `formatScore(n, digits=2)` ("41.5", "—" for null), `formatAverage(n)` ("41.50"), `formatOutOf(n, max)` ("37 / 50"), `ordinal(1)` ("1st"), `plural(3,'team')` ("3 teams"), `initials(name)`.
- **phone**: `formatPhone('+919876543210')` gives "+91 98765 43210". Also `phoneDigits(s)`, `isPlausiblePhone(s)` and `isPlausibleEmail(s)`. These are light client checks; the server is authoritative.
- **image**: `pickImage('library' | 'camera') → Promise<PickedImage | null>` (null when cancelled). It resizes to 1024 px wide as JPEG at quality 0.7 with base64, and retries smaller if the result is over 1.5 MB. It throws `ImagePickError` with a friendly message. `PickedImage = { uri, base64, mime, width, height, sizeBytes }`. `toImageUpload(img)` returns `{ imageBase64, imageMime }`, ready to spread into register/updateTeam. Also exported: `compressImage(uri, maxWidth?, quality?)`, `MAX_IMAGE_BYTES`.
- **share**: `smsTo(phone, body)` uses expo-sms, falling back to an `sms:` link. `whatsappTo(phone, body)` opens `https://wa.me/<digits>?text=` (`whatsappUrl` builds the URL only). `copyToClipboard(text) → Promise<boolean>`. `openUrl(url)`.
- **haptics**: `tapFeedback()`, `successFeedback()`, `errorFeedback()`. They do nothing on web.

## `@/theme`

`colors` (paper `bg`, white `card` panels, ink `border`, red `accent` for actions, yellow `highlight`, status colors, podium `gold/silver/bronze`), `palette` (raw hex: paper, ink, red, yellow, blue, green, pink, purple…), `withAlpha(hex, a)`, `spacing`, `radius` (friendly: sm 8 … xl 18), `ink` (outline widths: thin 2, thick 3), `hardShadow(offset?, color?)` (unblurred offset shadow; iOS and web only), `fonts` (`display` = Bangers, Space Grotesk per weight, JetBrains Mono), `fontForWeight(weight, family?)`, `typography` (largeTitle/title1/title2/sectionHeader are Bangers; the rest Space Grotesk), `shadow` (hard shadows), `layout`. Old names (`systemColors`, `gradients`, `textGlow`) still compile.

## Design rules (comic book)

1. Every screen sits on `HudBackground` (Screen does this for you): warm paper with a faint halftone dot screen.
2. Panels = `Card`: white, thick ink outline, rounded corners, hard offset shadow. `tone` adds a colored band along the top.
3. Shouty text (titles, section labels, buttons, tile labels) uses the Bangers display face. Reading text, labels and form fields use Space Grotesk.
4. Numbers, codes and scores use the bold sans, never Bangers (in Bangers a 7 reads like a 1). `AppText` does this automatically for numeric strings in display variants.
5. Buttons: `primary` red with an ink outline and hard shadow that presses in on tap, `secondary` white, `success` green, `danger` white with red text, `ghost` underlined link. Disabled buttons turn flat grey with a dashed outline.
6. Home screens: `HomeGrid` + `AppTile` = white comic panels with a colored icon sticker, a Bangers label, `value` readout and red `badge`. Logout tiles become an outlined bar under the grid. Grid titles are tilted yellow caption boxes.
7. Decoration: `Burst` (`@/components/comic/Burst`) for starbursts; `HudEmblem` puts an icon on a small burst (login screens); `BootOverlay` is the "TECH ARENA!" burst intro.
8. Images: `TeamImage` for project images, `PosterView` for portrait posters (tap = full screen), `Avatar` for people.
9. Never hard-code colors or fonts; never set `fontWeight` directly (Android ignores it on custom fonts) — use `AppText weight` or `fontForWeight`.
10. Android has no hard shadows; the ink outlines carry the look there.

## `@/components`

```ts
import { Screen, AppText, Button, TextField, Card, HomeGrid, AppTile, CodeDisplay, OtpInput, ScoreSelector, Banner,
  EmptyState, LoadingView, ErrorView, ImagePickerField, Badge, Divider, KeyValue, StatTile, StatRow, SectionTitle,
  TeamImage, Avatar, ScreenHeader, goBack, type IconName } from '@/components';
```

| Component | Props |
|---|---|
| `Screen` | `title?, subtitle?, back? = true, backHref? = '/', backLabel? = 'Back', right?: ReactNode, header?` (auto), `largeTitle?` (default `!back`), `scroll? = true, refreshing?, onRefresh?, padded? = true, maxWidth? = 900, contentStyle?, footer?: ReactNode` (pinned toolbar, e.g. Submit). iOS nav bar: blue "< Back", centered 17 pt title, `right` item. Home screens pass `back={false}` and get a 34 pt large title (plus `subtitle`) at the top of the content instead of a bar title. Handles safe area, keyboard and the centered column. |
| `AppText` | `variant?` (typography key), `color?` (theme color name or CSS color), `weight?, align?` and all `TextProps` |
| `Button` | `title, onPress?` (if it returns a promise, a spinner shows until it settles and taps are ignored), `variant?: 'primary'\|'secondary'\|'danger'\|'success'\|'ghost'`, `size?: 'sm'\|'md'\|'lg'`, `icon?, iconRight?, loading?, disabled?, fullWidth? = true, style?`. Buttons have no margin, so stack them in `<View style={{ gap: spacing.md }}>`. |
| `TextField` | `label?, error?, hint?, type?: 'text'\|'name'\|'email'\|'phone'\|'password'\|'number'\|'username'\|'multiline', icon?, containerStyle?, inputStyle?, ref?` and all `TextInputProps`. `password` gets an eye toggle. |
| `Card` | `children, onPress?, tone?` (accepted but no longer changes the look; show state with a Badge/Banner inside), `padded? = true, style?`. White, radius 10, no border/shadow, padding 16, margin-bottom 16. |
| `HomeGrid` | `children` (AppTiles), `title?` (section header), `footer?` (string or node under the group), `style?`. `columns` is ignored. Renders an inset-grouped list (Settings style), not a grid. |
| `AppTile` | `label, icon: IconName, gradient?: GradientName \| [from,to]` (first color used, flat) or `color?: string`, `href?, onPress?, badge?: number\|string\|true` (red count pill / dot on the right), `value?` (gray text on the right), `destructive?`, `disabled?`. A 44 pt row: 29 pt colored icon square, 17 pt label, chevron. |
| `CodeDisplay` | `code, length? = 4, size?: 'md'\|'lg'` (read-only big digit boxes) |
| `OtpInput` | `value, onChange(v), onComplete?(code), length? = 4, autoFocus?, disabled?, error?, size?, ref?: OtpInputHandle {focus, blur}`. Numeric keypad, auto-advance, backspace, paste and SMS autofill. |
| `ScoreSelector` | `label, description?, max, value: number\|null, onChange(n), disabled?`: white card with headline + footnote and a segmented-control row 0..max (44 pt segments, 52 pt on wide screens, wraps into balanced rows on phones), with "x / max" on the right |
| `Banner` | `type?: 'info'\|'success'\|'warning'\|'error', title?, message?, icon?, action?: {label,onPress}, onClose?` |
| `EmptyState` | `icon?, title, message?, action?: {label, onPress, icon?}` |
| `LoadingView` | `message?, fullScreen?` |
| `ErrorView` | `error?: unknown, title?, message?, onRetry?, fullScreen?` (offline-aware) |
| `ImagePickerField` | `label?, value: PickedImage\|null, onChange, existingUrl?` (relative server URL shown until replaced), `error?, hint?, disabled?` |
| `Badge` | `label, tone?: 'neutral'\|'accent'\|'violet'\|'success'\|'warning'\|'danger'\|'info'\|'gold'\|'silver'\|'bronze', icon?, size?` |
| `Divider` | `label?, spacing?` |
| `KeyValue` | `label, value: ReactNode, icon?, copyable?, copyText?, mono?, last?` |
| `StatTile` / `StatRow` | `label, value, icon?, tone?, hint?` / wrapping row container |
| `SectionTitle` | `title, action?: {label, onPress}` |
| `TeamImage` | `url` (relative or absolute), `size?` (square) or `aspectRatio? = 16/9`, `borderRadius?`. Shows a placeholder when there is no image or it fails to load. |
| `Avatar` | `name, size? = 40, photoUrl?` (photo, else white initials on gray, like Contacts) |

Example home screen:

```tsx
<Screen title={team.name} back={false} right={<Badge label="Lead" tone="accent" />}>
  <HomeGrid>
    <AppTile label="My Code" icon="keypad" color={colors.blue} href="/team/code" value="4821" />
    <AppTile label="Team" icon="people" color={colors.green} href="/team/members" />
  </HomeGrid>
  <HomeGrid title="Expo day">
    <AppTile label="Queue" icon="list" color={colors.orange} href="/team/queue" badge={3} />
  </HomeGrid>
  <HomeGrid>
    <AppTile label="Log Out" icon="log-out" onPress={onLogout} />
  </HomeGrid>
</Screen>
```

## Environment and build

- `EXPO_PUBLIC_API_URL` (see `.env.example`): leave it empty on web (same origin as the Worker). It is required on native, e.g. `http://<LAN-IP>:8787` for `wrangler dev`.
- Scripts: `npm start`, `npm run android|ios|web`, `npm run typecheck`, `npm run build:web` (export + `scripts/pwa-postexport.mjs`), `npm run icons` (regenerates the PNG icons: flat #007AFF square with a white "TA" monogram).
- Installed packages: expo-router, react-native-safe-area-context, react-native-screens, expo-linking, expo-constants, expo-status-bar, expo-secure-store, expo-image-picker, expo-image-manipulator, expo-sms, expo-clipboard, expo-haptics, expo-linear-gradient (do not use: no gradients), @expo/vector-icons (Ionicons: `import Ionicons from '@expo/vector-icons/Ionicons'`), react-native-web, react-dom, @expo/metro-runtime, expo-font, expo-system-ui, expo-splash-screen.
- RN 0.88 note: the type for a TextInput ref is `TextInputInstance` (`useRef<TextInputInstance>(null)`), not `TextInput`. `StyleSheet.absoluteFillObject` no longer exists; use `StyleSheet.absoluteFill`.
