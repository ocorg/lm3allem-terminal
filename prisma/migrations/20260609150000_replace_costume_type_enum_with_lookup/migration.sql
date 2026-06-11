-- Step 1: Add a nullable typeId column to CostumeItem
ALTER TABLE "CostumeItem" ADD COLUMN "typeId" TEXT;

-- Step 2: Create the new costume_item_types lookup category
INSERT INTO "LookupCategory" (id, slug, name_fr, name_ar, "createdAt")
VALUES ('ctype_cat_001', 'costume_item_types', 'Types d''articles costumes', 'أنواع عناصر البدلات', NOW());

-- Step 3: Seed the 4 base type values
INSERT INTO "LookupValue" (id, "categoryId", label_fr, label_ar, "order", "isActive", "createdAt", "updatedAt") VALUES
  ('ctype_suit_001',  'ctype_cat_001', 'Costume',    'بدلة',    1, true, NOW(), NOW()),
  ('ctype_vest_001',  'ctype_cat_001', 'Gilet',      'صديري',   2, true, NOW(), NOW()),
  ('ctype_shoes_001', 'ctype_cat_001', 'Chaussures', 'أحذية',   3, true, NOW(), NOW()),
  ('ctype_acc_001',   'ctype_cat_001', 'Accessoire', 'إكسسوار', 4, true, NOW(), NOW());

-- Step 4: Map every existing CostumeItem to its new LookupValue ID
UPDATE "CostumeItem" SET "typeId" = 'ctype_suit_001'  WHERE "type" = 'suit';
UPDATE "CostumeItem" SET "typeId" = 'ctype_vest_001'  WHERE "type" = 'vest';
UPDATE "CostumeItem" SET "typeId" = 'ctype_shoes_001' WHERE "type" = 'shoes';
UPDATE "CostumeItem" SET "typeId" = 'ctype_acc_001'   WHERE "type" = 'accessory';

-- Step 5: Now make typeId required (no item can be typeless)
ALTER TABLE "CostumeItem" ALTER COLUMN "typeId" SET NOT NULL;

-- Step 6: Add the foreign key relationship to LookupValue
ALTER TABLE "CostumeItem" ADD CONSTRAINT "CostumeItem_typeId_fkey"
  FOREIGN KEY ("typeId") REFERENCES "LookupValue"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 7: Add a database index for performance
CREATE INDEX "CostumeItem_typeId_idx" ON "CostumeItem"("typeId");

-- Step 8: Drop the old enum column
ALTER TABLE "CostumeItem" DROP COLUMN "type";

-- Step 9: Remove the enum type from the database entirely
DROP TYPE IF EXISTS "CostumeItemType";