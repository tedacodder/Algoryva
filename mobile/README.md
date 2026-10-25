# Algoryva mobile (Android)

Phase 2 scaffold: an Expo (React Native, SDK 58) app with expo-router, SQLite and secure-token dependencies, a typed API client,
and a status screen that proves the phone can reach the Algoryva API. Learning screens, offline storage and sync come in later phases.

Android package id: `com.tedacodder.algoryva` (permanent once published).

## Requirements

- Node 20 or newer (tested with Node 22).
- Expo Go from Google Play, the version that matches SDK 58.
- For the API, the website repo running locally (see "Pointing at a local API"), or the default production URL.

## Run it on your phone

```bash
cd mobile
npm ci
npx expo start
```

Scan the QR code with Expo Go. The phone and the computer must be on the same Wi-Fi network.

On an Android emulator instead: `npx expo start --android`.

## Which API the app uses

The app reads one public setting, `EXPO_PUBLIC_API_URL`. Anything with the `EXPO_PUBLIC_` prefix is compiled into the app, so it
must never contain a secret. If it is not set, the app uses `https://algoryva.vercel.app`.

**Important:** the production site does not serve `/api/v1` until the Phase 1 branch (`mobile-phase1`) is merged and deployed. Until then the
status screen will report an error from the production URL. That is expected.

### Pointing at a local API

A phone cannot reach your computer's `localhost`. Use your computer's LAN address:

1. Start the website on all interfaces, from the website repo: `npm run dev -- -H 0.0.0.0`
2. Find your computer's address: `ip addr` (Linux), `ipconfig` (Windows), or `ifconfig` (macOS). Use the `192.168.x.x` or `10.x.x.x` value.
3. Start Expo with that address:
   ```bash
   EXPO_PUBLIC_API_URL=http://192.168.1.50:3000 npx expo start --clear
   ```
   (Windows PowerShell: `$env:EXPO_PUBLIC_API_URL="http://192.168.1.50:3000"; npx expo start --clear`)

On the Android emulator, use `http://10.0.2.2:3000` instead; that address reaches the computer's localhost.

Plain `http://` is accepted only in development and only for a local or LAN address. Production builds must use `https://`.
If a plain-http request is blocked on your phone, use a deployed preview URL (https) instead.

## Design (matches the website)

- **Colours:** the website's own tokens (src/app/globals.css), in light ("paper") and dark ("ink"). Light is the default. Settings →
  Appearance chooses System (default), Light or Dark, and the choice is saved on the device.
- **Typefaces:** Bricolage Grotesque for text and JetBrains Mono for code, the same fonts as the website.
- **Icons:** the website's icon set, drawn with SVG.
- **Lessons:** the same sections, tinted boxes, icon labels, code blocks with syntax colours and copy button, quiz and cheat sheet as the
  website. Custom lessons use the website's `## Heading` format, one code sample per section.
- **Learn:** topics grouped by level, with the same level colours and the same states (completed, up next, available, locked, coming soon).

Where the phone differs from the website, on purpose:

- The website's three-column lesson page (contents, lesson, "where you are") is stacked into one column on a phone.
- The website's sidebar becomes a home screen with links and a stack header.
- The quiz is scored by the server when the phone is online; the phone does not hold the answers.
- Touch targets are 44 points (the website's buttons are 40px).
- The website's variable-width heading style (font-stretch) is not available in React Native; headings use the regular widths.

## Tests

```bash
npm test          # 220 logic tests (Node test runner): rules, database, sync engine, account flows, judging, visualizations
npm run test:ui   # 29 component tests (Jest + React Native Testing Library): answer form, quiz, player, lesson, sync badge, account form
npm run test:all  # both of the above
npm run e2e:offline   # end-to-end: study offline, reconnect, check sync. Needs a phone or emulator, adb, Maestro, and the website running
```

What these do and do not cover:

- The logic tests run against a real SQLite database, so the SQL, transactions, rollback and cascades are real.
- The component tests render the real screens. They use a test double for the sync runtime and the session, so they check what each screen shows.
- `npm run e2e:offline` has been written but NOT run. It needs a device, so it is the next thing to run after the phone test.

## Checks

```bash
npm run typecheck        # strict TypeScript
npm run lint             # expo lint (ESLint with eslint-config-expo)
npm test                 # API client and config unit tests (Node test runner)
npm run doctor           # expo-doctor (needs internet access to Expo services)
npm run check:android-bundle   # Metro bundle for Android; confirms the app compiles
```

## What the app does now (Phases 3 and 4)

- **Offline content.** The first run downloads the content once into a local database. Later launches send the stored ETag, and
  a 304 means nothing is downloaded. Lessons, visualizations and problem statements work with no connection.
- **Learning offline.** Completing a topic, submitting quiz answers, marking an external problem solved, and writing or deleting notes
  and mistakes all work offline. Each change is saved on the device and queued in an outbox, in one step.
- **Sync.** The app sends the queued changes and then downloads a complete snapshot of your account. It runs when the app opens, when
  the connection returns, and every three minutes while signed in. Failures retry with exponential backoff and jitter, up to ten
  minutes apart. A server rejection (for example a review that is not due) is removed from the queue and shown on the Account screen.
  Other 4xx errors stop retrying and show the message.
- **Signing in.** Signing in never merges silently. If this device has unsent changes and the account already has data, the app asks:
  combine both, or use the account and discard the unsent changes. Otherwise the account's data simply comes to the device.
- **Signing out.** Account data leaves the device. If changes are unsent, the app asks whether to keep them on the device or discard them.
- **Deleting the account.** Removes the account on the server and everything on the device.
- **Quizzes.** Answers are stored and sent. The server scores them and the best score appears after a sync.
- **Visualizations.** The website's 57 lesson visualizations and 37 interactive algorithms run on the phone.

- **Judging offline (Phase 5).** Paste the output for each test on a problem and submit. The answer is saved on the phone and checked
  by the server when you are online. Only the server's verdict is shown; the phone never shows "accepted" on its own. The server
  compares the text you pasted; it does not run your code. Sign in to get answers checked.

Full app (Phase 6):

- **Home:** continue learning (the next unlocked topic), review due (when revisits are due), and the sync status.
- **Notes and mistakes:** add, read and delete. Mistakes use the same categories and checks as the website.
- **Review due:** site problems open the problem; outside problems can be marked done with a short explanation.
- **Account:** sign in or create an account (with basic checks before the server's), sync status, sign out, delete account.
- **Settings:** what is stored on the device, the privacy policy, clearing data on the device (only when signed out), and about.
- **Accessibility:** every control has a screen-reader label and a touch target of at least 48 points. Text follows the system font size.

Not yet checked on a device: TalkBack reading order and font scaling. Those need a phone test.

Still to come:


## Tests

```bash
npm test          # 220 logic tests (Node test runner): rules, database, sync engine, account flows, judging, visualizations
npm run test:ui   # 29 component tests (Jest + React Native Testing Library): answer form, quiz, player, lesson, sync badge, account form
npm run test:all  # both of the above
npm run e2e:offline   # end-to-end: study offline, reconnect, check sync. Needs a phone or emulator, adb, Maestro, and the website running
```

What these do and do not cover:

- The logic tests run against a real SQLite database, so the SQL, transactions, rollback and cascades are real.
- The component tests render the real screens. They use a test double for the sync runtime and the session, so they check what each screen shows.
- `npm run e2e:offline` has been written but NOT run. It needs a device, so it is the next thing to run after the phone test.

## Checks

```bash
npm run typecheck        # strict TypeScript
npm run lint             # expo lint (ESLint with eslint-config-expo)
npm test                 # API client and config unit tests (Node test runner)
npm run doctor           # expo-doctor (needs internet access to Expo services)
npm run check:android-bundle   # Metro bundle for Android; confirms the app compiles
```

## What the app does now (Phase 3)

- **Offline content.** On first run the app downloads the full content once and stores it in a local SQLite database. After that,
  lessons, visualizations and problem statements work without a connection. Later launches send the stored ETag; when nothing changed the
  server answers 304 and nothing is downloaded.
- **Offline without first download.** A first run with no connection shows "Connect to the internet once", and retries on demand.
- **Lessons.** Every section kind the website uses is rendered natively: text, code, tables, steps, complexity, cheat sheet, summary.
  Custom published lessons are shown as Markdown (headings, lists, paragraphs).
- **Visualizations.** The website's 57 lesson visualizations and 37 interactive algorithms run on the phone (the same generator code,
  ported without changes apart from import paths). Each can be played, paused and stepped; the interactive ones accept your own input.
- **Problems.** Statements, limits and sample tests are readable offline.

What is deliberately not in this phase:

- Quiz answers are recorded on the device but **not scored**. The server scores quizzes, and scoring arrives with sync (Phase 4).
- Problem **submission is not wired**. Judging needs the server, so it arrives with the outbox and sync (Phase 5).
- Progress, notes, mistakes and solves are **not saved** yet. Their tables exist and are filled by Phase 4.
- Sign-in screens are not built yet (Phase 6). The token storage and the 401 sign-out already work.

## Tests

```bash
npm test          # 220 logic tests (Node test runner): rules, database, sync engine, account flows, judging, visualizations
npm run test:ui   # 29 component tests (Jest + React Native Testing Library): answer form, quiz, player, lesson, sync badge, account form
npm run test:all  # both of the above
npm run e2e:offline   # end-to-end: study offline, reconnect, check sync. Needs a phone or emulator, adb, Maestro, and the website running
```

What these do and do not cover:

- The logic tests run against a real SQLite database, so the SQL, transactions, rollback and cascades are real.
- The component tests render the real screens. They use a test double for the sync runtime and the session, so they check what each screen shows.
- `npm run e2e:offline` has been written but NOT run. It needs a device, so it is the next thing to run after the phone test.

## Checks

```bash
npm run typecheck              # strict TypeScript
npm run lint                   # expo lint (ESLint with eslint-config-expo)
npm test                       # 227 tests: API client, config, database migrations, content storage and refresh (real SQLite),
                               #   and every lesson and interactive visualization producing drawable frames
npm run doctor                 # expo-doctor (needs internet access to Expo services)
npm run check:android-bundle   # Metro bundle for Android; confirms the app compiles
```

## Source layout

- `src/app/` — routes. `_layout.tsx` opens the database, refreshes the content and shows the startup states.
- `src/lib/db/` — database interface (`sql.ts`), versioned migrations (`migrations.ts`), phone database opener (`open.ts`).
- `src/lib/content/` — stored content (`repository.ts`), ETag refresh with offline fallback (`refresh.ts`), startup (`bootstrap.ts`).
- `src/lib/api/` — typed client for `/api/v1`, with error classes that separate offline from a server answer.
- `src/lib/auth/session.ts` — bearer token in secure storage only.
- `src/lib/viz/` and `src/lib/visualizer/` — the visualization engine, ported from the website (pure TypeScript).
- `src/components/viz/` — native renderers for arrays, graphs (SVG) and tables, and the player.
- `src/components/lesson/` — lesson view and Markdown for custom lessons.

## Known limits

- The sync rules were checked with tests against a scripted server and a real SQLite database. They have not been run against a live
  Algoryva server from a phone. Please try: go offline, complete a topic, reconnect, and check the website shows it.
- The local rules (unlocks, review schedule, mistake checks) are copies of the website's rules. If the website's rules change, update
  `src/lib/rules/` too. The server always makes the final decision.
- Sync errors you saw on the Account screen are kept only until the app restarts.
- Quiz scores and review timing come from the server, so an offline review shows as "not yet" until it syncs.

- Icons and splash art are placeholders. Replace the files in `assets/` before release.
- Layout and performance have been checked by tests and a bundle build, not on a phone yet. Please test the Visualizer on a mid-range
  device; large grids (the Floyd–Warshall table) need scrolling and may feel slow on very old phones.
- The graph layout uses the website's coordinates, scaled to the phone width. Very dense graphs may have small labels.
- Custom lesson Markdown is a simplified renderer (no links, images or tables).
- Phase 2 checks that still need a device or internet: `expo-doctor`'s schema and Directory checks, and running in Expo Go.
- `npm audit` reports vulnerabilities in transitive dependencies of the Expo toolchain. Not fixed in this phase.
