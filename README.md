# Tech Arena

Project expo app. Teams register and add teammates, the admin draws a random presentation order, judges score each team on an iPad by typing the team's 4-digit code, teams see their marks the moment a judge submits, and the judges publish the top 3 at the end.

- **Android**: APK built with EAS.
- **iPhone**: install from Safari: open the app link, tap Share, then **Add to Home Screen**. It runs full screen like a normal app. No App Store needed.
- **iPad (judges) / laptop (admin)**: same web app in the browser (or added to the home screen).
- **Backend**: one Cloudflare Worker (Hono + D1). The same Worker serves the API under `/api/*` and the web app for every other path.

The full behaviour and API contract is in [SPEC.md](SPEC.md).

The app uses a comic book look (paper, ink outlines, Bangers headlines). The landing page is plain React Native, so it is the same on web, iPhone and Android.

Built by **robos.inc**.

```
tech_arena/
  SPEC.md      product + API spec
  backend/     Cloudflare Worker (TypeScript, Hono, D1) + tests + demo scripts
  app/         Expo app (TypeScript, expo-router), builds Android APK and the web app
```

## How the expo day works

1. **Before the expo**: the team lead registers (name, USN, phone, email, profile photo, team name, project, project image, team password), uploads the **project poster** (now or later from the Poster tile), then adds teammates and taps **Send Logins**. Members get their login by email, or the lead sends it by SMS or WhatsApp from their own phone.
2. Every member installs the app and logs in with their phone number and the team password. Everyone must upload a profile photo before they can use the app.
3. **Admin** creates the 2 judge accounts and, on expo day, taps **Generate random order**. This closes registration. The admin can still rearrange the order by hand (for example, move an absent team to the end). The admin can't see or change any score controls.
4. **Judges** walk to a team, type the team's 4-digit code (shown on the team's **My Code** screen), check the team card, member photos and poster, score 5 criteria from 0 to 10 each, and submit. Scores are final: nobody can edit or delete them, the admin included.
5. The team's **Report** updates on its own when a judge submits.
6. When every team is scored, a judge taps **Publish Results**. If a tie touches the top 3, the judges who scored those teams pick the order on the Progress screen first. Publishing is blocked until they agree, and the admin cannot override it.
7. Everyone sees the top-3 podium under **Results**.

Criteria (each 0 to 10, so 50 per judge): Idea & Innovation, Working Model, Uniqueness, Impact & Feasibility, Presentation & Q&A. To change them, edit `backend/src/criteria.ts`; the app reads them from the server.

## Run it locally

Needs Node 20 or newer.

```bash
cd backend && npm install
```

```bash
cd app && npm install
```

Backend (local D1 database, admin password `admin123`):

```bash
cd backend && cp .dev.vars.example .dev.vars && npx wrangler d1 migrations apply tech-arena-db --local && npx wrangler dev --port 8787
```

Edit `.dev.vars` to set your own `ADMIN_PASSWORD` before you start it.

App in the browser, talking to that backend:

```bash
cd app && EXPO_PUBLIC_API_URL=http://localhost:8787 npx expo start --web
```

Demo data (2 judges `judge1` / `judge2` with password `judge123`, 6 teams with team password `demo1234`, order drawn):

```bash
cd backend && node scripts/seed-demo.mjs --base-url http://localhost:8787 --admin-password admin123
```

Admin login is username `admin` plus your `ADMIN_PASSWORD`.

### Tests

```bash
cd backend && npm run typecheck && npm test
```

`npm test` starts a real local Worker with a fresh database and runs the API test suite. `scripts/e2e-flow.mjs` plays a whole expo day against a running Worker.

```bash
cd app && npm run typecheck
```

## Deploy to Cloudflare

Do this once, from the `backend` folder.

1. Log in to Cloudflare:

   ```bash
   cd backend && npx wrangler login
   ```

2. Create the database:

   ```bash
   cd backend && npx wrangler d1 create tech-arena-db
   ```

   Copy the `database_id` it prints into `backend/wrangler.jsonc` (replace `REPLACE_WITH_YOUR_D1_DATABASE_ID`).

3. Create the tables:

   ```bash
   cd backend && npm run db:migrate:remote
   ```

4. Set the admin password (it asks you to type it):

   ```bash
   cd backend && npx wrangler secret put ADMIN_PASSWORD
   ```

5. Build the web app and deploy the Worker (the Worker serves `app/dist`):

   ```bash
   cd app && npm run build:web
   ```

   ```bash
   cd backend && npx wrangler deploy
   ```

   Wrangler prints your URL, for example `https://tech-arena.<your-subdomain>.workers.dev`. That is the link for iPhones, iPads and the admin.

6. Put that URL into `backend/wrangler.jsonc` under `vars.APP_URL` (it goes into the login emails), and deploy again.

To redeploy after changes, repeat step 5. If you change the database schema, add a new file in `backend/migrations/` and run `npm run db:migrate:remote`.

### Email (optional)

Without email the lead can still send logins by SMS or WhatsApp from the app. To send email:

1. Create a free account at [resend.com](https://resend.com) and verify a domain you own. The test sender `onboarding@resend.dev` only delivers to your own Resend email address.
2. Set the sender in `backend/wrangler.jsonc`, for example `"MAIL_FROM": "Tech Arena <expo@yourcollege.edu>"`.
3. Add the key and deploy:

   ```bash
   cd backend && npx wrangler secret put RESEND_API_KEY
   ```

   ```bash
   cd backend && npx wrangler deploy
   ```

The admin home shows whether email is configured.

### Other settings (`backend/wrangler.jsonc` → `vars`)

| Variable | Default | Meaning |
|---|---|---|
| `EVENT_NAME` | `Tech Arena` | Shown in the app and emails |
| `ADMIN_USERNAME` | `admin` | Admin login username |
| `DEFAULT_COUNTRY_CODE` | `91` | Added to 10-digit phone numbers |
| `MAX_TEAM_SIZE` | `5` | Team size including the lead |
| `APP_URL` | empty | Web app link put in login emails |
| `APK_URL` | empty | Android APK download link put in login emails and the app |
| `MAIL_FROM` | `Tech Arena <onboarding@resend.dev>` | Email sender |

## Build the Android APK

Uses Expo's build service (free account at [expo.dev](https://expo.dev)).

1. Put your Worker URL into `app/eas.json` for every profile (`EXPO_PUBLIC_API_URL`, replace `https://tech-arena.YOUR-SUBDOMAIN.workers.dev`).
2. Log in and build:

   ```bash
   cd app && npx eas-cli@latest login
   ```

   ```bash
   cd app && npx eas-cli@latest build -p android --profile preview
   ```

3. When it finishes, EAS gives a download link for the `.apk`. Share it with participants, and set it as `APK_URL` in `backend/wrangler.jsonc` so it appears in the login emails and on the welcome screen. Redeploy the Worker.

Android may ask to allow installing from unknown sources the first time.

## Install on iPhone

1. Open the app link in **Safari** (not Chrome).
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Open **Tech Arena** from the home screen and log in.

## Expo-day checklist

- [ ] Admin: create 2 judges (Judges screen), note their usernames and passwords.
- [ ] Judges: log in on the iPads once and add a profile photo.
- [ ] Check every team has its members, profile photos and poster uploaded (Admin home shows missing photos and posters; Admin → Teams shows which team).
- [ ] Admin: Generate random order (this closes registration).
- [ ] Teams: keep the **My Code** screen open at the stall.
- [ ] Judges: Enter Code → check team → score → submit, team by team.
- [ ] After the last team: judges resolve any tie on the Progress screen, then **Publish Results**.
