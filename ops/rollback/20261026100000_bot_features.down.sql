-- Reverses 20261026100000_bot_features. Drops the daily assignments (the only data this migration created) and the leaderboard
-- opt-in column. Run only after the bot features are switched off, because the bot reads both.
DROP TABLE IF EXISTS "ChallengeAssignment";
ALTER TABLE "TelegramLink" DROP COLUMN IF EXISTS "leaderboardOptIn";
