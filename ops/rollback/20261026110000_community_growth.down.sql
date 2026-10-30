-- Reverses 20261026110000_community_growth. Removes every community subscription and referral code. Accounts are untouched.
DROP TABLE IF EXISTS "NotificationDelivery";
DROP TABLE IF EXISTS "TelegramRecipient";
DROP TABLE IF EXISTS "CfCache";
DROP TABLE IF EXISTS "ReferralCode";
