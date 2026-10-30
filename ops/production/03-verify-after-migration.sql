-- Run AFTER the approved migrations, on the same production database, read-only. Every line should be true.
-- Each check returns one row; a failed check returns false.
BEGIN READ ONLY;
SELECT 'verification column exists on both solve tables' AS check,
       (SELECT count(*) FROM information_schema.columns WHERE table_name IN ('ProblemSolve','ContestSolve') AND column_name = 'verification') = 2 AS ok;
SELECT 'no solve record is missing a verification value' AS check,
       NOT EXISTS (SELECT 1 FROM "ProblemSolve" WHERE verification IS NULL) AND NOT EXISTS (SELECT 1 FROM "ContestSolve" WHERE verification IS NULL) AS ok;
SELECT 'every external problem solve is self-reported' AS check,
       NOT EXISTS (SELECT 1 FROM "ProblemSolve" ps JOIN "Problem" p ON p.id = ps."problemId" WHERE p.kind = 'EXTERNAL' AND ps.verification <> 'SELF_REPORTED') AS ok;
SELECT 'no internal solve was relabelled as verified by the backfill' AS check,
       NOT EXISTS (SELECT 1 FROM "ProblemSolve" ps JOIN "Problem" p ON p.id = ps."problemId" WHERE p.kind = 'INTERNAL' AND ps.verification = 'OUTPUT_MATCHED' AND ps."solvedAt" < now() - interval '1 hour') AS ok;
SELECT 'telegram tables exist' AS check,
       (SELECT count(*) FROM information_schema.tables WHERE table_name IN ('TelegramLink','TelegramLinkChallenge','BotNonce','ChallengeAssignment','TelegramRecipient','NotificationDelivery','CfCache','ReferralCode','BotReward','RewardPeriod')) = 10 AS ok;
SELECT 'every migration is finished' AS check,
       NOT EXISTS (SELECT 1 FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS ok;
COMMIT;
