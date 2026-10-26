# Algoryva mobile: store submission and device QA

Keep this file up to date when behaviour changes. The data-safety answers must match what the app really does.

## 1. Live content (blocks everything else)

The phone downloads lessons, quizzes and problems from `/api/v1/content`. Until that returns JSON on the live site, the app has no content.

- Check: `curl -s https://algoryva.vercel.app/api/v1/content | head -c 200` should print JSON, not an HTML page.
- If it prints HTML: the production branch on Vercel does not include the mobile routes. Make `mobile-phase1` the production branch, or merge it into `main`. Then redeploy.
- Migrations: run `npx prisma migrate deploy` against the production database after taking a backup.
- Check the problem count is above zero once the seed has run.

## 2. Device test checklist

Run on a real phone. Use a mid-range and a low-end device if you can.

- [ ] Fresh install: first launch needs internet; the first content download completes.
- [ ] Airplane mode: lessons, quizzes and the Visualizer work; Python Runner works after its first start.
- [ ] Complete a topic offline, go online, confirm it syncs (Account screen shows "Synced").
- [ ] Quiz: answers are marked straight away; the result is saved.
- [ ] Python Runner: reaches ready; run the sample; Stop restarts it; the draft survives leaving the screen.
- [ ] Visualizer: Run and Play both advance; the header shows once.
- [ ] Practice: the list fills after content downloads; external links open the browser.
- [ ] Account: sign up, sign out, sign in, delete account (test account only).
- [ ] Settings: privacy policy opens; crash reports can be shared and cleared.
- [ ] TalkBack: every button has a spoken label; quiz options read as "correct" or "not correct" after answering.
- [ ] Large text (Settings → Display → Font size, largest): no text is cut off on the main screens.
- [ ] Dark and light mode: readable in both.
- [ ] Rotation is locked to portrait; the keyboard does not hide the Python editor's Run button.

Maestro flows already in `e2e/maestro/`:

    maestro test e2e/maestro/01-study-offline.yaml
    maestro test e2e/maestro/02-after-reconnect.yaml

These need a connected device or emulator with the app installed.

## 3. Crash reports and analytics

- Crashes are recorded on the phone only (`crash-reports.json`, at most 20 reports).
- Emails, tokens, passwords and long identifiers are removed before storage.
- The user shares reports through the system share sheet. The app sends nothing automatically.
- No analytics SDK is included in this version. Add one only after a privacy review, with consent, and update the data-safety form.

## 4. Store submission

Before the production build:

- [ ] `app.json`: `android.versionCode` and `version` are correct for this release.
- [ ] `eas.json`: the production profile exists and `autoIncrement` is set for the version code. Restore it from git if it is missing from your working copy (`git checkout -- eas.json`).
- [ ] The privacy contact email is set in the website's `src/lib/privacy.ts`.
- [ ] Back up the upload keystore. Losing it means you cannot update the app.

Build:

    cd mobile
    eas build --platform android --profile production

Google Play:

- [ ] Create the app in Play Console and enable Play App Signing.
- [ ] Privacy policy URL: the live policy page.
- [ ] Listing: title, short and full description, icon, screenshots (phone), feature graphic.
- [ ] Content rating questionnaire.
- [ ] Data-safety form: use the draft below, then check it against the live app.
- [ ] Account deletion: the app has it in Account, and the website has it too. Declare the web link in the listing.
- [ ] Testing track: check the current Google Play requirements for new personal developer accounts in the Play Console before publishing. These requirements change, so do not rely on a remembered number of testers or days.

### Data-safety draft (verify before submitting)

- Data collected, linked to the account: email address, password (stored hashed on the server), learning progress, quiz and practice results, notes, mistakes, submitted answers.
- Data stored only on the device: drafts and saved Python programs, offline changes waiting to sync, crash reports (until the user shares them).
- Data shared with third parties: none.
- Data sold: no.
- Advertising or ad IDs: none.
- Location, contacts, photos, microphone, camera: not collected.
- Encryption in transit: yes (HTTPS only in production).
- Users can request deletion: yes, in the app and on the website.

Check each point against the server's actual storage before submitting.
