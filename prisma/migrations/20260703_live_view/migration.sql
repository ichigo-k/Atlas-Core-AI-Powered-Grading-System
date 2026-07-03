-- AlterTable
ALTER TABLE "proctor_records" ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "proctor_signals" (
    "id" SERIAL NOT NULL,
    "attemptId" INTEGER NOT NULL,
    "sender" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "proctor_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proctor_messages" (
    "id" SERIAL NOT NULL,
    "attemptId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "senderRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "proctor_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proctor_signals_attemptId_sender_consumedAt_idx" ON "proctor_signals"("attemptId", "sender", "consumedAt");

-- AddForeignKey
ALTER TABLE "proctor_signals" ADD CONSTRAINT "proctor_signals_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "assessment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proctor_messages" ADD CONSTRAINT "proctor_messages_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "assessment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
