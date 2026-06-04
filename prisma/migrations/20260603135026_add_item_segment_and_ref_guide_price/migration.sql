-- CreateEnum
CREATE TYPE "ItemSegment" AS ENUM ('sale', 'rental');

-- AlterTable
ALTER TABLE "CostumeItem" ADD COLUMN     "refGuidePrice" DECIMAL(10,2),
ADD COLUMN     "segment" "ItemSegment" NOT NULL DEFAULT 'sale';

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "portal" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
