-- Group classroom: a roster of handles per group, and a group's own daily problem. Additive: two new tables, no existing row changes.
CREATE TABLE "GroupRoster" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupRoster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupRoster_recipientId_handle_key" ON "GroupRoster"("recipientId", "handle");

-- AddForeignKey
ALTER TABLE "GroupRoster" ADD CONSTRAINT "GroupRoster_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "TelegramRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "GroupDaily" (
    "recipientId" TEXT NOT NULL,
    "problemRef" TEXT NOT NULL,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupDaily_pkey" PRIMARY KEY ("recipientId")
);

-- AddForeignKey
ALTER TABLE "GroupDaily" ADD CONSTRAINT "GroupDaily_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "TelegramRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
