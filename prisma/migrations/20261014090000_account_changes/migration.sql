-- AlterTable: a new email waits here until it is confirmed (nullable, so existing users are unaffected).
ALTER TABLE "User" ADD COLUMN "pendingEmail" TEXT;

-- AlterTable: a short device label such as "Chrome on Windows" for sign-in alerts. No IP address is stored.
ALTER TABLE "Session" ADD COLUMN "device" TEXT;
