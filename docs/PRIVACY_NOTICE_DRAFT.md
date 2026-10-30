# Privacy notice: Algoryva Telegram bot (DRAFT)

> **This is a technical draft, not legal advice.** It describes what the code does. It must be reviewed by a qualified person before it is published. The contact details are placeholders and must be filled in. Until then, do not publish this notice or describe the bot as compliant with any law.

## Who we are

Algoryva, operated by [OWNER NAME], contact [CONTACT EMAIL: placeholder, not yet set up]. Algoryva runs a competitive programming website, a mobile app, and a Telegram bot.

## What the Telegram bot does

- **Account linking (optional).** You can connect your Algoryva account to the bot with `/link`. You confirm the link on our website while signed in. We never ask for your password in Telegram, and the bot never sees your password or session.
- **Community messages (optional).** Starting the bot subscribes your private chat to a daily Codeforces problem and to reminders before Codeforces contests. Group admins can enable the same in a group.
- **Progress, rewards, clubs, referrals (optional).** If your account is linked, the bot can show your progress, weekly rewards, club membership and referral count.

## What we store, and why

| Data | Why | Form | Kept until |
|---|---|---|---|
| Your Telegram user id, for a linked account | To know which account a chat belongs to | Only a keyed hash (HMAC) is stored for lookups | You unlink, or delete your account |
| Your chat id, for a private chat or group that subscribed | To send you messages | Encrypted at rest (AES-256-GCM) | You send `/stop`, or delete your account |
| Link tokens | To confirm a link | Only a hash of each token | 15 minutes to expire, pruned after 24 hours |
| Request nonces | To block replayed bot requests | The value itself | Pruned after 10 minutes |
| Community delivery records | To avoid duplicate messages and to retry failed ones | Message kind, date or contest id, status. No message text | **No retention limit is enforced yet. A pruning job is required before launch (see "Known gaps").** |
| Referral code and referral link | To credit a referral | A random code and the referrer's code on the referred chat | Until the referred chat is removed or the account is deleted |
| Club membership and club name | To run clubs | Club name, invite code, membership | Until you leave, or the club or your account is deleted |
| Weekly rewards | To record awards | Reward kind, week, a count | Until your account is deleted |
| Verified solve records | To compute progress and rankings | Existing website data | As the website keeps it |
| Bot logs | To operate the bot | Start-up, errors, and the error class names. **No message text, no chat ids, no tokens** | 7 days, a limit set in the VM's log settings |

## Who receives data

- **Telegram** delivers the messages you send and receive. Telegram's own privacy policy applies to your chat history.
- **Codeforces** receives read-only requests for public contest and problem data. Our requests contain no personal data. We do not send Codeforces anything about you.
- **Neon** (database, Free plan) stores the data in the table above.
- **Vercel** hosts the website and its API.
- **Oracle Cloud** hosts the bot process. The bot keeps no personal data on its disk.

## Your choices

- **Unlink** with `/unlink` (in the bot) or with Disconnect (on the website). This removes the link. Your community subscription stays unless you also send `/stop`.
- **Stop messages** with `/stop`. This removes the subscription and its scheduled messages.
- **Delete your account** on the website. This removes your account, your Telegram link, your subscriptions, your referral code, your club membership, your rewards, and your solve records, as the existing deletion routine does. Clubs you lead are deleted with you. A club that another member leads is not affected. (Tested on a real database.)
- **Access and correction.** Use `/progress` and the website for your own data. For anything else, write to the contact address above.

## Known gaps before launch

1. **Delivery-record retention is not enforced.** A scheduled job must delete or anonymise old delivery rows. This is a launch blocker.
2. **Chat encryption key.** Losing `TELEGRAM_CHAT_KEY` makes stored chats unreadable. The key must be backed up.
3. **Account deletion of a leader** deletes the club for every member. This is the current rule and should be shown to leaders before they create a club.

## Changes

This notice describes the version in the repository at the time of writing. Changes will be announced in the bot and on the website.
