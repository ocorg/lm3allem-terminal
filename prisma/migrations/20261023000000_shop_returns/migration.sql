-- Shop returns: goods brought back from a magazin sale, recorded as their own event (never as a
-- negative sale or a manual till entry). Additive only: the app version before this change keeps working.
-- CreateEnum
CREATE TYPE "ReturnKind" AS ENUM ('customer_return', 'entry_error');

-- CreateEnum
CREATE TYPE "RefundMethod" AS ENUM ('cash', 'tpe', 'banque', 'none');

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "returnWindowDays" INTEGER NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "returnedQuantity" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SaleReturn" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "caisseSessionId" TEXT NOT NULL,
    "kind" "ReturnKind" NOT NULL,
    "reason" TEXT NOT NULL,
    "totalValue" DECIMAL(10,2) NOT NULL,
    "refundAmount" DECIMAL(10,2) NOT NULL,
    "refundMethod" "RefundMethod" NOT NULL,
    "debtReduction" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "afterDeadline" BOOLEAN NOT NULL DEFAULT false,
    "processedById" TEXT NOT NULL,
    "authorizedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "restocked" BOOLEAN NOT NULL,

    CONSTRAINT "SaleReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaleReturn_requestId_key" ON "SaleReturn"("requestId");

-- CreateIndex
CREATE INDEX "SaleReturn_createdAt_idx" ON "SaleReturn"("createdAt");

-- CreateIndex
CREATE INDEX "SaleReturn_saleId_idx" ON "SaleReturn"("saleId");

-- CreateIndex
CREATE INDEX "SaleReturn_caisseSessionId_idx" ON "SaleReturn"("caisseSessionId");

-- CreateIndex
CREATE INDEX "SaleReturnItem_returnId_idx" ON "SaleReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "SaleReturnItem_saleItemId_idx" ON "SaleReturnItem"("saleItemId");

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_caisseSessionId_fkey" FOREIGN KEY ("caisseSessionId") REFERENCES "CaisseSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "SaleReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Safety nets in the database itself, whatever the application does
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_returnedQuantity_range" CHECK ("returnedQuantity" >= 0 AND "returnedQuantity" <= "quantity");
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_amounts_valid" CHECK ("totalValue" > 0 AND "refundAmount" >= 0 AND "debtReduction" >= 0 AND "refundAmount" + "debtReduction" = "totalValue");
ALTER TABLE "SystemSettings" ADD CONSTRAINT "SystemSettings_returnWindowDays_range" CHECK ("returnWindowDays" BETWEEN 1 AND 365);
