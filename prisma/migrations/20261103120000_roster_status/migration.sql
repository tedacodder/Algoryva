-- Roster entries are checked on Codeforces in the background. Existing entries are already valid.
ALTER TABLE "GroupRoster" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'valid';
