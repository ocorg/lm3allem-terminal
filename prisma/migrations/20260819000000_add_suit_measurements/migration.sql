-- Add shirt and shoe size columns to CostumeItem (rental measurements reform)
ALTER TABLE "CostumeItem" ADD COLUMN "shirtSizeId" TEXT;
ALTER TABLE "CostumeItem" ADD COLUMN "shoeSizeId" TEXT;