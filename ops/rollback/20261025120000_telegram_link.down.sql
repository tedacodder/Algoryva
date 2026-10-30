-- Reverses 20261025120000_telegram_link. Removes every Telegram link. Accounts are untouched. Users must re-link afterwards.
DROP TABLE IF EXISTS "BotNonce";
DROP TABLE IF EXISTS "TelegramLinkChallenge";
DROP TABLE IF EXISTS "TelegramLink";
