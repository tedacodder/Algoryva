-- Codeforces handles connected to chats. Additive: one new table, no existing row changes.

-- CreateTable
CREATE TABLE "CfHandle" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CfHandle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CfHandle_recipientId_handle_key" ON "CfHandle"("recipientId", "handle");

-- CreateIndex
CREATE INDEX "CfHandle_handle_idx" ON "CfHandle"("handle");

-- AddForeignKey: removing a chat removes its handles.
ALTER TABLE "CfHandle" ADD CONSTRAINT "CfHandle_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "TelegramRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
