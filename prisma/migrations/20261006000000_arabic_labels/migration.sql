-- Standard Arabic wording for seeded lookup labels.
-- Idempotent: only rows whose label still equals the old seeded text are changed.
UPDATE "LookupValue" SET "label_ar" = 'سترات'       WHERE "label_ar" = 'جاكيطات';
UPDATE "LookupValue" SET "label_ar" = 'ربطة فراشة'  WHERE "label_ar" = 'فراشة';
UPDATE "LookupValue" SET "label_ar" = 'صدرية'       WHERE "label_ar" = 'صديري';
UPDATE "LookupCategory" SET "name_ar" = 'مقاسات الصدرية' WHERE "name_ar" = 'مقاسات الصديري';
UPDATE "LookupCategory" SET "name_ar" = 'مقاسات القميص'  WHERE "name_ar" = 'مقاسات القميجة';
