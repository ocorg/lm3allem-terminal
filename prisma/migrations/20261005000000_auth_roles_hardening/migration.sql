-- =====================================================================
-- Auth + roles + hardening migration
--
--   * Roles become admin | staff | ghost   (superadmin users are converted to admin)
--   * PIN login is replaced by email + password (the `pin` column is DROPPED)
--     -> BEFORE users can log in again you MUST run:  npx tsx scripts/set-credentials.ts
--   * Credit.status / ProductRequest.status become real enums
--   * Atomic counters, idempotency keys, rental cancellation, FKs, indexes
--   * ONE open caisse session per portal is enforced by a partial unique index
--   * Removes unused Auth.js adapter tables and ClientMeasurement
--
-- Review before applying:  npx prisma migrate deploy
-- =====================================================================

-- ─── 1. DATA PREPARATION (must run before the enum swap) ─────────────

-- superadmin no longer exists: those users keep full access as admin
UPDATE "User" SET "role" = 'admin' WHERE "role"::text = 'superadmin';

-- normalise free-text statuses before they become enums
UPDATE "Credit" SET "status" = 'open' WHERE "status" NOT IN ('open', 'partial', 'settled');
UPDATE "ProductRequest" SET "status" = 'pending' WHERE "status" NOT IN ('pending', 'reviewed', 'ordered');

-- dangling lookup references would make the new foreign keys fail: null the optional ones
UPDATE "ProductVariant" SET "sizeId"  = NULL WHERE "sizeId"  IS NOT NULL AND "sizeId"  NOT IN (SELECT "id" FROM "LookupValue");
UPDATE "ProductVariant" SET "colorId" = NULL WHERE "colorId" IS NOT NULL AND "colorId" NOT IN (SELECT "id" FROM "LookupValue");
UPDATE "CostumeItem" SET "sizeId"      = NULL WHERE "sizeId"      IS NOT NULL AND "sizeId"      NOT IN (SELECT "id" FROM "LookupValue");
UPDATE "CostumeItem" SET "colorId"     = NULL WHERE "colorId"     IS NOT NULL AND "colorId"     NOT IN (SELECT "id" FROM "LookupValue");
UPDATE "CostumeItem" SET "shirtSizeId" = NULL WHERE "shirtSizeId" IS NOT NULL AND "shirtSizeId" NOT IN (SELECT "id" FROM "LookupValue");
UPDATE "CostumeItem" SET "shoeSizeId"  = NULL WHERE "shoeSizeId"  IS NOT NULL AND "shoeSizeId"  NOT IN (SELECT "id" FROM "LookupValue");
UPDATE "SaleItem" SET "authorizedById" = NULL WHERE "authorizedById" IS NOT NULL AND "authorizedById" NOT IN (SELECT "id" FROM "User");
UPDATE "CostumeSaleItem" SET "authorizedById" = NULL WHERE "authorizedById" IS NOT NULL AND "authorizedById" NOT IN (SELECT "id" FROM "User");
UPDATE "CaisseSession" SET "closedById" = NULL WHERE "closedById" IS NOT NULL AND "closedById" NOT IN (SELECT "id" FROM "User");

-- ─── 2. ENUMS ────────────────────────────────────────────────────────

CREATE TYPE "CreditStatus" AS ENUM ('open', 'partial', 'settled');
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'reviewed', 'ordered');

-- Role: admin | staff | ghost
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('admin', 'staff', 'ghost');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'staff';
COMMIT;

ALTER TYPE "RentalStatus" ADD VALUE 'cancelled';
ALTER TYPE "TransactionType" ADD VALUE 'rental_refund';

-- ─── 3. USERS: email + password, lockout columns ────────────────────

ALTER TABLE "User"
  DROP COLUMN "avatarUrl",
  DROP COLUMN "pin",
  ADD COLUMN "email" TEXT,
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "failedLogins" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3),
  ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- schema/migration drift fix: the Prisma schema always declared these defaults
ALTER TABLE "User" ALTER COLUMN "preferredLanguage" SET DEFAULT 'ar';
ALTER TABLE "User" ALTER COLUMN "preferredTheme" SET DEFAULT 'light';

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- ─── 4. UNUSED TABLES ────────────────────────────────────────────────

ALTER TABLE "ClientMeasurement" DROP CONSTRAINT "ClientMeasurement_clientId_fkey";
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";
DROP TABLE "ClientMeasurement";
DROP TABLE "Account";
DROP TABLE "Session";
DROP TABLE "VerificationToken";

-- ─── 5. STATUS COLUMNS -> ENUMS (data preserving) ───────────────────

ALTER TABLE "Credit" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Credit" ALTER COLUMN "status" TYPE "CreditStatus" USING ("status"::"CreditStatus");
ALTER TABLE "Credit" ALTER COLUMN "status" SET DEFAULT 'open';

ALTER TABLE "ProductRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ProductRequest" ALTER COLUMN "status" TYPE "RequestStatus" USING ("status"::"RequestStatus");
ALTER TABLE "ProductRequest" ALTER COLUMN "status" SET DEFAULT 'pending';

-- ─── 6. NEW COLUMNS ──────────────────────────────────────────────────

ALTER TABLE "Sale"         ADD COLUMN "requestId" TEXT;
ALTER TABLE "CostumeSale"  ADD COLUMN "requestId" TEXT;
ALTER TABLE "Rental"       ADD COLUMN "requestId" TEXT, ADD COLUMN "cancelledAt" TIMESTAMP(3), ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "CreditPayment" ADD COLUMN "caisseSessionId" TEXT;
ALTER TABLE "CostumeItem"  ADD COLUMN "sku" TEXT;

-- ─── 7. COUNTERS (atomic sequences) ──────────────────────────────────

CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- backfill SKUs for existing costume items (ART-0001 ...), oldest first
UPDATE "CostumeItem" ci
SET "sku" = 'ART-' || LPAD(n.rn::text, 4, '0')
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS rn FROM "CostumeItem"
) n
WHERE ci."id" = n."id";

INSERT INTO "Counter" ("key", "value") VALUES
  ('costume_item', (SELECT COUNT(*) FROM "CostumeItem")),
  ('rental_kit',   (SELECT COUNT(*) FROM "RentalKit"));

-- ─── 8. HISTORICAL MONEY FIX ─────────────────────────────────────────
-- Refundable deposits used to be added to Rental.amountPaid. Recompute from the payment ledger:
-- only rental_payment + remaining_balance are real rental revenue.
UPDATE "Rental" r
SET "amountPaid" = COALESCE((
      SELECT SUM(p."amount") FROM "RentalPayment" p
      WHERE p."rentalId" = r."id" AND p."type" IN ('rental_payment', 'remaining_balance')
    ), 0),
    "balance" = r."totalAmount" - COALESCE((
      SELECT SUM(p."amount") FROM "RentalPayment" p
      WHERE p."rentalId" = r."id" AND p."type" IN ('rental_payment', 'remaining_balance')
    ), 0);

-- ─── 9. INDEXES ──────────────────────────────────────────────────────

CREATE UNIQUE INDEX "Sale_requestId_key" ON "Sale"("requestId");
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");
CREATE INDEX "Sale_caisseSessionId_idx" ON "Sale"("caisseSessionId");
CREATE INDEX "CaisseSession_portal_closedAt_idx" ON "CaisseSession"("portal", "closedAt");
CREATE INDEX "CaisseSession_openedAt_idx" ON "CaisseSession"("openedAt");
CREATE INDEX "Credit_status_idx" ON "Credit"("status");
CREATE INDEX "CreditPayment_createdAt_idx" ON "CreditPayment"("createdAt");
CREATE UNIQUE INDEX "CostumeItem_sku_key" ON "CostumeItem"("sku");
CREATE UNIQUE INDEX "Rental_requestId_key" ON "Rental"("requestId");
CREATE INDEX "Rental_status_idx" ON "Rental"("status");
CREATE INDEX "Rental_scheduledReturnDate_idx" ON "Rental"("scheduledReturnDate");
CREATE INDEX "RentalPayment_createdAt_idx" ON "RentalPayment"("createdAt");
CREATE INDEX "RentalPayment_rentalId_idx" ON "RentalPayment"("rentalId");
CREATE UNIQUE INDEX "CostumeSale_requestId_key" ON "CostumeSale"("requestId");
CREATE INDEX "CostumeSale_createdAt_idx" ON "CostumeSale"("createdAt");
CREATE INDEX "CostumeSale_caisseSessionId_idx" ON "CostumeSale"("caisseSessionId");
CREATE INDEX "Expense_date_idx" ON "Expense"("date");
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
CREATE INDEX "ActivityLog_portal_createdAt_idx" ON "ActivityLog"("portal", "createdAt");
CREATE INDEX "ActivityLog_entityType_idx" ON "ActivityLog"("entityType");

-- Exactly one open caisse session per portal (Prisma cannot model partial indexes; keep this in SQL).
CREATE UNIQUE INDEX "CaisseSession_one_open_per_portal" ON "CaisseSession"("portal") WHERE "closedAt" IS NULL;

-- ─── 10. FOREIGN KEYS ────────────────────────────────────────────────

ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LookupValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "LookupValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "LookupValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CaisseSession" ADD CONSTRAINT "CaisseSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditPayment" ADD CONSTRAINT "CreditPayment_caisseSessionId_fkey" FOREIGN KEY ("caisseSessionId") REFERENCES "CaisseSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CostumeItem" ADD CONSTRAINT "CostumeItem_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "LookupValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CostumeItem" ADD CONSTRAINT "CostumeItem_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "LookupValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CostumeItem" ADD CONSTRAINT "CostumeItem_shirtSizeId_fkey" FOREIGN KEY ("shirtSizeId") REFERENCES "LookupValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CostumeItem" ADD CONSTRAINT "CostumeItem_shoeSizeId_fkey" FOREIGN KEY ("shoeSizeId") REFERENCES "LookupValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CostumeSaleItem" ADD CONSTRAINT "CostumeSaleItem_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
