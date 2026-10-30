-- CreateTable: one Telegram link per account. Additive: no existing table or column changes.
CREATE TABLE "TelegramLink" (
    "userId" TEXT NOT NULL,
    "telegramHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLink_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLink_telegramHash_key" ON "TelegramLink"("telegramHash");

-- AddForeignKey: deleting an account removes its Telegram link.
ALTER TABLE "TelegramLink" ADD CONSTRAINT "TelegramLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: single-use link tokens (hashed). Not linked to an account until consumed.
CREATE TABLE "TelegramLinkChallenge" (
    "id" TEXT NOT NULL,
    "telegramHash" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLinkChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLinkChallenge_tokenHash_key" ON "TelegramLinkChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "TelegramLinkChallenge_telegramHash_createdAt_idx" ON "TelegramLinkChallenge"("telegramHash", "createdAt");

-- CreateTable: replay protection for signed bot requests.
CREATE TABLE "BotNonce" (
    "nonce" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotNonce_pkey" PRIMARY KEY ("nonce")
);

-- CreateIndex
CREATE INDEX "BotNonce_createdAt_idx" ON "BotNonce"("createdAt");
