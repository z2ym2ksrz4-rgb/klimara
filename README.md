# Fodmara – IBS & low-FODMAP diary (built on the diary engine, copied from Tinnara)

Local-first mobile app skeleton: **React + TypeScript + Vite + Capacitor** (iOS and Android from one codebase).
No backend. SQLite on device, encrypted backup file for household sharing, local notifications, five languages,
RevenueCat-ready, and a release flag that compiles internal test tools out of store builds.

## What is where

| Path | Purpose |
|---|---|
| `app.config.json` | The only file that differs per app: id, name, colors, support/privacy URLs, RevenueCat keys |
| `src/core/db` | SQLite connection + versioned migrations (web uses sql.js via jeep-sqlite) |
| `src/core/settings` | Persisted settings store (zustand) incl. success-event counter for the review prompt |
| `src/core/i18n` | i18next with en/da/de/sv/nb; strings in `src/locales/*.json` |
| `src/core/backup` | Encrypted JSON dump: export via share sheet, import with newest-wins merge |
| `src/core/notifications` | Daily digest + per-item reminders, replanned on every start (max 60) |
| `src/core/purchases` | RevenueCat wrapper (annual w/ trial + lifetime), `useProGate()` for feature gating, web mock for dev |
| `src/core/review` | In-app review prompt after 2nd success event, 90-day cooldown |
| `src/app/onboarding` | 3-step onboarding → notification permission → paywall |
| `src/app/paywall` | Hard paywall sheet |
| `src/core/release` | `isRelease` / `appVersion`; wrap all internal UI in `if (!isRelease)` |
| `src/domain/<slug>` | The app itself: migrations, screens, reminder writers. `example/` shows the pattern |
| `codemagic.yaml` | iOS → TestFlight on tag `ios-v*`, Android → Play internal on tag `android-v*` |
| `scripts/new-app.mjs` | Rewrites config for a new app in one command |

## First time (template itself)

```bash
npm install
npm run dev            # web dev server at http://localhost:5173 (sql.js in browser)
npm run typecheck
```

## Start a new app from the template

```bash
git clone git@github.com:<account>/app-template.git furkeep && cd furkeep
rm -rf .git && git init
npm install
npm run new-app -- --slug furkeep --name "Furkeep" --id com.ilumie.furkeep --color "#4A6B57"
npx cap add ios && npx cap add android
mkdir -p src/domain/furkeep && cp -r src/domain/example/* src/domain/furkeep/   # then edit src/domain/index.ts
git add -A && git commit -m "Furkeep from template"
```

## Release

```bash
git tag ios-v1.0.0 && git push --tags       # Codemagic builds + uploads to TestFlight
git tag android-v1.0.0 && git push --tags   # Codemagic builds + uploads to Play internal track
```
`RELEASE=1` is set in both workflows, so the test menu and version banner never ship.
If tags don't trigger a build (some git proxies drop tag pushes silently), use **Start new build** in the Codemagic UI with branch `main` and the file workflow.

### Codemagic / App Store lessons (from Furkeep)

- **Signing**: the yaml names the provisioning profile and certificate explicitly (`ios_signing.provisioning_profiles` / `certificates`) and the Signing step runs `xcode-project use-profiles`. Create the App Store profile in the Apple dev portal first, then fetch it into Codemagic → Code signing identities.
- **`scripts/ios-postadd.sh`** runs right after `cap add ios`: sets `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`, `ITSAppUsesNonExemptEncryption=false`, and lifts the deployment target to iOS 15 (Apple rejects 14 with ITMS-90068; missing photo strings give ITMS-90683).
- **Build number**: never trust `get-latest-testflight-build-number` alone (it returned nothing and the upload was rejected as a duplicate). The yaml uses `max(latest in ASC + 1, PROJECT_BUILD_NUMBER + 10)` and sets the marketing version from `package.json`.
- **Store build vs. web build**: `RELEASE=1 npm run build` for stores; for Playwright screenshots use `RELEASE=0 NODE_ENV=development npx vite build --mode development` so `window.__seedDemo` exists.
- **SQLite**: all writes go through `dbWrite`/`dbRun`/`serialized` (`src/core/db`). React StrictMode double-fires effects and two overlapping `BEGIN`s give "cannot start a transaction within a transaction".
- **App Store Connect**: subscription descriptions are max 55 chars; the review contact needs a phone number; add TestFlight "Test information" before external testers; App Privacy must be *published* (not only saved) before Add for Review.
- **Widgets / app extensions** (see furkeep `plugins/widget-bridge`, `native/ios/NextUpWidget`, `scripts/ios-widget.rb`): the extension target is injected into the generated Xcode project with the `xcodeproj` gem in CI. It needs (1) an App Group created in the dev portal and assigned to BOTH App IDs (main + `<bundle>.widget`), (2) its own App Store provisioning profile fetched into Codemagic, (3) the main profile regenerated after the capability change (the old one goes Invalid). Codemagic's automatic signing did not create the extension profile for us — list both profiles explicitly. A local `file:` plugin's `dist/` must not be swallowed by a root `dist` ignore rule (use `/dist`). Pods: raise the Podfile platform to 15.5 and patch every pod target in `post_install` (ML Kit needs 15.5).
- **CSS gotcha**: a global `input { appearance:none }` (used to normalise iOS text fields) also hides every native checkbox/radio. Re-enable with `input[type=checkbox], input[type=radio] { appearance:auto }` or ship custom check styles.
- **Touch UX lessons from TestFlight feedback**: a searchable combo must collapse to a read-only chip once chosen (and close on pick, with `onPointerDown preventDefault` so iOS does not blur before the click); never `autoFocus` inside a bottom sheet (keyboard covers the form) — instead shift the sheet with `visualViewport` and scroll the focused field into view; every row that opens a detail should have its action buttons wrapped in a `stopPropagation` container; currency/locale defaults should follow the UI language unless the user overrides them.
- **Onboarding**: after creating a record, run a short skippable wizard (scan docs → pick tasks → accept plan) instead of a single long form; capture each photo once and reuse it (document archive + parsed fields).
- **Screenshots**: upload framed marketing images (`npm run screenshots:store`), never a paywall shot, and keep prices out of EN shots (web mock paywall shows DKK).

## RevenueCat setup (once per app)

1. app.revenuecat.com → new project → add iOS app (bundle id) and Android app (package name).
2. Products: `<slug>_annual` (auto-renewing, 7-day free trial) and `<slug>_lifetime` (non-consumable) in App Store Connect and Play Console.
3. Entitlement `pro` attached to both products; Offering `default` with packages `$rc_annual` and `$rc_lifetime`.
4. Paste the two public SDK keys into `app.config.json` → `revenueCat`.

`sql.js` is pinned to 1.12.0 because jeep-sqlite 2.8.0 bundles that glue; the postinstall copies the matching wasm to `public/assets/`.

## Rules baked in

- Every table has `id` (uuid) and `updatedAt` (ISO) so backup/merge works.
- Domain migrations start at version 100; core owns 1–99.
- No analytics SDKs. Store privacy label: "Data not collected" (RevenueCat purchase id excepted).
- Review prompt fires after the 2nd `successEvents`, at most once per 90 days (wire in week 2 with RevenueCat/paywall).

## Download stats (`scripts/stats.mjs`)
Daily/weekly downloads per app across App Store Connect (sales reports), Google Play (install CSVs from the
reporting bucket) and RevenueCat (overview metrics), mailed via Resend. Apps are listed in `scripts/stats-apps.json`
(`name`, `ascAppId`, `packageName`, `revenueCatProjectId`) – add a line per new app. Runs as the `stats` workflow in
`codemagic.yaml` on a schedule; `node scripts/stats.mjs --demo` renders the layout with fixture data.

## Fodmara specifics

- Copied from `migrano` (26 Oct 2026) because the symptom-diary engine is not ported to `app-template` yet. Only `src/domain/fodmara/`, the app shell texts (`src/app`), styles, locales, store material and native widget visuals differ.
- `src/core/diary/` — generic symptom-diary engine. New here (generic, port back): `checkinSeries`, `checkinMonthly`, `checkinContrast`, `checkinTrend` for conditions that are always present; `CheckinField.min`.
- `src/domain/fodmara/` — tinnitus configuration: daily loudness 0–10 (+ bother, sleep, stress, noise 1–5) is the core; episodes are "spikes"; tag groups sound/trigger/location/symptom/relief (seed migration 20, engine owns 10–19). No medication-day thresholds, no HealthKit.
- Locales are built: edit `scripts/i18n/<lang>.json` (overrides) and run `python3 scripts/i18n/build.py`; `node scripts/i18n/check-keys.mjs` verifies every `t("…")` key exists in all five languages.
- Red-flag info sheet (`redFlags.*`): when to see a doctor quickly. Keep it in every version.
- Smoke: `RELEASE=0 NODE_ENV=development npx vite build --mode development && npx vite preview --port 4173 & node smoke.mjs`
- Store material: `node scripts/screenshots.mjs && node scripts/store-frames.mjs && node scripts/paywall-shot.mjs`; site: `python3 scripts/site-gen.py ../fodmara-site`.

## Fodmara specifics

- Domain: `src/domain/fodmara` – migrations 20–24 (tags, customFood, meal/mealItem, stool, challenge), `data.ts` (meals, Bristol, reintroduction, meal→flare patterns), `foods.ts` **generated** from `scripts/i18n/foods.tsv` by `python3 scripts/gen-foods.py`.
- Locales: `python3 scripts/i18n/build.py` (base + overrides + food names), then `node scripts/i18n/check-keys.mjs` and `node scripts/i18n/check-dynamic.mjs`.
- Site: no own domain – `python3 scripts/site-gen.py` writes `../ilumie-site/fodmara/` (served at https://ilumie.com/fodmara/).
- Store: `node scripts/screenshots.mjs && node scripts/store-frames.mjs && node scripts/paywall-shot.mjs`, then delete the raw `*-N-name.png` captures (only `store-*` and `paywall-review.png` are committed).
